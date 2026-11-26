import { Badge } from "@/components/ui/badge";

const sources = [
  {
    n: "1",
    title: "नेपालको संविधान २०७२ · भाग ३",
    meta: "Constituent Assembly · 2015",
  },
  {
    n: "2",
    title: "Ministry of Home Affairs — Citizenship Directive",
    meta: "MoHA · 2081",
  },
];

export function HeroConsole() {
  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute -inset-10 -z-10 opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(45% 45% at 60% 30%, rgba(223,168,81,0.18), transparent 70%)",
        }}
      />
      <div className="panel-raised overflow-hidden rounded-[8px]">
        <div className="flex items-center justify-between border-b border-bone-100/10 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brass-400" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-400">
              Console · session 04
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-500">
            EN / ने
          </span>
        </div>

        <div className="px-5 py-5">
          <p className="label-mono">Query</p>
          <p className="mt-2 text-[14.5px] leading-snug text-bone-50">
            What does the constitution guarantee about the right to education?
          </p>
        </div>

        <div className="border-t border-bone-100/8 px-5 py-5">
          <div className="flex items-center gap-2">
            <p className="label-mono">Answer</p>
            <span className="h-px flex-1 bg-bone-100/8" />
            <Badge tone="green">grounded 96</Badge>
          </div>
          <p className="mt-3 text-[13.5px] leading-relaxed text-bone-200">
            The 2072 Constitution guarantees every citizen the right to free basic education and
            the right to compulsory, free secondary education as a fundamental right
            <span className="mx-0.5 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-[2px] bg-brass-500/20 px-1 align-super font-mono text-[9px] text-brass-300">
              1
            </span>
            . The state is further obliged to provide free education up to the secondary level and
            to make higher education accessible to all
            <span className="mx-0.5 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-[2px] bg-brass-500/20 px-1 align-super font-mono text-[9px] text-brass-300">
              1
            </span>
            .
          </p>
        </div>

        <div className="border-t border-bone-100/8 bg-ink-950/40 px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="label-mono">Evidence</p>
            <span className="font-mono text-[10px] text-bone-500">2 passages · 1.2s</span>
          </div>
          <div className="mt-3 space-y-2">
            {sources.map((source) => (
              <div
                key={source.n}
                className="flex items-start gap-2.5 border-l border-brass-500/30 pl-2.5"
              >
                <span className="mt-[1px] font-mono text-[10px] text-brass-400">{source.n}</span>
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-bone-200">{source.title}</p>
                  <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone-500">
                    {source.meta}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.16em] text-bone-500">
        <span className="text-bone-500">Illustrative answer</span>
        <span className="text-bone-500">Streaming · cited · auditable</span>
      </div>
    </div>
  );
}
