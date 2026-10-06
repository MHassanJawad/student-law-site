// Read one published document and its approved current version.
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/http";
import { createPublicClient } from "@/lib/supabase";

type RouteContext = { params: Promise<{ id: string }> };

/** Returns detail for a published judgment, omitting unavailable source fields. */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return apiError(400, "INVALID_ID", "Invalid document identifier.");
  const client = createPublicClient();
  if (!client) return apiError(503, "NOT_CONFIGURED", "The research database is not configured.");
  const { data: doc, error } = await client.from("legal_documents")
    .select("id,title,kind,canonical_url,current_version_id,judgment_metadata(case_number,decision_date,author_judge,bench,raw_citation),document_versions!document_versions_document_id_fkey(id,checked_at,extracted_text,text_kind,raw_metadata)")
    .eq("id", id).eq("publication_status", "published").maybeSingle();
  if (error) return apiError(503, "DOCUMENT_UNAVAILABLE", "Document lookup is temporarily unavailable.");
  if (!doc) return apiError(404, "RESOURCE_NOT_FOUND", "Document not found.");
  const metadata = Array.isArray(doc.judgment_metadata) ? doc.judgment_metadata[0] : doc.judgment_metadata;
  const versions = Array.isArray(doc.document_versions) ? doc.document_versions : [];
  const version = versions.find((item) => item.id === doc.current_version_id);
  if (!version) return apiError(503, "VERSION_UNAVAILABLE", "The published version is unavailable.");
  return NextResponse.json({
    id: doc.id,
    kind: doc.kind,
    title: doc.title,
    citation: metadata?.raw_citation ?? metadata?.case_number ?? null,
    date: metadata?.decision_date ?? null,
    sourceUrl: doc.canonical_url,
    checkedAt: version.checked_at,
    versionId: version.id,
    text: version.extracted_text,
    textKind: version.text_kind,
    metadata: { caseNumber: metadata?.case_number, authorJudge: metadata?.author_judge, bench: metadata?.bench, sourceFields: version.raw_metadata },
  });
}
