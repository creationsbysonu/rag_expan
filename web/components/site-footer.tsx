import Image from "next/image";
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

        <div className="mt-14 flex flex-col gap-6 border-t border-bone-100/8 pt-6 md:flex-row md:items-center md:justify-between">
          <Link
            href="https://github.com/creationsbysonu"
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3.5"
          >
            <Image
              src="/sonu-kumar-gupta.jpg"
              alt="Sonu Kumar Gupta"
              width={44}
              height={44}
              className="h-11 w-11 rounded-full border border-bone-100/15 object-cover grayscale transition duration-300 group-hover:grayscale-0"
            />
            <span>
              <span className="label-mono block">Built &amp; maintained by</span>
              <span className="mt-1 block text-[13px] text-bone-200 transition-colors group-hover:text-brass-300">
                Sonu Kumar Gupta
                <span className="ml-1.5 font-mono text-[10.5px] text-bone-500">@creationsbysonu</span>
              </span>
            </span>
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-500">
            © {new Date().getFullYear()} सरकार Record Index · Kathmandu
          </p>
        </div>

        <p className="mt-5 max-w-[62ch] text-[11px] leading-relaxed text-bone-500">
          Unaffiliated research prototype. Verify every answer against the original gazette,
          notice or ministry publication.
        </p>
      </div>
    </footer>
  );
}
