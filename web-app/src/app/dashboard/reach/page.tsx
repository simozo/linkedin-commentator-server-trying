"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "../components/DashboardNav";
import styles from "../dashboard.module.css";

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
    return "#64748b";
}

export default function ReachPage() {
    const [user, setUser] = useState<User | null>(null);
    const [bridges, setBridges] = useState<BridgeTarget[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<BridgeTarget | null>(null);
    const [suggestion, setSuggestion] = useState<{ strategy: string; reasoning: string } | null>(null);
    const [loadingSuggestion, setLoadingSuggestion] = useState(false);

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

    useEffect(() => {
        if (!selected) {
            setSuggestion(null);
            return;
        }

        setLoadingSuggestion(true);
        fetch(`${DASH_URL}/api/ai/orbiting-suggestion?target=${selected.target_slug}`, { credentials: "include" })
            .then(r => r.json())
            .then(data => {
                if (data.strategy) {
                    setSuggestion({ strategy: data.strategy, reasoning: data.reasoning });
                }
            })
            .finally(() => setLoadingSuggestion(false));
    }, [selected]);

    if (loading) {
        return (
            <div className="auth-wrapper" style={{ background: "var(--bg-light)" }}>
                <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, borderTopColor: "var(--accent-blue)" }} />
            </div>
        );
    }

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-light)" }}>
            <DashboardNav userName={user?.full_name || user?.email} avatarUrl={user?.avatar_url} />

            <main className={styles.container}>
                {/* Header */}
                <header className={styles.header}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                        <div>
                            <h1 className={styles.title}>
                                🌉 Warm Reach Map
                            </h1>
                            <p className={styles.subtitle} style={{ maxWidth: 520 }}>
                                Persone che puoi raggiungere in modo caldo attraverso co-commenters condivisi.
                                Clicca su un target per vedere il percorso completo e generare un commento bridge.
                            </p>
                        </div>
                        <Link href="/dashboard" className={styles.viewAll} style={{ background: "#fff", border: "1px solid var(--border-soft)", color: "var(--text-muted)" }}>
                            ← Dashboard
                        </Link>
                    </div>
                </header>

                {bridges.length === 0 ? (
                    <div className={styles.section} style={{ padding: "4rem 2rem", textAlign: "center" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "1.5rem" }}>🌱</div>
                        <h2 className={styles.sectionTitle} style={{ marginBottom: "1rem" }}>Il grafo si sta costruendo</h2>
                        <p className={styles.snippet} style={{ maxWidth: 400, margin: "0 auto" }}>
                            Continua a usare il plugin su LinkedIn. Man mano che il Co-pilot analizza post e co-commenters,
                            la mappa si arricchirà di percorsi bridge.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: "2rem", transition: "all 0.3s ease" }}>

                        {/* Cards grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem", alignContent: "start" }}>
                            {bridges.map((t, i) => {
                                const isSelected = selected?.target_slug === t.target_slug;
                                const color = strengthColor(t.path_strength);
                                return (
                                    <button key={i} onClick={() => setSelected(isSelected ? null : t)} className={styles.bridgeCard} style={{
                                        border: isSelected ? "1px solid var(--accent-blue)" : "1px solid var(--border-soft)",
                                        boxShadow: isSelected ? "0 8px 20px rgba(37, 99, 235, 0.1)" : "none",
                                        transform: isSelected ? "translateY(-4px)" : "none",
                                        width: "100%",
                                        background: isSelected ? "#fff" : "var(--glass-white)"
                                    }}>
                                        <div className={styles.bridgeTarget}>
                                            <span className={styles.targetName}>
                                                {t.target_name || t.target_slug || "—"}
                                            </span>
                                            <span className={styles.badge} style={{ color, background: `${color}12` }}>
                                                forza {t.path_strength}
                                            </span>
                                        </div>
                                        <div className={styles.bridgePath}>
                                            🌉 via <strong>{t.bridge_name || t.bridge_slug}</strong>
                                        </div>
                                        {t.post_text && (
                                            <div className={styles.snippet} style={{ marginTop: "0.75rem", fontStyle: "italic" }}>
                                                "{t.post_text.slice(0, 90)}..."
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Detail panel */}
                        {selected && (
                            <aside style={{ alignSelf: "start", position: "sticky", top: "100px" }}>
                                <div className={styles.section} style={{ border: "1px solid var(--accent-soft)", boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
                                        <h3 className={styles.sectionTitle} style={{ fontSize: "1.1rem" }}>Percorso Bridge</h3>
                                        <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.25rem", padding: 0 }}>✕</button>
                                    </div>

                                    {/* Path visualization */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent-soft)", border: "2px solid var(--accent-blue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
                                                👤
                                            </div>
                                            <div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Tu</div>
                                                <div className={styles.author}>{user?.full_name || user?.email}</div>
                                            </div>
                                        </div>

                                        <div style={{ paddingLeft: 19, borderLeft: "2px dashed var(--border-soft)", marginLeft: 19, padding: "0.5rem 0 0.5rem 1.5rem" }}>
                                            <div className={styles.snippet} style={{ fontSize: "0.75rem" }}>
                                                entrambi commentate su:
                                            </div>
                                            {selected.post_text && (
                                                <div className={styles.snippet} style={{ marginTop: "0.25rem", color: "var(--text-main)" }}>
                                                    "{selected.post_text.slice(0, 100)}…"
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(245, 158, 11, 0.1)", border: "2px solid #f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
                                                🌉
                                            </div>
                                            <div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Bridge Person</div>
                                                <div className={styles.author}>{selected.bridge_name || selected.bridge_slug}</div>
                                                {selected.bridge_slug && (
                                                    <a href={`https://linkedin.com/in/${selected.bridge_slug}`} target="_blank" rel="noopener noreferrer"
                                                        style={{ fontSize: "0.75rem", color: "var(--accent-blue)", textDecoration: "none", fontWeight: 600 }}>
                                                        Profilo →
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{ paddingLeft: 19, borderLeft: "2px dashed var(--border-soft)", marginLeft: 19, padding: "0.5rem 0 0.5rem 1.5rem" }}>
                                            <div className={styles.snippet} style={{ fontSize: "0.75rem" }}>
                                                ha commentato insieme a:
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(16, 185, 129, 0.1)", border: "2px solid #10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
                                                🎯
                                            </div>
                                            <div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Target</div>
                                                <div className={styles.author} style={{ fontSize: "1rem" }}>{selected.target_name || selected.target_slug}</div>
                                                {selected.target_slug && (
                                                    <a href={`https://linkedin.com/in/${selected.target_slug}`} target="_blank" rel="noopener noreferrer"
                                                        style={{ fontSize: "0.75rem", color: "var(--accent-blue)", textDecoration: "none", fontWeight: 600 }}>
                                                        Profilo →
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action */}
                                    <div style={{
                                        background: "var(--accent-soft)", border: "1px solid var(--accent-blue)", borderRadius: 12, padding: "1.25rem", fontSize: "0.875rem", color: "var(--text-main)", lineHeight: 1.5, marginBottom: "1.5rem"
                                    }}>
                                        <div style={{ fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <span>{loadingSuggestion ? "⏳" : "💡"}</span> {loadingSuggestion ? "Analisi AI in corso..." : "Azione suggerita (AI)"}
                                        </div>

                                        {loadingSuggestion ? (
                                            <div style={{ height: 40, display: "flex", alignItems: "center" }}>
                                                <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                                            </div>
                                        ) : suggestion ? (
                                            <>
                                                <p style={{ marginBottom: "0.75rem" }}>{suggestion.strategy}</p>
                                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", borderTop: "1px solid var(--border-soft)", paddingTop: "0.5rem", marginTop: "0.5rem", fontStyle: "italic" }}>
                                                    <strong>Perché:</strong> {suggestion.reasoning}
                                                </div>
                                            </>
                                        ) : (
                                            <p>Seleziona un target per generare una strategia di avvicinamento personalizzata tramite AI.</p>
                                        )}
                                    </div>

                                    {selected.shared_post_urn && (
                                        <a href={`https://linkedin.com/feed/update/${selected.shared_post_urn}`}
                                            target="_blank" rel="noopener noreferrer" style={{
                                                display: "block", textAlign: "center", padding: "1rem", borderRadius: 12, background: "var(--accent-blue)", color: "white", textDecoration: "none", fontSize: "0.9rem", fontWeight: 700, transition: "all 0.2s ease", boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)"
                                            }}>
                                            Apri post bridge →
                                        </a>
                                    )}
                                </div>
                            </aside>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
