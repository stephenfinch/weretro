import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { formatDistanceToNow } from "date-fns";
import { db, schema } from "@/db";

export const metadata = { title: "Dev mailbox" };

// Development-only inbox: every email WeRetro sends is stored in email_outbox.
export default async function DevMail({ searchParams }: PageProps<"/dev/mail">) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_MAIL !== "1") notFound();
  const { id } = await searchParams;
  const list = await db.select({ id: schema.emailOutbox.id, to: schema.emailOutbox.to, subject: schema.emailOutbox.subject, status: schema.emailOutbox.status, createdAt: schema.emailOutbox.createdAt }).from(schema.emailOutbox).orderBy(desc(schema.emailOutbox.createdAt)).limit(100);
  const selectedId = typeof id === "string" ? id : list[0]?.id;
  const [mail] = selectedId ? await db.select().from(schema.emailOutbox).where(eq(schema.emailOutbox.id, selectedId)).limit(1) : [];
  return (
    <div className="grid h-screen grid-cols-[360px_1fr] bg-background">
      <aside className="overflow-y-auto border-r">
        <p className="sticky top-0 border-b bg-background px-4 py-3 text-sm font-semibold">Dev mailbox · {list.length}</p>
        {list.map((m) => (
          <a key={m.id} href={`/dev/mail?id=${m.id}`} className={`block border-b px-4 py-3 text-sm hover:bg-muted ${m.id === selectedId ? "bg-muted" : ""}`}>
            <p className="truncate font-medium">{m.subject}</p>
            <p className="truncate text-xs text-muted-foreground">{m.to} · {m.status} · {formatDistanceToNow(m.createdAt, { addSuffix: true })}</p>
          </a>
        ))}
        {!list.length && <p className="p-4 text-sm text-muted-foreground">No emails yet.</p>}
      </aside>
      <main className="flex min-w-0 flex-col">
        {mail ? (
          <>
            <div className="border-b px-6 py-3 text-sm">
              <p className="font-semibold">{mail.subject}</p>
              <p className="text-muted-foreground">To: {mail.to}</p>
            </div>
            <iframe title="Email" srcDoc={mail.html} sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation" className="flex-1 bg-white" />
          </>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Select an email.</p>
        )}
      </main>
    </div>
  );
}
