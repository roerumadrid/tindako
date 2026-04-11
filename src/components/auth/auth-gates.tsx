"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { AUTH_DISABLED_FOR_DEV } from "@/lib/dev-auth";

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6 text-sm text-muted-foreground">Loading…</div>
  );
}

/** When auth is off: render immediately — no Supabase auth calls, no redirects. */
export function ShopGate({ children }: { children: React.ReactNode }) {
  if (AUTH_DISABLED_FOR_DEV) {
    return <>{children}</>;
  }
  return <ShopGateAuthed>{children}</ShopGateAuthed>;
}

function ShopGateAuthed({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: store } = await supabase.from("stores").select("id").eq("user_id", user.id).maybeSingle();
      if (cancelled) return;
      if (!store) {
        router.replace("/onboarding");
        return;
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) return <Loading />;
  return <>{children}</>;
}

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  if (AUTH_DISABLED_FOR_DEV) {
    return <>{children}</>;
  }
  return <OnboardingGateAuthed>{children}</OnboardingGateAuthed>;
}

function OnboardingGateAuthed({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: store } = await supabase.from("stores").select("id").eq("user_id", user.id).maybeSingle();
      if (cancelled) return;
      if (store) {
        router.replace("/dashboard");
        return;
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) return <Loading />;
  return <>{children}</>;
}

export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  if (AUTH_DISABLED_FOR_DEV) {
    return <>{children}</>;
  }
  return <RedirectIfAuthedInner>{children}</RedirectIfAuthedInner>;
}

function RedirectIfAuthedInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setShow(true);
        return;
      }
      const { data: store } = await supabase.from("stores").select("id").eq("user_id", user.id).maybeSingle();
      if (cancelled) return;
      router.replace(store ? "/dashboard" : "/onboarding");
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!show) return <Loading />;
  return <>{children}</>;
}
