// Show whether the visitor is signed in from the shared header.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase";

/** Links to account settings when signed in, otherwise to sign-in. */
export function AccountLink() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const auth = getBrowserClient()?.auth;
    if (!auth) return;
    auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  return signedIn ? <Link href="/account">Account</Link> : <Link href="/sign-in">Sign in</Link>;
}
