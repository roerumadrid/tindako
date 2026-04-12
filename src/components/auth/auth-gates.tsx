"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { AUTH_DISABLED_FOR_DEV } from "@/lib/dev-auth";
import { ensureDefaultStoreForUser, getStoreForUser } from "@/lib/store";

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

type StoreGate = "idle" | "pending" | "ok" | "fail";

function ShopGateAuthed({ children }: { children: React.ReactNode }) {
  const gateLabel = "ShopGate";
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [storeGate, setStoreGate] = useState<StoreGate>("idle");

  const gateStateRef = useRef({
    authLoading,
    hasSession: !!session,
    storeGate,
    pathname,
  });
  gateStateRef.current = {
    authLoading,
    hasSession: !!session,
    storeGate,
    pathname,
  };

  useEffect(() => {
    console.log(`${gateLabel} auth gate state`, {
      authLoading,
      hasSession: !!session,
      storeGate,
      pathname,
    });
  }, [authLoading, session, storeGate, pathname]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      console.warn(`${gateLabel} dashboard bootstrap still loading after 3s`, gateStateRef.current);
    }, 3000);
    return () => window.clearTimeout(id);
  }, []);

  const runStoreEnsure = useCallback(async (s: Session) => {
    const supabase = createClient();
    setStoreGate("pending");
    console.log(`${gateLabel} ensureDefaultStoreForUser start`, { userId: s.user.id });
    const ensured = await ensureDefaultStoreForUser(supabase, s.user.id, s.user.email);
    if (ensured.ok) {
      const store = await getStoreForUser(supabase, s.user.id);
      console.log(`${gateLabel} ensureDefaultStoreForUser ok`, ensured, "store", store);
      setStoreGate("ok");
    } else {
      console.log(`${gateLabel} ensureDefaultStoreForUser error`, ensured.error);
      setStoreGate("fail");
    }
  }, []);

  const applyAuthSession = useCallback(
    (next: Session | null) => {
      setSession(next);
      if (!next?.user) {
        setStoreGate("idle");
        return;
      }
      void runStoreEnsure(next);
    },
    [runStoreEnsure]
  );

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;
      console.log(`${gateLabel} auth event`, event, nextSession);
      applyAuthSession(nextSession);
      setAuthLoading(false);
    });

    void supabase.auth.getSession().then(({ data: { session: initial } }) => {
      if (cancelled) return;
      applyAuthSession(initial);
    });

    const fallback = window.setTimeout(() => {
      if (cancelled) return;
      setAuthLoading(false);
    }, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      listener.subscription.unsubscribe();
    };
  }, [applyAuthSession]);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (storeGate === "fail") {
      router.replace("/login");
    }
  }, [authLoading, session, storeGate, router]);

  if (authLoading || !session || storeGate === "pending" || (session && storeGate === "idle")) {
    return <Loading />;
  }
  if (storeGate === "fail") {
    return <Loading />;
  }
  return <>{children}</>;
}

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  if (AUTH_DISABLED_FOR_DEV) {
    return <>{children}</>;
  }
  return <OnboardingGateAuthed>{children}</OnboardingGateAuthed>;
}

