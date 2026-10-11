// Home page introduces corpus scope and the first research journey.
import Link from "next/link";
import { CoverageSummary } from "./coverage-summary";

/** Renders the first searchable FCCP pilot entry point. */
export default function HomePage() {
  return (
    <div className="page-wrap">
      <section className="hero">
        <p className="eyebrow">PAKISTANI LEGAL RESEARCH</p>
        <h1>Find the source.<br />Follow the law.</h1>
        <p className="hero-copy">Search reviewed Federal Constitutional Court of Pakistan judgment metadata with links to the official source.</p>
        <CoverageSummary />
        <div className="hero-actions">
          <Link className="button" href="/search">Search FCCP judgments</Link>
          <Link className="button button-secondary" href="/saved">Open saved citations</Link>
        </div>
      </section>
      <section className="feature-grid" aria-label="Research collections">
        <article className="feature-card">
          <p className="eyebrow">AVAILABLE IN THIS SLICE</p>
          <h2>Case Law</h2>
          <p>Find reviewed FCCP records by case identifier and inspect their source and checked date.</p>
          <Link href="/search">Open search <span aria-hidden="true">&rarr;</span></Link>
        </article>
        <article className="feature-card muted-card">
          <p className="eyebrow">NEXT CORPUS</p>
          <h2>Legislation</h2>
          <p>Federal and provincial sources are being validated one portal at a time. No completeness claim is made.</p>
        </article>
        <article className="feature-card muted-card">
          <p className="eyebrow">PERSONAL LIBRARY</p>
          <h2>Saved citations</h2>
          <p>Sign in to save a reference and reopen it from another browser session.</p>
          <Link href="/saved">View your library <span aria-hidden="true">&rarr;</span></Link>
        </article>
      </section>
    </div>
  );
}
