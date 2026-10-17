// Personal account settings and irreversible deletion flow.
"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { getBrowserClient } from "@/lib/supabase";

/** Shows account controls for the current authenticated student. */
export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("Checking account…");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    getBrowserClient()?.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setMessage(data.user ? "" : "Sign in to manage your account.");
    });
  }, []);

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation !== "DELETE" || !window.confirm("Permanently delete your account and all saved citations?")) return;
    const client = getBrowserClient();
    const session = await client?.auth.getSession();
    const token = session?.data.session?.access_token;
    if (!token) { setMessage("Sign in again before deleting your account."); return; }
    setWorking(true);
    try {
      const response = await fetch("/api/v1/me/account", {
        method: "DELETE", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });
      if (!response.ok) { setMessage(response.status === 403 ? "Current password is incorrect." : "Could not delete your account. Please try again."); return; }
      await client?.auth.signOut({ scope: "local" });
      setEmail(null);
      setMessage("Your account and saved citations were deleted.");
    } catch { setMessage("Could not delete your account. Please try again."); }
    finally { setWorking(false); setPassword(""); }
  }

  return <div className="page-wrap form-page">
    <p className="eyebrow">PERSONAL ACCOUNT</p><h1>Account settings</h1>
    <p aria-live="polite" className="status-line">{message}</p>
    {!email ? <Link href="/sign-in">Sign in</Link> : <>
      <p>Signed in as <strong>{email}</strong>.</p>
      <p><Link href="/saved">Open your library to export your citations</Link> before deleting your account.</p>
      <section className="account-danger">
        <h2>Delete account</h2>
        <p>This permanently removes your account, notes, folders, and saved citations. It does not affect public legal documents.</p>
        <form className="account-form" onSubmit={deleteAccount}>
          <label htmlFor="current-password">Current password</label>
          <input id="current-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          <label htmlFor="delete-confirmation">Type DELETE to confirm</label>
          <input id="delete-confirmation" autoComplete="off" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          <button type="submit" disabled={working || confirmation !== "DELETE"}>Permanently delete account</button>
        </form>
      </section>
    </>}
  </div>;
}
