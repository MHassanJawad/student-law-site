// Complete password recovery after Supabase verifies the emailed link.
"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { getBrowserClient } from "@/lib/supabase";
import { getPublicConfig } from "@/lib/config";
import { passwordError } from "@/lib/password-policy";
import { PasswordFields } from "../password-fields";

/** Lets a verified recovery session set a new password. */
export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
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
    const validation = passwordError(password, confirmation);
    if (validation) { setMessage(validation); return; }
    const client = getBrowserClient();
    if (!client) return;
    setWorking(true);
    const { error } = await client.auth.updateUser({ password });
    setWorking(false);
    setMessage(error ? "Could not update your password. Request a new recovery link." : "Password updated. You can open your library now.");
    if (!error) { setPassword(""); setConfirmation(""); }
  }

  return <div className="page-wrap form-page sign-in-page">
    <p className="eyebrow">ACCOUNT RECOVERY</p><h1>Set a new password</h1>
    {ready && <form className="account-form" onSubmit={submit}>
      <PasswordFields password={password} confirmation={confirmation} onPassword={setPassword} onConfirmation={setConfirmation} />
      <button type="submit" disabled={working}>{working ? "Updating…" : "Update password"}</button>
    </form>}
    <p className="status-line" aria-live="polite">{message}</p>
    <Link href={ready ? "/saved" : "/sign-in"}>{ready ? "Open saved citations" : "Back to sign in"}</Link>
  </div>;
}
