"use client";

import { useState } from "react";
import { PASSWORD_RULES, passwordError } from "@/lib/password-policy";

export function PasswordFields({ password, confirmation, onPassword, onConfirmation }: {
  password: string; confirmation: string;
  onPassword: (value: string) => void; onConfirmation: (value: string) => void;
}) {
  const [showRules, setShowRules] = useState(false);
  const [touched, setTouched] = useState(false);
  const error = touched ? passwordError(password, confirmation) : "";
  return <>
    <div className="password-label">
      <label htmlFor="new-password">Password</label>
      <span className="password-info" onMouseEnter={() => setShowRules(true)} onMouseLeave={() => setShowRules(false)}>
        <button type="button" className="password-info-button" aria-label="Password rules"
          aria-expanded={showRules} aria-controls="password-rules" onClick={() => setShowRules(true)}
          onFocus={() => setShowRules(true)} onBlur={() => setShowRules(false)}>i</button>
        <span id="password-rules" className={`password-tooltip${showRules ? " is-open" : ""}`}>
          <strong>Password rules</strong>
          <ul>{PASSWORD_RULES.map((rule) => <li key={rule.message}>{rule.message}</li>)}</ul>
        </span>
      </span>
    </div>
    <input id="new-password" type="password" autoComplete="new-password" required value={password}
      aria-describedby={error ? "password-error" : undefined} aria-invalid={Boolean(error)}
      onChange={(event) => onPassword(event.target.value)} onBlur={() => setTouched(true)} />
    <label htmlFor="confirm-password">Confirm password</label>
    <input id="confirm-password" type="password" autoComplete="new-password" required value={confirmation}
      aria-describedby={error ? "password-error" : undefined} aria-invalid={Boolean(error)}
      onChange={(event) => onConfirmation(event.target.value)} onBlur={() => setTouched(true)} />
    <p id="password-error" className="field-error" aria-live="polite">{error}</p>
  </>;
}
