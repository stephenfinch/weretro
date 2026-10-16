import Link from "next/link";
import { ForgotForm } from "@/components/auth/forms";

export const metadata = { title: "Forgot password" };

export default function ForgotPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">We&apos;ll email you a link to choose a new one.</p>
      </div>
      <ForgotForm />
      <p className="text-center text-sm"><Link href="/login" className="text-muted-foreground hover:text-foreground">Back to sign in</Link></p>
    </div>
  );
}
