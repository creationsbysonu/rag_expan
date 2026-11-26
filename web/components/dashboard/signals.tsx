"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, ArrowDownRight, ArrowUpRight, Gauge, Languages, Timer } from "lucide-react";
import { fetchDashboard } from "@/lib/api";
import type { DashboardStats } from "@/lib/types";
import { cn, formatLatency, formatNumber } from "@/lib/utils";
import { Skeleton } from "@/components/ui/badge";

const ranges = [7, 30, 90] as const;

function Kpi({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="panel px-5 py-5">
      <div className="flex items-center justify-between">
        <span className="label-mono">{label}</span>
        <Icon className="h-3.5 w-3.5 text-bone-500" strokeWidth={1.5} />
      </div>
      <p className="mt-3 font-display text-[34px] leading-none text-bone-50 tabular-nums">
        {value}
      </p>
      {detail ? (
        <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone-500">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

const tooltipStyle = {
  background: "#0f1310",
  border: "1px solid rgba(236,231,219,0.14)",
  borderRadius: 4,
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  color: "#ece7db",
};

export function Signals() {
  const [days, setDays] = useState<(typeof ranges)[number]>(30);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchDashboard(days)
      .then((data) => alive && setStats(data))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [days]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[124px] w-full" />
          ))}
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="panel flex flex-col items-center justify-center px-6 py-24 text-center">
        <Activity className="h-6 w-6 text-bone-500" strokeWidth={1.25} />
        <p className="mt-4 font-display text-2xl text-bone-100">No signals yet.</p>
        <p className="mt-2 max-w-[48ch] text-[12.5px] leading-relaxed text-bone-400">
          Query logs populate this view once the Supabase backend is connected and questions start
          arriving. In local mode, only aggregate counters are available.
        </p>
      </div>
    );
  }

  const answeredRate =
    stats.total_queries > 0 ? (stats.answered_queries / stats.total_queries) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="label-mono">Window</p>
        <div className="flex items-center rounded-[3px] border border-bone-100/12 p-[2px]">
          {ranges.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setDays(range)}
              className={cn(
                "rounded-[2px] px-2.5 py-[3px] font-mono text-[10px] uppercase tracking-[0.08em] transition-colors",
                days === range ? "bg-bone-100/10 text-bone-100" : "text-bone-500 hover:text-bone-200",
              )}
            >
              {range}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Questions"
          value={formatNumber(stats.total_queries)}
          detail={`${stats.window_days}-day window`}
          icon={Activity}
        />
        <Kpi
          label="Answered"
          value={`${answeredRate.toFixed(0)}%`}
          detail={`${formatNumber(stats.answered_queries)} grounded`}
          icon={stats.failure_rate > 10 ? ArrowDownRight : ArrowUpRight}
        />
        <Kpi
          label="Median latency"
          value={formatLatency(stats.avg_latency_ms)}
          detail="retrieval + generation"
          icon={Timer}
        />
        <Kpi
          label="Grounding"
          value={stats.avg_quality ? stats.avg_quality.toFixed(0) : "—"}
          detail="mean score /100"
          icon={Gauge}
        />
      </div>

      <div className="panel">
        <div className="flex items-center justify-between border-b border-bone-100/8 px-5 py-3">
          <span className="label-mono">Question volume</span>
          <span className="font-mono text-[10px] text-bone-500">per day</span>
        </div>
        <div className="h-[280px] px-2 py-4">
          {stats.daily.length === 0 ? (
            <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.14em] text-bone-500">
              Daily series not available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.daily} margin={{ top: 8, right: 16, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="volume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#dfa851" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#dfa851" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(236,231,219,0.06)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "#8d8d81", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: string) => value.slice(5)}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: "#8d8d81", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(236,231,219,0.15)" }} />
                <Area
                  type="monotone"
                  dataKey="queries"
                  stroke="#dfa851"
                  strokeWidth={1.5}
                  fill="url(#volume)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="panel">
          <div className="flex items-center justify-between border-b border-bone-100/8 px-5 py-3">
            <span className="label-mono">Grounding distribution</span>
            <span className="font-mono text-[10px] text-bone-500">score bands</span>
          </div>
          <div className="h-[260px] px-2 py-4">
            {stats.quality_buckets.length === 0 ? (
              <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.14em] text-bone-500">
                No scored answers in window
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.quality_buckets}
                  margin={{ top: 8, right: 16, bottom: 0, left: -18 }}
                >
                  <CartesianGrid stroke="rgba(236,231,219,0.06)" vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fill: "#8d8d81", fontSize: 10, fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#8d8d81", fontSize: 10, fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(236,231,219,0.04)" }} />
                  <Bar dataKey="count" fill="#c98b31" radius={[2, 2, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="panel flex flex-col">
          <div className="flex items-center justify-between border-b border-bone-100/8 px-5 py-3">
            <span className="label-mono">Language</span>
            <Languages className="h-3.5 w-3.5 text-bone-500" strokeWidth={1.5} />
          </div>
          <div className="space-y-5 px-5 py-5">
            {(["ne", "en"] as const).map((key) => {
              const total = stats.language_split.ne + stats.language_split.en || 1;
              const share = (stats.language_split[key] / total) * 100;
              return (
                <div key={key}>
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-400">
                      {key === "ne" ? "नेपाली" : "English"}
                    </span>
                    <span className="font-mono text-[10px] text-bone-500">
                      {share.toFixed(0)}% · {formatNumber(stats.language_split[key])}
                    </span>
                  </div>
                  <div className="mt-2 h-[3px] w-full bg-bone-100/8">
                    <div
                      className="h-full bg-brass-400"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-auto border-t border-bone-100/8 px-5 py-4">
            <p className="label-mono">Most cited</p>
            <ul className="mt-3 space-y-2">
              {stats.top_documents.length === 0 ? (
                <li className="text-[11.5px] text-bone-500">No citations in window.</li>
              ) : (
                stats.top_documents.slice(0, 4).map((doc) => (
                  <li key={doc.title} className="flex items-start justify-between gap-3">
                    <span className="line-clamp-1 text-[11.5px] text-bone-300">{doc.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-brass-400">
                      {formatNumber(doc.hits)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
