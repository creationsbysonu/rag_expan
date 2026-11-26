import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Wordmark } from "@/components/brand";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to keep your sessions and citations across devices.",
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-[440px] flex-col justify-center px-5 py-16">
      <Wordmark />
      <h1 className="mt-8 font-display text-[clamp(2.2rem,5vw,3rem)] leading-[1.02] text-bone-50">
        Keep your record.
      </h1>
      <p className="mt-3 text-[13px] leading-relaxed text-bone-400">
        Sign in to persist sessions, sources and feedback. No password — a single-use link is sent
        to your inbox.
      </p>

      {isSupabaseConfigured ? (
        <LoginForm />
      ) : (
        <div className="mt-8 border border-brass-500/25 bg-brass-500/[0.06] px-4 py-3.5">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-brass-300">
            Auth not configured
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-bone-300">
            Set <code className="font-mono text-bone-100">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono text-bone-100">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable
            sign-in. In local mode you can still ask questions — sessions live in this browser.
          </p>
        </div>
      )}

      <p className="mt-8 text-[11.5px] text-bone-500">
        Return to{" "}
        <Link href="/chat" className="text-brass-300 underline underline-offset-4">
          the console
        </Link>
        .
      </p>
    </div>
  );
}
