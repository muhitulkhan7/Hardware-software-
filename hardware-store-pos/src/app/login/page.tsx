"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@hardwarehub.local");
  const [password, setPassword] = useState("DemoAdmin-2026");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result: { ok: boolean; message?: string } = await response.json();
      if (!response.ok || !result.ok) {
        setError(result.message ?? "Unable to sign in.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setPending(false);
    }
  }

  return <main className="login-page"><section className="login-card"><div className="brand login-brand"><span className="brand-mark">H</span><span>HARDWARE<span>HUB</span></span></div><p className="eyebrow">WESTLANDS STORE</p><h1>Welcome back</h1><p className="login-copy">Sign in to manage your inventory and sales.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>{error && <p className="login-error">{error}</p>}<button className="primary-action login-button" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</button></form><div className="demo-accounts"><p>Demo access</p><button type="button" onClick={() => { setEmail("admin@hardwarehub.local"); setPassword("DemoAdmin-2026"); }}>Admin · full access</button><button type="button" onClick={() => { setEmail("cashier@hardwarehub.local"); setPassword("DemoCashier-2026"); }}>Sales · POS, inventory and history</button></div></section></main>;
}
