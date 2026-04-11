"use client";

import { useEffect, useRef } from "react";

/** Default time to show inline feedback (between ~3–5s). */
export const FEEDBACK_AUTO_HIDE_MS = 4200;

/**
 * Clears a non-empty string after `durationMs` (e.g. error or success copy).
 * Resets the timer when `value` changes.
 */
export function useAutoDismissString(value: string | null, onClear: () => void, durationMs = FEEDBACK_AUTO_HIDE_MS) {
  const onClearRef = useRef(onClear);
  onClearRef.current = onClear;
  useEffect(() => {
    if (value === null || value === "") return;
    const id = window.setTimeout(() => onClearRef.current(), durationMs);
    return () => window.clearTimeout(id);
  }, [value, durationMs]);
}

/**
 * When `value` is true, calls `onClear` after `durationMs` (e.g. success flag).
 */
export function useAutoDismissTrue(value: boolean, onClear: () => void, durationMs = FEEDBACK_AUTO_HIDE_MS) {
  const onClearRef = useRef(onClear);
  onClearRef.current = onClear;
  useEffect(() => {
    if (!value) return;
    const id = window.setTimeout(() => onClearRef.current(), durationMs);
    return () => window.clearTimeout(id);
  }, [value, durationMs]);
}
