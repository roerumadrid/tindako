import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { RedirectIfAuthed } from "@/components/auth/auth-gates";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <RedirectIfAuthed>
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4 py-12 text-center">
        <Link
          href="/"
          className="mb-10 flex flex-col items-center rounded-lg text-center outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo layout="stacked" />
        </Link>
        <LoginForm errorParam={params.error} />
      </div>
    </RedirectIfAuthed>
  );
}
