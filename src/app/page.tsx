"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { AUTH_DISABLED_FOR_DEV } from "@/lib/dev-auth";
import { ensureDefaultStoreForUser } from "@/lib/store";
import { createClient, testSupabaseConnection } from "@/lib/supabase";
import { cn } from "@/lib/utils";

function HomeLanding({
  conn,
  connDetail,
}: {
  conn: "idle" | "ok" | "err";
  connDetail: string | null;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16 text-center">
      <div className="mb-12 flex flex-col items-center text-center">
        <Logo layout="stacked" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Simple POS &amp; stock for your tindahan
      </h1>
      <p className="mt-6 text-sm leading-relaxed text-muted-foreground text-pretty">
        Built for sari-sari stores and small sellers — big buttons, clear labels, and reminders when stock runs low.
      </p>

      {process.env.NODE_ENV === "development" ? (
        <p className="mt-6 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Supabase (client test):{" "}
          {conn === "idle" ? (
            "Checking…"
          ) : conn === "ok" ? (
            <span className="font-medium text-green-600 dark:text-emerald-400">Connected</span>
          ) : (
            <span className="font-medium text-destructive" title={connDetail ?? undefined}>
              Not connected{connDetail ? ` — ${connDetail}` : ""}
            </span>
          )}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/register"
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "inline-flex min-h-12 items-center justify-center px-8 text-base"
          )}
        >
          Get started
        </Link>
        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "inline-flex min-h-12 items-center justify-center px-8 text-base"
          )}
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

function HomeMarketingOpen() {
  const [conn, setConn] = useState<"idle" | "ok" | "err">("idle");
  const [connDetail, setConnDetail] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    void testSupabaseConnection().then(({ ok, error }) => {
      setConn(ok ? "ok" : "err");
      setConnDetail(error);
    });
  }, []);

  return <HomeLanding conn={conn} connDetail={connDetail} />;
}

function HomeWithAuthRedirect() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [conn, setConn] = useState<"idle" | "ok" | "err">("idle");
  const [connDetail, setConnDetail] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    void testSupabaseConnection().then(({ ok, error }) => {
      setConn(ok ? "ok" : "err");
      setConnDetail(error);
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setReady(true);
        return;
      }
      const ensured = await ensureDefaultStoreForUser(supabase, session.user.id, session.user.email);
      if (!ensured.ok) {
        setReady(true);
        return;
      }
      router.replace("/dashboard");
    })();
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-sm text-muted-foreground">Loading…</div>
    );
  }

  return <HomeLanding conn={conn} connDetail={connDetail} />;
}

export default function HomePage() {
  if (AUTH_DISABLED_FOR_DEV) {
    return <HomeMarketingOpen />;
  }
  return <HomeWithAuthRedirect />;
}
