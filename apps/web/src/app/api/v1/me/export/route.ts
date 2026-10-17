// Export the caller's entire personal citation library as JSON.
import { NextResponse } from "next/server";
import { verifyUser } from "@/lib/auth";
import { apiError } from "@/lib/http";

/** Streams bounded database pages into one owner-scoped JSON download. */
export async function GET(request: Request): Promise<NextResponse> {
  const user = await verifyUser(request);
  if (!user) return apiError(401, "AUTH_REQUIRED", "Sign in to export your library.");
  const items: unknown[] = [];
  for (let offset = 0; offset <= 100000; offset += 500) {
    if (offset === 100000) return apiError(413, "EXPORT_TOO_LARGE", "Please contact support for a larger export.");
    const { data, error } = await user.client.from("saved_citations")
      .select("document_id,citation_snapshot,note,folder,created_at,updated_at")
      .eq("owner_id", user.id).order("created_at", { ascending: true }).range(offset, offset + 499);
    if (error) return apiError(503, "EXPORT_UNAVAILABLE", "Could not export your library.");
    items.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  return NextResponse.json({ format: "student-law-library-v1", exportedAt: new Date().toISOString(), items }, {
    headers: { "Cache-Control": "no-store", "Content-Disposition": "attachment; filename=student-law-library.json" },
  });
}
