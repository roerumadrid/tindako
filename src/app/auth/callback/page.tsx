"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AUTH_DISABLED_FOR_DEV } from "@/lib/dev-auth";
import { createClient } from "@/lib/supabase";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    if (AUTH_DISABLED_FOR_DEV) {
      router.replace("/dashboard");
      return;
    }

    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";

    if (!code) {
      router.replace("/login?error=auth");
      return;
    }

    const supabase = createClient();
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setMessage(error.message);
        router.replace("/login?error=auth");
        return;
      }
      router.replace(next);
    });
  }, [router, searchParams]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center p-6 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
