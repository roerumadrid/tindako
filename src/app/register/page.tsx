import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { RedirectIfAuthed } from "@/components/auth/auth-gates";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <RedirectIfAuthed>
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
        <Link
          href="/"
          className="mb-12 flex flex-col items-center rounded-lg text-center outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo layout="stacked" />
        </Link>
        <RegisterForm />
      </div>
    </RedirectIfAuthed>
  );
}
