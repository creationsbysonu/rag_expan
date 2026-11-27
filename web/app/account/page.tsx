import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { MyUploads } from "@/components/documents/my-uploads";
import { getViewer } from "@/lib/supabase/server";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const viewer = await getViewer();

  return (
    <>
      <div className="mx-auto max-w-[760px] px-5 pb-20 pt-16 md:px-8">
        <p className="label-mono">Account</p>
        <h1 className="mt-4 font-display text-[clamp(2.2rem,4.6vw,3.2rem)] leading-[1] text-bone-50">
          {viewer ? "Your record." : "No session."}
        </h1>

        {viewer ? (
          <>
            <div className="panel mt-8 divide-y divide-bone-100/8">
              <div className="flex items-center justify-between px-5 py-4">
                <span className="label-mono">Identity</span>
                <span className="font-mono text-[12px] text-bone-200">
                  {viewer.email ?? (viewer.isAnonymous ? "Anonymous session" : "—")}
                </span>
              </div>
              <div className="flex items-center justify-between px-5 py-4">
                <span className="label-mono">User id</span>
                <span className="font-mono text-[10px] text-bone-500">{viewer.id}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-4">
                <span className="label-mono">Storage</span>
                <span className="text-[12px] text-bone-300">
                  Conversations and citations in Supabase Postgres
                </span>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/chat"
                className="inline-flex h-10 items-center gap-1.5 rounded-[4px] bg-bone-50 px-4 text-[13px] font-medium text-ink-950 hover:bg-brass-200"
              >
                Open console
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <SignOutButton />
            </div>

            <MyUploads anonymous={viewer.isAnonymous} />
          </>
        ) : (
          <div className="mt-6">
            <p className="max-w-[46ch] text-[13.5px] leading-relaxed text-bone-400">
              You are not signed in. Sessions are stored in this browser until you sign in.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex h-10 items-center rounded-[4px] bg-bone-50 px-4 text-[13px] font-medium text-ink-950 hover:bg-brass-200"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
      <SiteFooter />
    </>
  );
}
