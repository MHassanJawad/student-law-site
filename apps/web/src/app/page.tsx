// Home page introduces corpus scope and the first research journey.
import Link from "next/link";
import { CoverageSummary } from "./coverage-summary";

/** Renders corpus scope and the research entry points. */
export default function HomePage() {
  return (
    <div className="page-wrap">
      <section className="hero">
        <p className="eyebrow">PAKISTANI LEGAL RESEARCH</p>
        <h1>Find the source.<br />Follow the law.</h1>
        <p className="hero-copy">Search reviewed Pakistani legal records, inspect their provenance, and open the official source. Judgments come only from the Federal Constitutional Court of Pakistan; legislation is added source by source as it is reviewed.</p>
        <CoverageSummary />
        <div className="hero-actions">
          <Link className="button" href="/search?mode=case-law">Explore case law</Link>
          <Link className="button button-secondary" href="/saved">Open saved citations</Link>
        </div>
      </section>
      <section className="feature-grid" aria-label="Research collections">
        <article className="feature-card">
          <p className="eyebrow">FCCP JUDGMENTS</p>
          <h2>Case Law</h2>
          <p>Find reviewed FCCP records by case identifier and inspect their source and checked date.</p>
          <p className="card-links"><Link href="/search?mode=courtwise">Courtwise</Link><Link href="/search?mode=citation">Citation</Link><Link href="/search?mode=advanced">Advanced</Link></p>
          <Link href="/search?mode=case-law">Open search <span aria-hidden="true">&rarr;</span></Link>
        </article>
        <article className="feature-card muted-card">
          <p className="eyebrow">FEDERAL AND PROVINCIAL</p>
          <h2>Legislation</h2>
          <p>Browse reviewed metadata and follow each law to its official source. Legal status is shown as unknown unless a source confirms it.</p>
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
