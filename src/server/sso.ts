import "server-only";
import { SAML, ValidateInResponseTo, type Profile } from "@node-saml/node-saml";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { appUrl } from "./auth";
import { HttpError } from "./access";

export type Org = typeof schema.organizations.$inferSelect;

export async function ssoOrg(orgIdOrSlug: string) {
  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(orgIdOrSlug.length === 36 && orgIdOrSlug.includes("-") ? eq(schema.organizations.id, orgIdOrSlug) : eq(schema.organizations.slug, orgIdOrSlug))
    .limit(1);
  if (!org) throw new HttpError(404, "Organization not found");
  return org;
}

export function ssoReady(org: Org) {
  const s = org.settings.sso;
  return !!(s?.enabled && s.entryPoint && s.idpCert);
}

function pem(cert: string) {
  // Accept a bare base64 certificate or a full PEM block.
  return cert.includes("BEGIN CERTIFICATE") ? cert.trim() : cert.replace(/\s+/g, "");
}

export function samlFor(org: Org) {
  const s = org.settings.sso;
  if (!s || !ssoReady(org)) throw new HttpError(400, "Single sign-on isn't set up for this organization");
  const issuer = appUrl(`/api/sso/${org.id}/metadata`);
  return new SAML({
    entryPoint: s.entryPoint,
    issuer,
    audience: issuer,
    callbackUrl: appUrl(`/api/sso/${org.id}/acs`),
    idpCert: pem(s.idpCert!),
    idpIssuer: s.idpIssuer || undefined,
    wantAssertionsSigned: false,
    wantAuthnResponseSigned: false,
    validateInResponseTo: ValidateInResponseTo.never,
    identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    acceptedClockSkewMs: 5 * 60_000,
  });
}

export function spMetadata(org: Org) {
  const issuer = appUrl(`/api/sso/${org.id}/metadata`);
  const acs = appUrl(`/api/sso/${org.id}/acs`);
  return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${issuer}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" AuthnRequestsSigned="false" WantAssertionsSigned="true">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService index="1" isDefault="true" Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acs}"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
}

const str = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) && typeof v[0] === "string" ? v[0] : undefined);

/** Pull an email address and display name out of a SAML profile. */
export function identityFrom(org: Org, profile: Profile) {
  const s = org.settings.sso ?? {};
  const email = (
    (s.emailAttribute && s.emailAttribute !== "NameID" ? str(profile[s.emailAttribute]) : undefined) ??
    str(profile.email) ??
    str(profile.mail) ??
    str(profile["urn:oid:0.9.2342.19200300.100.1.3"]) ??
    str(profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"]) ??
    profile.nameID
  )
    ?.trim()
    .toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Your identity provider didn't send an email address");
  const first = str(profile.firstName) ?? str(profile.givenName) ?? str(profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"]);
  const last = str(profile.lastName) ?? str(profile.surname) ?? str(profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"]);
  const name =
    (s.nameAttribute ? str(profile[s.nameAttribute]) : undefined) ??
    str(profile.displayName) ??
    str(profile["http://schemas.microsoft.com/identity/claims/displayname"]) ??
    ([first, last].filter(Boolean).join(" ") || email.split("@")[0]);
  return { email, name };
}
