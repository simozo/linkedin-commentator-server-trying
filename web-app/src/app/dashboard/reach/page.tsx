"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "../components/DashboardNav";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:4000";
const AUTH_LOGIN_URL = process.env.NEXT_PUBLIC_AUTH_LOGIN_URL || "http://localhost:4000/login";
const DASH_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:5001";

interface User { user_id: number; email: string; full_name?: string; avatar_url?: string; auth_provider: string; }
interface BridgeTarget {
    target_name: string; target_slug: string;
    bridge_name: string; bridge_slug: string;
    shared_post_urn: string; post_text: string;
    path_strength: number;
}

function strengthColor(s: number) {
    if (s >= 3) return "#10b981";
    if (s >= 2) return "#f59e0b";
    return "#6b7280";
}

export default function ReachPage() {
    const [user, setUser] = useState<User | null>(null);
    const [bridges, setBridges] = useState<BridgeTarget[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<BridgeTarget | null>(null);

    useEffect(() => {
        fetch(`${AUTH_URL}/me`, { credentials: "include" })
            .then(r => { if (!r.ok) { window.location.href = AUTH_LOGIN_URL; return null; } return r.json(); })
            .then((u: User | null) => {
                if (!u) return;
                setUser(u);
                fetch(`${DASH_URL}/api/bridge-targets`, { credentials: "include" })
                    .then(r => r.json()).then(setBridges).finally(() => setLoading(false));
            }).catch(() => { window.location.href = AUTH_LOGIN_URL; });
    }, []);

    if (loading) {
        return (
            <>
                <DashboardNav userName="…" />
                <div className="auth-wrapper"><div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} /></div>
            </>
        );
    }

    return (
        <div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font)" }}>
            <DashboardNav userName={user?.full_name || user?.email} avatarUrl={user?.avatar_url} />

            <main style={{ maxWidth: 1040, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "2rem" }}>
                    <div>
                        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "0.25rem" }}>
                            🌉 Warm Reach Map
                        </h1>
                        <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", margin: 0, maxWidth: 520 }}>
                            Persone che puoi raggiungere in modo caldo attraverso co-commenters condivisi.
                            Clicca su un target per vedere il percorso completo e generare un commento bridge.
                        </p>
                    </div>
                    <Link href="/dashboard" style={{
                        fontSize: "0.8rem", color: "var(--color-muted)", textDecoration: "none",
                        padding: "0.35rem 0.85rem", border: "1px solid var(--color-border)", borderRadius: 20, whiteSpace: "nowrap",
                    }}>
                        ← Overview
                    </Link>
                </div>

                {bridges.length === 0 ? (
                    <div style={{
                        background: "var(--color-surface)", border: "1px solid var(--color-border)",
                        borderRadius: 16, padding: "3rem", textAlign: "center",
                    }}>
                        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🌱</div>
                        <h2 style={{ fontWeight: 600, fontSize: "1.1rem", marginBottom: "0.5rem" }}>Il grafo si sta costruendo</h2>
                        <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", maxWidth: 380, margin: "0 auto" }}>
                            Continua a usare il plugin su LinkedIn. Man mano che il Co-pilot analizza post e co-commenters,
                            la mappa si arricchirà di percorsi bridge.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 360px" : "1fr", gap: "1.25rem", transition: "all 0.2s" }}>

                        {/* Cards grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.85rem", alignContent: "start" }}>
                            {bridges.map((t, i) => {
                                const isSelected = selected?.target_slug === t.target_slug;
                                const color = strengthColor(t.path_strength);
                                return (
                                    <button key={i} onClick={() => setSelected(isSelected ? null : t)} style={{
                                        background: "var(--color-surface)",
                                        border: `1px solid ${isSelected ? "#3b82f6" : "var(--color-border)"}`,
                                        borderRadius: 14, padding: "1.1rem 1.25rem",
                                        cursor: "pointer", textAlign: "left",
                                        boxShadow: isSelected ? "0 0 0 2px #3b82f622" : "none",
                                        transition: "all 0.15s", width: "100%",
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                                            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--color-text)" }}>
                                                {t.target_name || t.target_slug || "—"}
                                            </span>
                                            <span style={{ fontSize: "0.7rem", color, background: `${color}22`, borderRadius: 20, padding: "0.15rem 0.5rem", flexShrink: 0 }}>
                                                forza {t.path_strength}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: "0.78rem", color: "var(--color-muted)", marginBottom: "0.4rem" }}>
                                            🌉 via <strong style={{ color: "var(--color-text)" }}>{t.bridge_name || t.bridge_slug}</strong>
                                        </div>
                                        {t.post_text && (
                                            <div style={{
                                                fontSize: "0.73rem", color: "var(--color-muted)", fontStyle: "italic",
                                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                            }}>
                                                "{t.post_text.slice(0, 90)}"
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Detail panel */}
                        {selected && (
                            <div style={{
                                background: "var(--color-surface)", border: "1px solid #3b82f644",
                                borderRadius: 16, padding: "1.5rem", alignSelf: "start",
                                position: "sticky", top: 72,
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
                                    <h3 style={{ fontWeight: 700, fontSize: "1rem", margin: 0 }}>Percorso Bridge</h3>
                                    <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", fontSize: "1.1rem", padding: 0 }}>✕</button>
                                </div>

                                {/* Path visualization */}
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.25rem" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#3b82f622", border: "2px solid #3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>
                                            👤
                                        </div>
                                        <div>
                                            <div style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Tu</div>
                                            <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{user?.full_name || user?.email}</div>
                                        </div>
                                    </div>
                                    <div style={{ paddingLeft: 17, borderLeft: "2px dashed var(--color-border)", marginLeft: 17, paddingTop: 2, paddingBottom: 2 }}>
                                        <div style={{ fontSize: "0.73rem", color: "var(--color-muted)", fontStyle: "italic" }}>
                                            entrambi commentate su:
                                        </div>
                                        {selected.post_text && (
                                            <div style={{ fontSize: "0.73rem", color: "var(--color-muted)", marginTop: "0.2rem" }}>
                                                "{selected.post_text.slice(0, 100)}…"
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f59e0b22", border: "2px solid #f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>
                                            🌉
                                        </div>
                                        <div>
                                            <div style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Bridge Person</div>
                                            <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{selected.bridge_name || selected.bridge_slug}</div>
                                            {selected.bridge_slug && (
                                                <a href={`https://linkedin.com/in/${selected.bridge_slug}`} target="_blank" rel="noopener noreferrer"
                                                    style={{ fontSize: "0.7rem", color: "#3b82f6", textDecoration: "none" }}>
                                                    Vai al profilo →
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ paddingLeft: 17, borderLeft: "2px dashed var(--color-border)", marginLeft: 17, paddingTop: 2, paddingBottom: 2 }}>
                                        <div style={{ fontSize: "0.73rem", color: "var(--color-muted)", fontStyle: "italic" }}>
                                            ha commentato insieme a:
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#10b98122", border: "2px solid #10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>
                                            🎯
                                        </div>
                                        <div>
                                            <div style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>Target</div>
                                            <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{selected.target_name || selected.target_slug}</div>
                                            {selected.target_slug && (
                                                <a href={`https://linkedin.com/in/${selected.target_slug}`} target="_blank" rel="noopener noreferrer"
                                                    style={{ fontSize: "0.7rem", color: "#3b82f6", textDecoration: "none" }}>
                                                    Vai al profilo →
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Action */}
                                <div style={{
                                    background: "#3b82f608", border: "1px solid #3b82f622",
                                    borderRadius: 12, padding: "0.9rem", fontSize: "0.78rem",
                                    color: "var(--color-muted)", lineHeight: 1.5, marginBottom: "1rem",
                                }}>
                                    💡 <strong style={{ color: "var(--color-text)" }}>Azione suggerita:</strong> Commenta il post condiviso
                                    con <strong>{selected.bridge_name || selected.bridge_slug}</strong> menzionando un insight rilevante.
                                    Questo renderà visibile il tuo nome a <strong>{selected.target_name || selected.target_slug}</strong>.
                                </div>

                                {selected.shared_post_urn && (
                                    <a href={`https://linkedin.com/feed/update/${selected.shared_post_urn}`}
                                        target="_blank" rel="noopener noreferrer" style={{
                                            display: "block", textAlign: "center",
                                            padding: "0.6rem", borderRadius: 10,
                                            background: "linear-gradient(135deg, #3b82f6, #0ea5e9)",
                                            color: "white", textDecoration: "none",
                                            fontSize: "0.82rem", fontWeight: 600,
                                        }}>
                                        Apri il post bridge →
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
