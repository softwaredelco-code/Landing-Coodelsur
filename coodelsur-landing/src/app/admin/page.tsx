"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "No se pudo iniciar sesión");
      }
      router.replace("/admin/leads");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de acceso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-coodel-surface px-4 py-16">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md border border-gray-200 bg-white p-8 shadow-sm"
      >
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-coodel-accent">
          Coodelsur
        </p>
        <h1 className="mb-6 text-2xl font-bold text-coodel-dark">Acceso administración</h1>
        <Input
          label="Contraseña"
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="mt-6 w-full" loading={loading}>
          Entrar
        </Button>
      </form>
    </div>
  );
}
