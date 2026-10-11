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
        <p className="hero-copy">Search reviewed Pakistani legal records, inspect their provenance, and open the official source. The current published pilot covers FCCP judgment metadata.</p>
        <CoverageSummary />
        <div className="hero-actions">
          <Link className="button" href="/search?mode=case-law">Explore case law</Link>
          <Link className="button button-secondary" href="/saved">Open saved citations</Link>
        </div>
      </section>
      <section className="feature-grid" aria-label="Research collections">
        <article className="feature-card">
          <p className="eyebrow">AVAILABLE IN THIS SLICE</p>
          <h2>Case Law</h2>
          <p>Find reviewed FCCP records by case identifier and inspect their source and checked date.</p>
          <Link href="/search?mode=case-law">Open search <span aria-hidden="true">&rarr;</span></Link>
        </article>
        <article className="feature-card muted-card">
          <p className="eyebrow">EARLY CORPUS</p>
          <h2>Legislation</h2>
          <p>Browse verified metadata from available sources. The local setup includes one labeled Pakistan Code sample; legal status remains unknown.</p>
          <Link href="/search?mode=statutes">Open statutes search <span aria-hidden="true">&rarr;</span></Link>
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
