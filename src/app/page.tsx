"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { AUTH_DISABLED_FOR_DEV } from "@/lib/dev-auth";
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
      <p className="text-sm font-semibold tracking-wide text-primary">TindaKo</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Simple POS &amp; stock for your tindahan
      </h1>
      <p className="mt-3 text-lg text-muted-foreground text-pretty">Track mo ang tinda mo.</p>
      <p className="mt-6 text-sm leading-relaxed text-muted-foreground text-pretty">
        Built for sari-sari stores and small sellers — big buttons, clear labels, and reminders when stock runs low.
      </p>

      <p className="mt-6 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Supabase (client test):{" "}
        {conn === "idle" ? (
          "Checking…"
        ) : conn === "ok" ? (
          <span className="font-medium text-emerald-700 dark:text-emerald-400">Connected</span>
        ) : (
          <span className="font-medium text-destructive" title={connDetail ?? undefined}>
            Not connected{connDetail ? ` — ${connDetail}` : ""}
          </span>
        )}
      </p>

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

      {AUTH_DISABLED_FOR_DEV ? (
        <p className="mt-8 text-xs text-muted-foreground">
          Dev mode: auth is off — open{" "}
          <Link href="/dashboard" className="font-medium text-primary underline-offset-4 hover:underline">
            Dashboard
          </Link>
          ,{" "}
          <Link href="/inventory" className="font-medium text-primary underline-offset-4 hover:underline">
            Inventory
          </Link>
          , or{" "}
          <Link href="/pos" className="font-medium text-primary underline-offset-4 hover:underline">
            POS
          </Link>{" "}
          directly.
        </p>
      ) : null}
    </div>
  );
}

function HomeMarketingOpen() {
  const [conn, setConn] = useState<"idle" | "ok" | "err">("idle");
  const [connDetail, setConnDetail] = useState<string | null>(null);

  useEffect(() => {
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
    void testSupabaseConnection().then(({ ok, error }) => {
      setConn(ok ? "ok" : "err");
      setConnDetail(error);
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data: store } = await supabase.from("stores").select("id").eq("user_id", user.id).maybeSingle();
        router.replace(store ? "/dashboard" : "/onboarding");
      } else {
        setReady(true);
      }
    });
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
