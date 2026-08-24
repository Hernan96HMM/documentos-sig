import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-amber">
            Sistema Integrado de Gestión — SICA
          </div>
          <h1 className="font-serif text-[26px] font-normal text-ink">Listado Maestro de Documentos</h1>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
