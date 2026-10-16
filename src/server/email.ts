import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { APP_NAME } from "@/lib/constants";
import { appUrl } from "./auth";

type Mail = { to: string; subject: string; html: string; text?: string };

let transporterPromise: Promise<import("nodemailer").Transporter | null> | null = null;

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      const url = process.env.SMTP_URL;
      if (!url) return null;
      const nodemailer = await import("nodemailer");
      return nodemailer.createTransport(url);
    })();
  }
  return transporterPromise;
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function layout(title: string, body: string, cta?: { label: string; href: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f6f5fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e1b2e">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;padding:32px;border:1px solid #ece9f6">
<tr><td style="font-size:20px;font-weight:700;color:#5b4bdb;padding-bottom:16px">${APP_NAME}</td></tr>
<tr><td style="font-size:18px;font-weight:600;padding-bottom:12px">${escapeHtml(title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6">${body}</td></tr>
${cta ? `<tr><td style="padding-top:24px"><a href="${cta.href}" style="background:#5b4bdb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">${escapeHtml(cta.label)}</a></td></tr>` : ""}
</table>
<p style="font-size:12px;color:#8a85a3;margin-top:16px">Sent by ${APP_NAME} · <a href="${appUrl("/profile/notifications")}" style="color:#8a85a3">Notification settings</a></p>
</td></tr></table></body></html>`;
}

export async function sendMail(mail: Mail) {
  const [row] = await db
    .insert(schema.emailOutbox)
    .values({ to: mail.to, subject: mail.subject, html: mail.html, text: mail.text ?? "" })
    .returning();
  const transporter = await getTransporter();
  if (!transporter) {
    if (process.env.NODE_ENV !== "test") console.log(`[mail] to=${mail.to} subject="${mail.subject}" (no SMTP_URL; view at /dev/mail)`);
    await db.update(schema.emailOutbox).set({ status: "logged" }).where(eq(schema.emailOutbox.id, row.id));
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || `${APP_NAME} <no-reply@weretro.local>`,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    await db.update(schema.emailOutbox).set({ status: "sent", sentAt: new Date() }).where(eq(schema.emailOutbox.id, row.id));
  } catch (e) {
    await db
      .update(schema.emailOutbox)
      .set({ status: "failed", error: String(e) })
      .where(eq(schema.emailOutbox.id, row.id));
  }
}
