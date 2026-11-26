"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Wordmark } from "./brand";
import { cn } from "@/lib/utils";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { backendMode } from "@/lib/api";

const links = [
  { href: "/chat", label: "Ask" },
  { href: "/documents", label: "Corpus" },
  { href: "/dashboard", label: "Signals" },
  { href: "/about", label: "Method" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  // The /embed route is a chrome-free surface meant for iframes.
  if (pathname.startsWith("/embed")) return null;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-300",
        scrolled
          ? "border-bone-100/10 bg-ink-950/85 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-6 px-5 md:px-8">
        <Link href="/" className="group shrink-0" aria-label="सरकार Record Index — home">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative rounded-[4px] px-3.5 py-2 text-[13px] transition-colors",
                  active ? "text-bone-50" : "text-bone-400 hover:text-bone-100",
                )}
              >
                {link.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[1px] h-px bg-brass-400" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-500">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                backendMode() === "supabase" ? "bg-emerald-400" : "bg-brass-400",
              )}
            />
            {backendMode() === "supabase" ? "Live" : "Local"}
          </span>
          <Link
            href="/chat"
            className="group inline-flex h-9 items-center gap-1.5 rounded-[4px] bg-bone-50 px-3.5 text-[12.5px] font-medium text-ink-950 transition-colors hover:bg-brass-200"
          >
            Open console
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
          {email ? (
            <Link
              href="/account"
              className="hidden max-w-[160px] truncate font-mono text-[11px] text-bone-400 hover:text-bone-100 lg:block"
            >
              {email}
            </Link>
          ) : isSupabaseConfigured ? (
            <Link href="/login" className="text-[12.5px] text-bone-400 hover:text-bone-100">
              Sign in
            </Link>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[4px] border border-bone-100/15 text-bone-200 md:hidden"
          aria-expanded={open}
          aria-label="Toggle navigation"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-bone-100/10 bg-ink-950 px-5 pb-6 pt-4 md:hidden">
          <div className="flex flex-col">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="border-b border-bone-100/8 py-3 text-[15px] text-bone-200"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/chat"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-[4px] bg-bone-50 text-[13.5px] font-medium text-ink-950"
            >
              Open console
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
