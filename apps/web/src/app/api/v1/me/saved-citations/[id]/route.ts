// Delete only a saved citation owned by the authenticated user.
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/lib/auth";
import { apiError, hasTrustedOrigin } from "@/lib/http";
import { normalizeSavedUpdate, SAVED_UPDATE_SCHEMA } from "@/lib/saved-citation";

type RouteContext = { params: Promise<{ id: string }> };

/** Updates notes or folder for one citation owned by the caller. */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  if (!hasTrustedOrigin(request)) return apiError(403, "ORIGIN_DENIED", "Request origin is not allowed.");
  if (!request.headers.get("content-type")?.startsWith("application/json")) return apiError(415, "UNSUPPORTED_MEDIA_TYPE", "Send JSON.");
  const user = await verifyUser(request);
  if (!user) return apiError(401, "AUTH_REQUIRED", "Sign in to edit citations.");
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return apiError(400, "INVALID_ID", "Invalid citation identifier.");
  const parsed = SAVED_UPDATE_SCHEMA.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_INPUT", "Check note and folder lengths.");
  const { data, error } = await user.client.from("saved_citations")
    .update({ ...normalizeSavedUpdate(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", id).eq("owner_id", user.id)
    .select("id,document_id,citation_snapshot,note,folder,created_at,updated_at").maybeSingle();
  if (error) return apiError(503, "UPDATE_UNAVAILABLE", "Could not update citation.");
  if (!data) return apiError(404, "RESOURCE_NOT_FOUND", "Saved citation not found.");
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

/** Removes one owned citation without exposing another user's item. */
export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  if (!hasTrustedOrigin(request)) return apiError(403, "ORIGIN_DENIED", "Request origin is not allowed.");
  const user = await verifyUser(request);
  if (!user) return apiError(401, "AUTH_REQUIRED", "Sign in to remove citations.");
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return apiError(400, "INVALID_ID", "Invalid citation identifier.");
  const { data, error } = await user.client.from("saved_citations")
    .delete().eq("id", id).eq("owner_id", user.id).select("id").maybeSingle();
  if (error) return apiError(503, "DELETE_UNAVAILABLE", "Could not remove citation.");
  if (!data) return apiError(404, "RESOURCE_NOT_FOUND", "Saved citation not found.");
  return new NextResponse(null, { status: 204 });
}
