// Email account entry point for Supabase Auth in the pilot.
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase";

/** Handles sign-in and sign-up through the configured auth provider. */
export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "recovery">("sign-in");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getBrowserClient();
    if (!client) { setMessage("Account service is not configured."); return; }
    setWorking(true);
    setMessage("");
    if (mode === "recovery") {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      setWorking(false);
      setMessage(error ? "Could not send a recovery link. Please try again." : "If this address has an account, a recovery link has been sent.");
      return;
    }
    const result = mode === "sign-in"
      ? await client.auth.signInWithPassword({ email, password })
      : await client.auth.signUp({ email, password });
    setWorking(false);
    if (result.error) { setMessage("Could not complete account request. Check your details and try again."); return; }
    if (result.data.session) router.push("/saved");
    else setMessage("Account created. Check your email if confirmation is required.");
  }

  return <div className="page-wrap form-page">
    <p className="eyebrow">YOUR RESEARCH LIBRARY</p>
    <h1>{mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create an account" : "Reset your password"}</h1>
    <p className="intro">Browsing is public. An account is only needed to save citations across sessions.</p>
    <form className="account-form" onSubmit={onSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      {mode !== "recovery" && <><label htmlFor="password">Password</label>
      <input id="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></>}
      <button type="submit" disabled={working}>{working ? "Please wait…" : mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : "Send recovery link"}</button>
    </form>
    <p aria-live="polite" className="status-line">{message}</p>
    {mode === "sign-in" && <button className="text-button" onClick={() => { setMode("sign-up"); setMessage(""); }}>Need an account? Create one</button>}
    {mode === "sign-in" && <button className="text-button" onClick={() => { setMode("recovery"); setMessage(""); }}>Forgot your password?</button>}
    {mode !== "sign-in" && <button className="text-button" onClick={() => { setMode("sign-in"); setMessage(""); }}>Back to sign in</button>}
  </div>;
}
