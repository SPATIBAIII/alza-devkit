import type { ExportFormat, GenerationConfig, HouseholdDataset } from "@/types/data-factory";

const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

async function request(config: GenerationConfig, format?: ExportFormat): Promise<Response> {
  const query = new URLSearchParams({ count: String(config.count), seed: String(config.seed) });
  if (format) query.set("format", format);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/v1/data-factory/households${format ? "/export" : ""}?${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error("Could not reach the data service. Check that the API is running and try again.");
  }
  if (!response.ok) {
    if (response.status === 422) {
      const body = await response.json().catch(() => null);
      if (Array.isArray(body?.detail)) {
        const message = body.detail.map((item: { loc?: string[]; msg?: string }) =>
          `${item.loc?.at(-1) ?? "Input"}: ${item.msg ?? "Invalid value"}`).join(". ");
        throw new Error(message);
      }
    }
    throw new Error("The data service could not complete this request. Please try again.");
  }
  return response;
}

export async function generateHouseholds(config: GenerationConfig): Promise<HouseholdDataset> {
  const response = await request(config);
  return response.json();
}

export async function downloadHouseholds(config: GenerationConfig, format: ExportFormat): Promise<void> {
  const response = await request(config, format);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `synthetic-households-${config.count}-seed-${config.seed}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Allow the browser to begin reading the blob before releasing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
