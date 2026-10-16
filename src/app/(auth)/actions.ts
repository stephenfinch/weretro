"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  appUrl,
  consumeEmailToken,
  createEmailToken,
  createSession,
  createUser,
  destroySession,
  findUserByEmail,
  hashPassword,
  verifyPassword,
} from "@/server/auth";
import { layout, sendMail } from "@/server/email";
import { markJoined } from "@/server/orgs";

export type FormState = { error?: string; ok?: string } | undefined;

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/home";
}

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!name) return { error: "Please enter your name" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Please enter a valid email address" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  const existing = await findUserByEmail(email);
  let userId: string;
  if (existing) {
    if (existing.passwordHash) return { error: "An account with this email already exists. Try signing in." };
    // invited placeholder account: claim it
    await db
      .update(schema.users)
      .set({ name, passwordHash: await hashPassword(password), emailVerifiedAt: new Date() })
      .where(eq(schema.users.id, existing.id));
    userId = existing.id;
    await markJoined(userId);
  } else {
    const user = await createUser({ email, name, password, verified: false });
    userId = user.id;
  }
  await createSession(userId);
  redirect(safeNext(form.get("next")) === "/home" ? "/onboarding" : safeNext(form.get("next")));
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: "Incorrect email or password" };
  await createSession(user.id);
  await markJoined(user.id);
  redirect(safeNext(form.get("next")));
}

export async function magicLinkAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Please enter a valid email address" };
  let user = await findUserByEmail(email);
  if (!user) user = await createUser({ email, name: email.split("@")[0] });
  const { token, code } = await createEmailToken(email, "login", { userId: user.id, data: { next: safeNext(form.get("next")) }, minutes: 30 });
  const link = appUrl(`/auth/magic?token=${token}`);
  await sendMail({
    to: email,
    subject: `Your WeRetro sign-in link (${code})`,
    html: layout("Sign in to WeRetro", `<p>Click the button below to sign in. This link expires in 30 minutes.</p><p>Or enter this code: <strong style="font-size:18px;letter-spacing:2px">${code}</strong></p>`, { label: "Sign in", href: link }),
    text: `Sign in: ${link}\nCode: ${code}`,
  });
  return { ok: `We've emailed a sign-in link to ${email}.` };
}

export async function forgotAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const user = await findUserByEmail(email);
  if (user) {
    const { token } = await createEmailToken(email, "reset", { userId: user.id, minutes: 60 });
    await sendMail({
      to: email,
      subject: "Reset your WeRetro password",
      html: layout("Reset your password", "<p>Use the button below to choose a new password. The link expires in an hour.</p>", { label: "Choose a new password", href: appUrl(`/reset?token=${token}`) }),
    });
  }
  return { ok: "If that email has an account, we've sent a reset link." };
}

export async function resetAction(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  const row = await consumeEmailToken(token, "reset");
  if (!row?.userId) return { error: "This reset link is invalid or has expired" };
  await db.update(schema.users).set({ passwordHash: await hashPassword(password), emailVerifiedAt: new Date() }).where(eq(schema.users.id, row.userId));
  await createSession(row.userId);
  redirect("/home");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
