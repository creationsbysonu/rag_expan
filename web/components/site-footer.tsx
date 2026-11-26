import Link from "next/link";
import { Wordmark } from "./brand";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/chat", label: "Ask the record" },
      { href: "/documents", label: "Browse corpus" },
      { href: "/dashboard", label: "Signals" },
    ],
  },
  {
    title: "Method",
    links: [
      { href: "/about", label: "How retrieval works" },
      { href: "/about#sources", label: "Source policy" },
      { href: "/about#limits", label: "Known limits" },
    ],
  },
  {
    title: "Infrastructure",
    links: [
      { href: "https://supabase.com", label: "Supabase · Postgres + pgvector" },
      { href: "https://vercel.com", label: "Vercel · Edge delivery" },
      { href: "/login", label: "Sign in" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-24 border-t border-bone-100/10">
      <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-8">
        <div className="grid gap-12 md:grid-cols-[1.3fr_repeat(3,1fr)]">
          <div>
            <Wordmark />
            <p className="mt-5 max-w-[30ch] text-pretty text-[13px] leading-relaxed text-bone-400">
              A bilingual retrieval system over Nepal&apos;s public administrative record.
              Grounded answers, cited passages, no invented policy.
            </p>
            <p className="devanagari mt-3 text-[12.5px] leading-relaxed text-bone-500">
              नेपालको सार्वजनिक प्रशासनिक अभिलेखमा आधारित द्विभाषिक खोज प्रणाली।
            </p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <p className="label-mono">{column.title}</p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[12.5px] text-bone-300 transition-colors hover:text-brass-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-bone-100/8 pt-6 md:flex-row md:items-center md:justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-500">
            © {new Date().getFullYear()} सरकार Record Index · Kathmandu
          </p>
          <p className="max-w-[60ch] text-[11px] leading-relaxed text-bone-500">
            Unaffiliated research prototype. Verify every answer against the original gazette,
            notice or ministry publication.
          </p>
        </div>
      </div>
    </footer>
  );
}
