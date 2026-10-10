import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadHouseholds } from "@/lib/data-factory-api";
import type { ExportFormat, GenerationConfig } from "@/types/data-factory";

export function ExportActions({ config, disabled }: { config: GenerationConfig; disabled: boolean }) {
  const [pending, setPending] = useState<ExportFormat | null>(null);
  const [error, setError] = useState("");

  async function download(format: ExportFormat) {
    setPending(format);
    setError("");
    try { await downloadHouseholds(config, format); }
    catch (error) { setError(error instanceof Error ? error.message : "Download failed. Please try again."); }
    finally { setPending(null); }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {([ ["csv", "CSV"], ["json", "JSON"], ["xlsx", "Excel"] ] as const).map(([format, label]) => (
          <Button key={format} variant="outline" disabled={disabled || pending !== null} onClick={() => void download(format)}>
            <Download />{pending === format ? "Downloading…" : `Download ${label}`}
          </Button>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
