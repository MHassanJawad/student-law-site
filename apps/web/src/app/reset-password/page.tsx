// Complete password recovery after Supabase verifies the emailed link.
"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { getBrowserClient } from "@/lib/supabase";
import { getPublicConfig } from "@/lib/config";

/** Lets a verified recovery session set a new password. */
export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(getPublicConfig() ? "Checking recovery link…" : "Account service is not configured.");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const client = getBrowserClient();
    if (!client) return;
    const { data: listener } = client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") { setReady(true); setMessage(""); }
    });
    client.auth.getSession().then(({ data }) => {
      if (data.session) { setReady(true); setMessage(""); }
      else setMessage("Open the recovery link sent to your email, or request a new one.");
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getBrowserClient();
    if (!client) return;
    setWorking(true);
    const { error } = await client.auth.updateUser({ password });
    setWorking(false);
    setMessage(error ? "Could not update your password. Request a new recovery link." : "Password updated. You can open your library now.");
    if (!error) setPassword("");
  }

  return <div className="page-wrap form-page">
    <p className="eyebrow">ACCOUNT RECOVERY</p><h1>Set a new password</h1>
    {ready && <form className="account-form" onSubmit={submit}>
      <label htmlFor="new-password">New password</label>
      <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
      <button type="submit" disabled={working}>{working ? "Updating…" : "Update password"}</button>
    </form>}
    <p className="status-line" aria-live="polite">{message}</p>
    <Link href={ready ? "/saved" : "/sign-in"}>{ready ? "Open saved citations" : "Back to sign in"}</Link>
  </div>;
}
