"use client";

import { useEffect, useState } from "react";
import { fetchMinistries } from "@/lib/api";

const fallback = [
  "Ministry of Finance",
  "Ministry of Home Affairs",
  "Ministry of Education, Science & Technology",
  "Ministry of Health & Population",
  "Ministry of Foreign Affairs",
  "Ministry of Law, Justice & Parliamentary Affairs",
  "Ministry of Physical Infrastructure & Transport",
  "Ministry of Agriculture & Livestock Development",
  "Ministry of Energy, Water Resources & Irrigation",
  "Ministry of Federal Affairs & General Administration",
];

export function MinistryMarquee() {
  const [names, setNames] = useState<string[]>(fallback);

  useEffect(() => {
    fetchMinistries()
      .then((list) => {
        if (list.length >= 3) setNames(list);
      })
      .catch(() => undefined);
  }, []);

  const row = [...names, ...names];

  return (
    <div className="relative overflow-hidden border-y border-bone-100/10 py-4">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-ink-950 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-ink-950 to-transparent"
        aria-hidden
      />
      <div className="marquee-track flex w-max items-center gap-10">
        {row.map((name, index) => (
          <span
            key={`${name}-${index}`}
            className="flex items-center gap-10 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.18em] text-bone-500"
          >
            {name}
            <span className="h-1 w-1 rounded-full bg-brass-500/50" />
          </span>
        ))}
      </div>
    </div>
  );
}
