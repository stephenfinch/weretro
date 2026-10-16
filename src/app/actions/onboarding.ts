"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { createOrganization, createTeam, joinTeamByCode } from "@/server/orgs";
import { HttpError } from "@/server/access";

export async function onboardAction(_: { error?: string } | undefined, form: FormData) {
  const user = await requireUser();
  const orgName = String(form.get("orgName") ?? "").trim();
  const teamName = String(form.get("teamName") ?? "").trim();
  if (!orgName) return { error: "Please name your organization" };
  if (!teamName) return { error: "Please name your first team" };
  const org = await createOrganization(user, orgName);
  const team = await createTeam(user, org.id, { name: teamName, color: String(form.get("color") ?? "#6366F1") });
  redirect(`/t/${team.id}?welcome=1`);
}

export async function joinCodeAction(_: { error?: string } | undefined, form: FormData) {
  const user = await requireUser(`/join`);
  try {
    const team = await joinTeamByCode(user, String(form.get("code") ?? ""));
    if (!team) return { error: "Unknown invitation code" };
    redirect(`/t/${team.id}`);
  } catch (e) {
    if (e instanceof HttpError) return { error: e.message };
    throw e;
  }
}
