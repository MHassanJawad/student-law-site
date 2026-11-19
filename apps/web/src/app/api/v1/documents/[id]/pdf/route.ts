// Serve the official PDF of a published judgment from this site, so the reader can show its original layout.
import { z } from "zod";
import { apiError } from "@/lib/http";
import { fetchOfficialPdf } from "@/lib/official-pdf";
import { createPublicClient } from "@/lib/supabase";

type RouteContext = { params: Promise<{ id: string }> };

/** Returns the PDF the current published version's text was taken from. */
export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return apiError(400, "INVALID_ID", "Invalid document identifier.");
  const client = createPublicClient();
  if (!client) return apiError(503, "NOT_CONFIGURED", "The research database is not configured.");
  // Row-level security only exposes the current version of a published document.
  const { data: doc, error } = await client.from("legal_documents")
    .select("title,current_version_id,document_versions!document_versions_document_id_fkey(id,source_pdf_sha256)")
    .eq("id", id).eq("publication_status", "published").maybeSingle();
  if (error) return apiError(503, "DOCUMENT_UNAVAILABLE", "Document lookup is temporarily unavailable.");
  const versions = Array.isArray(doc?.document_versions) ? doc.document_versions : [];
  const sha256 = versions.find((version) => version.id === doc?.current_version_id)?.source_pdf_sha256;
  if (!doc || !sha256) return apiError(404, "RESOURCE_NOT_FOUND", "No official PDF is recorded for this document.");
  let bytes: Uint8Array;
  try {
    bytes = await fetchOfficialPdf(sha256);
  } catch {
    return apiError(502, "SOURCE_UNAVAILABLE", "The official PDF could not be retrieved.");
  }
  const filename = doc.title.replace(/[^\w.\- ]+/g, "").trim().slice(0, 120) || "judgment";
  return new Response(new Blob([bytes as BlobPart]), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}.pdf"`,
      // The bytes are fixed by hash; a new version gets a new hash and a revalidated copy within a day.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      ETag: `"${sha256}"`,
    },
  });
}
