const base = `${(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "")}/api/v1/data-factory`;

export async function customRequest(path: string, method = "GET", body?: unknown): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(60000) });
  } catch { throw new Error("Could not reach the data service. Check that the API is running."); }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error.detail === "string" ? error.detail : Array.isArray(error.detail)
      ? error.detail.map((e: { loc: (string | number)[]; msg: string }) => `${e.loc.join(".")}: ${e.msg}`).join("; ")
      : "The data service could not complete this request.");
  }
  return response;
}

export async function downloadResponse(response: Response, filename: string) {
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
