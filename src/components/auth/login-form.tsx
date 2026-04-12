"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sanitizeUsernameInput, usernameToSyntheticEmail, validateUsername } from "@/lib/auth-username";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function humanizeLoginError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Invalid username or password.";
  if (m.includes("email not confirmed")) return "Invalid username or password.";
  if (m.includes("invalid email")) return "Invalid username or password.";
  return message.includes("@") ? "Invalid username or password." : message;
}

export function LoginForm({ errorParam }: { errorParam?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState(errorParam ? "Invalid username or password." : "");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    const userErr = validateUsername(username);
    if (userErr) {
      setErrorMessage(userErr);
      return;
    }
    if (!password.trim()) {
      setErrorMessage("Password is required.");
      return;
    }
    const email = usernameToSyntheticEmail(username);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    console.log("login result", data, error);

    if (error) {
      setLoading(false);
      setErrorMessage(humanizeLoginError(error.message));
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    console.log("session after login", sessionData.session);

    if (!sessionData.session) {
      setLoading(false);
      setErrorMessage("Could not start your session. Try again.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
    setLoading(false);
  }

  const invalid = Boolean(errorMessage);

  return (
    <div className="flex w-full flex-col items-center space-y-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <form onSubmit={handleLogin} className="w-full text-left">
        <div className="mb-4">
          <Label htmlFor="username" className="mb-2 block">
            Username
          </Label>
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoFocus
            required
            aria-invalid={invalid}
            className={cn("min-h-12 text-base", invalid && "border-red-500 focus-visible:border-red-500")}
            value={username}
            onChange={(e) => setUsername(sanitizeUsernameInput(e.target.value))}
          />
        </div>
        <div className="mb-4">
          <Label htmlFor="password" className="mb-2 block">
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={invalid}
            className={cn("min-h-12 text-base", invalid && "border-red-500 focus-visible:border-red-500")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">Use your registered username and password</p>
        </div>
        {errorMessage ? (
          <p className="mt-1 text-xs text-red-500" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <Button
          type="submit"
          className="mt-4 min-h-12 w-full text-base transition hover:opacity-90 active:scale-[0.98] disabled:hover:opacity-100 disabled:active:scale-100"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </Button>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
