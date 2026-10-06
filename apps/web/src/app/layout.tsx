// Root page shell and global site metadata.
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Student Law Site",
  description: "Source-linked Pakistani legal research for students.",
};

/** Renders shared navigation and the educational-use footer. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <header className="site-header">
          <div className="header-inner">
            <Link className="brand" href="/">Student Law Site</Link>
            <nav aria-label="Main navigation" className="main-nav">
              <Link href="/">Home</Link>
              <Link href="/search">Case Law</Link>
              <Link href="/saved">Saved Citations</Link>
              <Link href="/sign-in">Sign in</Link>
            </nav>
          </div>
        </header>
        <main id="main" className="site-main">{children}</main>
        <footer className="site-footer">
          <p>Educational research only. This site is not legal advice or an official government publication. Verify documents at their linked official source.</p>
        </footer>
      </body>
    </html>
  );
}
