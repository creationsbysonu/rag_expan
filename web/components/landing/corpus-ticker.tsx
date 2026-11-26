"use client";

import { useEffect, useState } from "react";
import { fetchCorpusStats } from "@/lib/api";
import type { CorpusStats } from "@/lib/types";
import { formatNumber, relativeTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/badge";

const items: { key: keyof CorpusStats; label: string; suffix?: string }[] = [
  { key: "documents", label: "Documents" },
  { key: "chunks", label: "Indexed passages" },
  { key: "ministries", label: "Ministries" },
  { key: "services", label: "Public services" },
];

export function CorpusTicker() {
  const [stats, setStats] = useState<CorpusStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchCorpusStats()
      .then((value) => {
        if (!alive) return;
        if (value) setStats(value);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="border-y border-bone-100/10 bg-ink-900/40">
      <div className="mx-auto grid max-w-[1240px] grid-cols-2 divide-x divide-bone-100/8 px-5 md:grid-cols-4 md:px-8">
        {items.map((item) => (
          <div key={item.key} className="px-4 py-6 first:pl-0 md:px-7">
            <p className="label-mono">{item.label}</p>
            {stats ? (
              <p className="mt-2 font-display text-3xl leading-none text-bone-50 tabular-nums">
                {formatNumber(stats[item.key] as number)}
                <span className="ml-1 align-top font-mono text-[10px] tracking-normal text-bone-500">
                  {item.suffix}
                </span>
              </p>
            ) : failed ? (
              <p className="mt-2 font-display text-3xl leading-none text-bone-500">—</p>
            ) : (
              <Skeleton className="mt-3 h-7 w-20" />
            )}
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 pb-4 md:px-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-500">
          {stats?.last_ingested_at
            ? `Last ingest · ${relativeTime(stats.last_ingested_at)}`
            : "Index status · connected"}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-500">
          Nepali · English · Devanagari
        </p>
      </div>
    </div>
  );
}
