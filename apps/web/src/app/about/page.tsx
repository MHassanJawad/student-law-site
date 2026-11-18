// Scope, legal-information disclaimer, and terms of use for the research site.
import type { Metadata } from "next";
import Link from "next/link";
import { SupportContact } from "../support-contact";

export const metadata: Metadata = { title: "About and terms | Student Law Site" };

/** States corpus scope, limits of the information, and acceptable use. */
export default function AboutPage() {
  return <div className="page-wrap narrow-page">
    <p className="eyebrow">ABOUT AND TERMS OF USE</p>
    <h1>What this site is, and what it is not</h1>
    <p className="intro">Student Law Site is an educational research tool for Pakistani law students. It is not legal advice and not an official government publication.</p>
    <section className="text-panel"><h2>What is included</h2>
      <p>Case law comes only from the Federal Constitutional Court of Pakistan. Legislation comes from federal and provincial sources as they are reviewed. Records are added after review, so the collection is incomplete. The home page shows how many records are published, and each record shows when its source was last checked.</p>
    </section>
    <section className="text-panel"><h2>Check the official source</h2>
      <p>Every record links to its official source. Metadata may be missing or marked unknown, and a law&apos;s current legal status is not shown unless a source confirms it. Before relying on any document, read it at the official source.</p>
    </section>
    <section className="text-panel"><h2>Learning content</h2>
      <p>Maxims, Articles, and Dictionary entries are original explanations written and reviewed for this site. Each shows its author, review date, and source note.</p>
    </section>
    <section className="text-panel"><h2>Using the site</h2>
      <ul>
        <li>Use the site for study and research. Do not use automated tools to copy the collection in bulk; the service limits repeated requests.</li>
        <li>Keep your account secure and do not share it.</li>
        <li>The service is provided as it is, without a promise of availability, completeness, or accuracy.</li>
      </ul>
      <p>See the <Link href="/privacy">privacy notice</Link> for how account data is handled.</p>
    </section>
    <section className="text-panel"><h2>Corrections</h2>
      <SupportContact />
      <p className="meta">Last updated 25 October 2026.</p>
    </section>
  </div>;
}
