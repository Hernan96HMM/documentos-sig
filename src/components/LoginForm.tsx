"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError("");

    const res = await signIn("credentials", { email, password, redirect: false });
    setEnviando(false);

    if (!res || res.error) {
      setError("Email o contraseña incorrectos.");
      setPassword("");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-lg border border-line-lt bg-gradient-to-b from-panel to-panel-2 p-6 shadow-panel"
    >
      <label className="mb-3 block">
        <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">
          Email
        </span>
        <input
          type="email"
          required
          autoFocus
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field py-2.5 text-[13.5px]"
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">
          Contraseña
        </span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field py-2.5 text-[13.5px]"
        />
      </label>

      <div className="mb-3 min-h-[18px] text-[12px] text-bad">{error}</div>

      <button type="submit" disabled={enviando} className="btn btn-amber w-full py-2.5">
        {enviando ? "Ingresando…" : "Ingresar"}
      </button>
    </motion.form>
  );
}
