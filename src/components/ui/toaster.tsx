"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { TINDAKO_TOAST_EVENT, type ToastPayload, type ToastVariant } from "@/lib/toast";
import { cn } from "@/lib/utils";

const DISPLAY_MS = 4500;
const EXIT_MS = 200;

export function Toaster() {
  const [toast, setToast] = React.useState<ToastPayload | null>(null);
  const [exiting, setExiting] = React.useState(false);
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    function clearTimers() {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      if (exitTimer.current) {
        clearTimeout(exitTimer.current);
        exitTimer.current = null;
      }
    }

    function onToast(e: Event) {
      const ce = e as CustomEvent<ToastPayload>;
      clearTimers();
      setExiting(false);
      setToast(ce.detail);
      hideTimer.current = setTimeout(() => {
        setExiting(true);
        exitTimer.current = setTimeout(() => {
          setToast(null);
          setExiting(false);
          exitTimer.current = null;
        }, EXIT_MS);
      }, DISPLAY_MS);
    }

    window.addEventListener(TINDAKO_TOAST_EVENT, onToast as EventListener);
    return () => {
      window.removeEventListener(TINDAKO_TOAST_EVENT, onToast as EventListener);
      clearTimers();
    };
  }, []);

  if (!toast) return null;

  const variant: ToastVariant = toast.variant ?? "default";

  const shell = cn(
    "flex w-[min(100%-2rem,22rem)] items-start gap-2.5 rounded-xl border px-4 py-3 shadow-sm",
    "border-l-4",
    exiting
      ? "animate-out fade-out slide-out-to-top-2 duration-200 fill-mode-forwards"
      : "animate-in fade-in slide-in-from-top-2 duration-200",
    variant === "success" &&
      "border-green-200 bg-green-50 text-green-900 border-l-green-500 dark:border-green-800/70 dark:bg-green-950/40 dark:text-green-100 dark:border-l-green-500",
    variant === "destructive" &&
      "border-red-200 bg-red-50 text-red-900 border-l-red-500 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-100 dark:border-l-red-500",
    variant === "default" &&
      "border-gray-200 bg-gray-50 text-gray-900 border-l-gray-400 dark:border-border dark:bg-muted/50 dark:text-foreground dark:border-l-muted-foreground/40"
  );

  const icon =
    variant === "destructive" ? (
      <X className="mt-0.5 size-4 shrink-0 opacity-80 text-red-700 dark:text-red-300" aria-hidden />
    ) : variant === "success" ? (
      <Check className="mt-0.5 size-4 shrink-0 opacity-80 text-green-700 dark:text-green-300" aria-hidden />
    ) : null;

  const descClass =
    variant === "success"
      ? "mt-1 text-sm text-green-800/90 dark:text-green-100/85"
      : variant === "destructive"
        ? "mt-1 text-sm text-red-800/90 dark:text-red-100/85"
        : "mt-1 text-sm text-gray-600 dark:text-muted-foreground";

  return (
    <div
      className={cn(
        "pointer-events-none fixed top-[max(1rem,env(safe-area-inset-top,0px))] left-1/2 z-[9999] flex w-full max-w-[100vw] justify-center px-2 sm:px-0",
        "-translate-x-1/2"
      )}
    >
      <div
        className={cn(shell, "pointer-events-auto")}
        role={variant === "destructive" ? "alert" : "status"}
        aria-live={variant === "destructive" ? "assertive" : "polite"}
      >
        {icon}
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{toast.title}</p>
          {toast.description ? <p className={descClass}>{toast.description}</p> : null}
        </div>
      </div>
    </div>
  );
}
