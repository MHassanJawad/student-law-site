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
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getBrowserClient();
    if (!client) { setMessage("Account service is not configured."); return; }
    setWorking(true);
    setMessage("");
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
    <h1>{mode === "sign-in" ? "Sign in" : "Create an account"}</h1>
    <p className="intro">Browsing is public. An account is only needed to save citations across sessions.</p>
    <form className="account-form" onSubmit={onSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      <label htmlFor="password">Password</label>
      <input id="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
      <button type="submit" disabled={working}>{working ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}</button>
    </form>
    <p aria-live="polite" className="status-line">{message}</p>
    <button className="text-button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setMessage(""); }}>
      {mode === "sign-in" ? "Need an account? Create one" : "Already have an account? Sign in"}
    </button>
  </div>;
}
