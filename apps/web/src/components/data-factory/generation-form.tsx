import { useState, type FormEvent } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GenerationConfig } from "@/types/data-factory";

export function GenerationForm({ busy, onGenerate }: {
  busy: boolean;
  onGenerate: (config: GenerationConfig) => Promise<void>;
}) {
  const [count, setCount] = useState("100");
  const [seed, setSeed] = useState("");
  const [errors, setErrors] = useState<{ count?: string; seed?: string }>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    const parsedCount = Number(count);
    const parsedSeed = seed.trim() === "" ? 42 : Number(seed);
    if (!count.trim() || !Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 1000)
      nextErrors.count = "Enter a whole number from 1 to 1,000.";
    if (!Number.isSafeInteger(parsedSeed) || parsedSeed < 0)
      nextErrors.seed = "Enter a non-negative whole number up to 9,007,199,254,740,991.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) void onGenerate({ count: parsedCount, seed: parsedSeed });
  }

  return (
    <section className="rounded-[28px] border border-white/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl sm:p-8">
      <h3 className="text-lg font-semibold">Dataset configuration</h3>
      <form onSubmit={submit} noValidate className="mt-5 grid items-start gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <label htmlFor="preset" className="text-sm font-medium">Dataset preset</label>
          <select id="preset" disabled={busy} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-slate-500">
            <option value="households">Household Dataset</option>
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="count" className="text-sm font-medium">Record count</label>
          <Input id="count" type="number" min={1} max={1000} step={1} required value={count} disabled={busy}
            onChange={(e) => setCount(e.target.value)} aria-invalid={!!errors.count} aria-describedby="count-help" className="h-10 bg-white" />
          <p id="count-help" className={`text-xs ${errors.count ? "text-red-700" : "text-slate-500"}`}>{errors.count || "1 to 1,000 records"}</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="seed" className="text-sm font-medium">Random seed <span className="font-normal text-slate-500">(optional)</span></label>
          <Input id="seed" type="number" min={0} max={Number.MAX_SAFE_INTEGER} step={1} value={seed} placeholder="42" disabled={busy}
            onChange={(e) => setSeed(e.target.value)} aria-invalid={!!errors.seed} aria-describedby="seed-help" className="h-10 bg-white" />
          <p id="seed-help" className={`text-xs ${errors.seed ? "text-red-700" : "text-slate-500"}`}>{errors.seed || "Defaults to 42. Reuse a seed to repeat results."}</p>
        </div>
        <Button type="submit" disabled={busy} className="h-10 rounded-xl bg-slate-900 px-5 sm:mt-7">
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {busy ? "Generating…" : "Generate Dataset"}
        </Button>
      </form>
    </section>
  );
}
