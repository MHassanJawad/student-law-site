// Delete only a saved citation owned by the authenticated user.
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/lib/auth";
import { apiError, hasTrustedOrigin } from "@/lib/http";

type RouteContext = { params: Promise<{ id: string }> };

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
