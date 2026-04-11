import Link from "next/link";
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
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <Link href="/" className="text-sm font-semibold text-primary">
            TindaKo
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">Track mo ang tinda mo.</p>
        </div>
        <LoginForm errorParam={params.error} />
      </div>
    </RedirectIfAuthed>
  );
}
