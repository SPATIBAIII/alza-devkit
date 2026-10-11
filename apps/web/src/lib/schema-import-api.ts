const base = `${(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "")}/api/v1/schema-import`;

export async function schemaRequest(path: string, method = "GET", body?: unknown): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method, headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(60000),
    });
  } catch { throw new Error("Could not reach the schema service. Check that the local API is running."); }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error.detail === "string" ? error.detail : Array.isArray(error.detail)
      ? error.detail.map((e: { loc: (string | number)[]; msg: string }) => `${e.loc.join(".")}: ${e.msg}`).join("; ")
      : "The schema service could not complete this request.");
  }
  return response;
}
