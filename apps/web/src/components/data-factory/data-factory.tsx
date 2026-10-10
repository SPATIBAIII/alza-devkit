"use client";

import { useRef, useState } from "react";
import { generateHouseholds } from "@/lib/data-factory-api";
import type { GenerationConfig, HouseholdDataset } from "@/types/data-factory";
import { GenerationForm } from "./generation-form";
import { DatasetPreview } from "./dataset-preview";

export function DataFactory() {
  const [dataset, setDataset] = useState<HouseholdDataset | null>(null);
  const [generation, setGeneration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  async function generate(config: GenerationConfig) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      setDataset(await generateHouseholds(config));
      setGeneration((value) => value + 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Generation failed. Please try again.");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-sm leading-6 text-slate-500">
        <p>Generate realistic synthetic datasets for development, testing, and analytics.</p>
        <p className="mt-2 text-xs">All records are synthetic, with fictional sample barangays. Income categories are illustrative testing values, not official classifications.</p>
      </div>
      <GenerationForm busy={busy} onGenerate={generate} />
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}{dataset && " The previous dataset is still shown below."}</div>}
      <DatasetPreview key={generation} dataset={dataset} busy={busy} />
    </div>
  );
}
