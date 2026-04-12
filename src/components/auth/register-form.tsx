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

function humanizeRegisterError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("already") ||
    m.includes("registered") ||
    m.includes("exists") ||
    m.includes("duplicate") ||
    m.includes("unique violation")
  ) {
    return "Username already taken.";
  }
  if (m.includes("invalid email")) return "Invalid username.";
  return message.includes("@") ? "Something went wrong. Try again." : message;
}

export function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }
    const email = usernameToSyntheticEmail(username);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setErrorMessage(humanizeRegisterError(error.message));
      return;
    }
    router.refresh();
    if (data.session) {
      router.push("/dashboard");
      return;
    }
    router.push("/login");
  }

  const invalid = Boolean(errorMessage);

  return (
    <div className="flex w-full flex-col items-center space-y-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
      <form onSubmit={handleSubmit} className="w-full text-left">
        <div className="mb-4">
          <Label htmlFor="reg-username" className="mb-2 block">
            Username
          </Label>
          <Input
            id="reg-username"
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
          <Label htmlFor="reg-password" className="mb-2 block">
            Password
          </Label>
          <Input
            id="reg-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            aria-invalid={invalid}
            className={cn("min-h-12 text-base", invalid && "border-red-500 focus-visible:border-red-500")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">At least 6 characters</p>
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
          {loading ? "Creating account..." : "Register"}
        </Button>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
