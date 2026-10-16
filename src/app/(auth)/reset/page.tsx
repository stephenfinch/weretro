import { ResetForm } from "@/components/auth/forms";

export const metadata = { title: "Choose a new password" };

export default async function ResetPage({ searchParams }: PageProps<"/reset">) {
  const sp = await searchParams;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <ResetForm token={typeof sp.token === "string" ? sp.token : ""} />
    </div>
  );
}
