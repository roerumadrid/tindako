import Link from "next/link";
import { RedirectIfAuthed } from "@/components/auth/auth-gates";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <RedirectIfAuthed>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <Link href="/" className="text-sm font-semibold text-primary">
            TindaKo
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">Create your account to get started.</p>
        </div>
        <RegisterForm />
      </div>
    </RedirectIfAuthed>
  );
}
