"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:4000";
const AUTH_LOGIN_URL = process.env.NEXT_PUBLIC_AUTH_LOGIN_URL || "http://localhost:4000/login";

interface User {
    user_id: number;
    email: string;
    full_name?: string;
    avatar_url?: string;
    auth_provider: string;
}

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${AUTH_URL}/me`, {
            credentials: "include", // send session cookie
        })
            .then((res) => {
                if (!res.ok) {
                    window.location.href = AUTH_LOGIN_URL;
                    return null;
                }
                return res.json();
            })
            .then((data) => {
                if (data) setUser(data);
            })
            .catch(() => { window.location.href = AUTH_LOGIN_URL; })
            .finally(() => setLoading(false));
    }, [router]);

    const handleLogout = async () => {
        await fetch(`${AUTH_URL}/logout-web`, {
            method: "POST",
            credentials: "include",
        });
        router.replace("/");
    };

    if (loading) {
        return (
            <div className="auth-wrapper">
                <div className="spinner" style={{ width: 48, height: 48, borderWidth: 3 }} />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font)" }}>
            {/* Navbar */}
            <nav style={{
                padding: "1rem 2rem",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--color-surface)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: "linear-gradient(135deg, #3b82f6, #0ea5e9)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.9" />
                            <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
                            <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: "1rem", letterSpacing: "-0.02em" }}>
                        LinkedIn <span style={{ color: "#3b82f6" }}>Co-pilot</span>
                    </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    {user.avatar_url && (
                        <img src={user.avatar_url} alt="avatar" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                    )}
                    <span style={{ fontSize: "0.875rem", color: "var(--color-muted)" }}>
                        {user.full_name || user.email}
                    </span>
                    <button onClick={handleLogout} style={{
                        padding: "0.4rem 1rem",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        border: "1px solid var(--color-border)",
                        borderRadius: 20,
                        background: "transparent",
                        color: "var(--color-muted)",
                        cursor: "pointer",
                        transition: "all 0.2s",
                    }}>
                        Esci
                    </button>
                </div>
            </nav>

            {/* Main content */}
            <main style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.5rem" }}>
                <div style={{ marginBottom: "2.5rem" }}>
                    <h1 style={{ fontSize: "1.8rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "0.5rem" }}>
                        Ciao, {user.full_name?.split(" ")[0] || "utente"} 👋
                    </h1>
                    <p style={{ color: "var(--color-muted)", fontSize: "0.95rem" }}>
                        Benvenuto nella tua dashboard. Qui troverai le statistiche di engagement e le configurazioni del plugin.
                    </p>
                </div>

                {/* Placeholder cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1.25rem" }}>
                    {[
                        { label: "Post analizzati", value: "—", icon: "📊" },
                        { label: "Commenti generati", value: "—", icon: "💬" },
                        { label: "Connessioni target", value: "—", icon: "🎯" },
                        { label: "Provider auth", value: user.auth_provider, icon: "🔐" },
                    ].map((card) => (
                        <div key={card.label} style={{
                            background: "var(--color-surface)",
                            border: "1px solid var(--color-border)",
                            borderRadius: 16,
                            padding: "1.5rem",
                        }}>
                            <div style={{ fontSize: "1.8rem", marginBottom: "0.75rem" }}>{card.icon}</div>
                            <div style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "0.25rem" }}>{card.value}</div>
                            <div style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>{card.label}</div>
                        </div>
                    ))}
                </div>

                <div style={{
                    marginTop: "2.5rem", padding: "1.5rem",
                    background: "var(--color-surface)", border: "1px solid var(--color-border)",
                    borderRadius: 16,
                }}>
                    <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", margin: 0 }}>
                        📌 <strong style={{ color: "var(--color-text)" }}>Account:</strong>{" "}
                        {user.email} · ID {user.user_id} · Auth via <em>{user.auth_provider}</em>
                    </p>
                </div>
            </main>
        </div>
    );
}