function OnboardingGateAuthed({ children }: { children: React.ReactNode }) {
  const gateLabel = "OnboardingGate";
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [storeGate, setStoreGate] = useState<StoreGate>("idle");

  const gateStateRef = useRef({
    authLoading,
    hasSession: !!session,
    storeGate,
    pathname,
  });
  gateStateRef.current = {
    authLoading,
    hasSession: !!session,
    storeGate,
    pathname,
  };

  useEffect(() => {
    console.log(`${gateLabel} auth gate state`, {
      authLoading,
      hasSession: !!session,
      storeGate,
      pathname,
    });
  }, [authLoading, session, storeGate, pathname]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      console.warn(`${gateLabel} dashboard bootstrap still loading after 3s`, gateStateRef.current);
    }, 3000);
    return () => window.clearTimeout(id);
  }, []);

  const runStoreEnsure = useCallback(async (s: Session) => {
    const supabase = createClient();
    setStoreGate("pending");
    console.log(`${gateLabel} ensureDefaultStoreForUser start`, { userId: s.user.id });
    const ensured = await ensureDefaultStoreForUser(supabase, s.user.id, s.user.email);
    if (ensured.ok) {
      const store = await getStoreForUser(supabase, s.user.id);
      console.log(`${gateLabel} ensureDefaultStoreForUser ok`, ensured, "store", store);
      setStoreGate("ok");
    } else {
      console.log(`${gateLabel} ensureDefaultStoreForUser error`, ensured.error);
      setStoreGate("fail");
    }
  }, []);

  const applyAuthSession = useCallback(
    (next: Session | null) => {
      setSession(next);
      if (!next?.user) {
        setStoreGate("idle");
        return;
      }
      void runStoreEnsure(next);
    },
    [runStoreEnsure]
  );

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;
      console.log(`${gateLabel} auth event`, event, nextSession);
      applyAuthSession(nextSession);
      setAuthLoading(false);
    });

    void supabase.auth.getSession().then(({ data: { session: initial } }) => {
      if (cancelled) return;
      applyAuthSession(initial);
    });

    const fallback = window.setTimeout(() => {
      if (cancelled) return;
      setAuthLoading(false);
    }, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      listener.subscription.unsubscribe();
    };
  }, [applyAuthSession]);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (storeGate === "fail") {
      router.replace("/login");
    }
  }, [authLoading, session, storeGate, router]);

  if (authLoading || !session || storeGate === "pending" || (session && storeGate === "idle")) {
    return <Loading />;
  }
  if (storeGate === "fail") {
    return <Loading />;
  }
  return <>{children}</>;
}

export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  if (AUTH_DISABLED_FOR_DEV) {
    return <>{children}</>;
  }
  return <RedirectIfAuthedInner>{children}</RedirectIfAuthedInner>;
}

function RedirectIfAuthedInner({ children }: { children: React.ReactNode }) {
  const gateLabel = "RedirectIfAuthed";
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [storeGate, setStoreGate] = useState<StoreGate>("idle");

  const gateStateRef = useRef({
    authLoading,
    hasSession: !!session,
    storeGate,
    pathname,
  });
  gateStateRef.current = {
    authLoading,
    hasSession: !!session,
    storeGate,
    pathname,
  };

  useEffect(() => {
    console.log(`${gateLabel} auth gate state`, {
      authLoading,
      hasSession: !!session,
      storeGate,
      pathname,
    });
  }, [authLoading, session, storeGate, pathname]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      console.warn(`${gateLabel} dashboard bootstrap still loading after 3s`, gateStateRef.current);
    }, 3000);
    return () => window.clearTimeout(id);
  }, []);

  const runStoreEnsure = useCallback(async (s: Session) => {
    const supabase = createClient();
    setStoreGate("pending");
    console.log(`${gateLabel} ensureDefaultStoreForUser start`, { userId: s.user.id });
    const ensured = await ensureDefaultStoreForUser(supabase, s.user.id, s.user.email);
    if (ensured.ok) {
      const store = await getStoreForUser(supabase, s.user.id);
      console.log(`${gateLabel} ensureDefaultStoreForUser ok`, ensured, "store", store);
      setStoreGate("ok");
    } else {
      console.log(`${gateLabel} ensureDefaultStoreForUser error`, ensured.error);
      setStoreGate("fail");
    }
  }, []);

  const applyAuthSession = useCallback(
    (next: Session | null) => {
      setSession(next);
      if (!next?.user) {
        setStoreGate("idle");
        return;
      }
      void runStoreEnsure(next);
    },
    [runStoreEnsure]
  );

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;
      console.log(`${gateLabel} auth event`, event, nextSession);
      applyAuthSession(nextSession);
      setAuthLoading(false);
    });

    void supabase.auth.getSession().then(({ data: { session: initial } }) => {
      if (cancelled) return;
      applyAuthSession(initial);
    });

    const fallback = window.setTimeout(() => {
      if (cancelled) return;
      setAuthLoading(false);
    }, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      listener.subscription.unsubscribe();
    };
  }, [applyAuthSession]);

  useEffect(() => {
    if (authLoading) return;
    if (session && storeGate === "ok") {
      router.replace("/dashboard");
    }
  }, [authLoading, session, storeGate, router]);

  if (authLoading || (session && (storeGate === "pending" || storeGate === "idle"))) {
    return <Loading />;
  }
  if (session && storeGate === "fail") {
    return <Loading />;
  }
  if (session && storeGate === "ok") {
    return <Loading />;
  }
  return <>{children}</>;
}
