// List and save only the authenticated user's citations.
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/lib/auth";
import { apiError, hasTrustedOrigin } from "@/lib/http";

const SAVE_SCHEMA = z.object({ documentId: z.string().uuid() });

/** Returns the caller's saved citations in newest-first order. */
export async function GET(request: Request): Promise<NextResponse> {
  const user = await verifyUser(request);
  if (!user) return apiError(401, "AUTH_REQUIRED", "Sign in to view saved citations.");
  const { data, error } = await user.client.from("saved_citations")
    .select("id,document_id,citation_snapshot,created_at")
    .eq("owner_id", user.id).order("created_at", { ascending: false }).limit(100);
  if (error) return apiError(503, "SAVED_UNAVAILABLE", "Saved citations are temporarily unavailable.");
  return NextResponse.json({ items: data ?? [], page: 1 });
}

/** Saves a published document citation for the authenticated caller. */
export async function POST(request: Request): Promise<NextResponse> {
  if (!hasTrustedOrigin(request)) return apiError(403, "ORIGIN_DENIED", "Request origin is not allowed.");
  if (!request.headers.get("content-type")?.startsWith("application/json")) return apiError(415, "UNSUPPORTED_MEDIA_TYPE", "Send JSON.");
  const user = await verifyUser(request);
  if (!user) return apiError(401, "AUTH_REQUIRED", "Sign in to save citations.");
  const body = SAVE_SCHEMA.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "INVALID_INPUT", "A valid document ID is required.");
  const { data: doc } = await user.client.from("legal_documents")
    .select("id,title,judgment_metadata(case_number,raw_citation)")
    .eq("id", body.data.documentId).eq("publication_status", "published").maybeSingle();
  if (!doc) return apiError(404, "RESOURCE_NOT_FOUND", "Document not found.");
  const metadata = Array.isArray(doc.judgment_metadata) ? doc.judgment_metadata[0] : doc.judgment_metadata;
  const snapshot = metadata?.raw_citation ?? metadata?.case_number ?? doc.title;
  const { data, error } = await user.client.from("saved_citations")
    .insert({ owner_id: user.id, document_id: doc.id, citation_snapshot: snapshot })
    .select("id,document_id,citation_snapshot,created_at").single();
  if (error?.code === "23505") return apiError(409, "ALREADY_SAVED", "Citation already saved.");
  if (error || !data) return apiError(503, "SAVE_UNAVAILABLE", "Could not save citation.");
  return NextResponse.json(data, { status: 201 });
}
