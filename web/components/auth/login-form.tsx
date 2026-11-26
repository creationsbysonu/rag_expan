"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase || !email.trim()) return;
    setBusy(true);
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Check your inbox for the sign-in link.");
  }

  async function continueAnonymously() {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signInAnonymously();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    router.push("/chat");
  }

  if (sent) {
    return (
      <div className="mt-8 border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-5">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-emerald-300">
          Link sent
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-bone-300">
          Open the link we sent to <span className="text-bone-100">{email}</span>. You can close this
          tab.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={sendLink} className="mt-8 space-y-3">
      <label className="label-mono" htmlFor="email">
        Email
      </label>
      <div className="relative">
        <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-bone-500" />
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="pl-9"
          autoComplete="email"
        />
      </div>
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
        {busy ? "Sending…" : "Send sign-in link"}
        <ArrowRight className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-3 py-2">
        <span className="h-px flex-1 bg-bone-100/10" />
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-bone-500">or</span>
        <span className="h-px flex-1 bg-bone-100/10" />
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={continueAnonymously}
        disabled={busy}
      >
        Continue without an account
      </Button>
      <p className="pt-1 text-[11px] leading-relaxed text-bone-500">
        Anonymous sessions are tied to this device and can be claimed later.
      </p>
    </form>
  );
}
