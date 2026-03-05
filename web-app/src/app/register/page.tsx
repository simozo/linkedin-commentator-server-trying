"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell, Button } from "@/components/ui";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:4000";

export default function RegisterPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch(`${AUTH_URL}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Registrazione fallita. Riprova.");
                return;
            }

            router.replace("/onboarding");
        } catch {
            setError("Errore di rete. Controlla la connessione e riprova.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthShell>
            <h1 className="auth-title">Crea il tuo account</h1>
            <p className="auth-subtitle">Inizia gratis — nessuna carta richiesta.</p>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <div className="form-field">
                        <label className="form-label" htmlFor="email">Email</label>
                        <input
                            id="email"
                            className="form-input"
                            type="email"
                            placeholder="nome@azienda.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>
                    <div className="form-field">
                        <label className="form-label" htmlFor="password">Password</label>
                        <input
                            id="password"
                            className="form-input"
                            type="password"
                            placeholder="Minimo 8 caratteri"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            minLength={8}
                            autoComplete="new-password"
                        />
                    </div>
                </div>

                {error && (
                    <p style={{ color: "var(--color-error)", fontSize: "0.85rem", marginBottom: "1rem" }}>
                        {error}
                    </p>
                )}

                <Button type="submit" fullWidth disabled={loading}>
                    {loading ? "Creazione account..." : "Inizia gratis"}
                </Button>
            </form>

            <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "1.5rem" }}>
                Hai già un account?{" "}
                <Link href={`${AUTH_URL}/login`} style={{ color: "var(--accent-blue)", fontWeight: 600, textDecoration: "none" }}>
                    Accedi
                </Link>
            </p>
        </AuthShell>
    );
}
