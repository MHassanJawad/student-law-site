// Privacy notice describing the account data the site actually stores.
import type { Metadata } from "next";
import Link from "next/link";
import { SupportContact } from "../support-contact";

export const metadata: Metadata = { title: "Privacy | Student Law Site" };

/** Explains collected data, retention, deletion, and processors in plain language. */
export default function PrivacyPage() {
  return <div className="page-wrap narrow-page">
    <p className="eyebrow">PRIVACY NOTICE</p>
    <h1>How your information is used</h1>
    <p className="intro">Searching and reading do not require an account. An account is used only to keep your saved citations.</p>
    <section className="text-panel"><h2>Without an account</h2>
      <p>The site does not store your search terms, use advertising or analytics trackers, or set marketing cookies. Like any website, the hosting service may briefly keep technical request logs, such as address, time, and page requested, to operate and protect the service. Requests are counted in memory to apply rate limits; those counts are not saved.</p>
    </section>
    <section className="text-panel"><h2>With an account</h2>
      <ul>
        <li>Your email address and password. The password is stored only as a one-way hash by the sign-in service.</li>
        <li>Your account role and creation time.</li>
        <li>Each saved citation: the document reference, citation text, your optional note and folder, and when you saved or changed it.</li>
        <li>Sign-in events recorded by the sign-in service, which can include your network address, for security.</li>
      </ul>
      <p>Your browser keeps a sign-in session in its local storage until you sign out. Do not put confidential client or case information in notes.</p>
    </section>
    <section className="text-panel"><h2>Who can see it</h2>
      <p>Only you can read your saved citations; other students and content operators cannot. The data is held by the project&apos;s database and sign-in provider, Supabase, and the web hosting provider chosen for launch, which process it only to run the service. It is not sold or shared for marketing.</p>
    </section>
    <section className="text-panel"><h2>Keeping, exporting, and deleting</h2>
      <p>Your account data is kept until you delete your account. In <Link href="/account">account settings</Link> you can export your saved citations as a file and permanently delete your account. Deletion removes your sign-in account, profile, and saved citations at once. Any copies in database backups expire on the backup retention schedule and are not used to restore a deleted account.</p>
    </section>
    <section className="text-panel"><h2>Questions</h2>
      <SupportContact />
      <p className="meta">Last updated 25 October 2026.</p>
    </section>
  </div>;
}
