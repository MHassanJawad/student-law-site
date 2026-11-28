// Server page for the research assistant; the interactive thread lives in the client component.
import type { Metadata } from "next";
import { AssistantClient } from "./assistant-client";

export const metadata: Metadata = {
  title: "Ask AI | Student Law Site",
  description: "Ask a research question and get an answer with references to this site's published sources.",
};

export default function AssistantPage() {
  return <AssistantClient />;
}
