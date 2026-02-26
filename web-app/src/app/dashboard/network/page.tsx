"use client";

import { useEffect, useState } from "react";
import DashboardNav from "../components/DashboardNav";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:4000";
const AUTH_LOGIN_URL = process.env.NEXT_PUBLIC_AUTH_LOGIN_URL || "http://localhost:4000/login";
const DASH_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:5001";

interface User { user_id: number; email: string; full_name?: string; avatar_url?: string; }
interface Connection { name: string; slug: string; headline: string; connected_at: string; }
interface Insight { role: string; count: number; }
interface Overlap { name: string; slug: string; overlap_count: number; }

export default function NetworkPage() {
    const [user, setUser] = useState<User | null>(null);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [insights, setInsights] = useState<Insight[]>([]);
    const [overlaps, setOverlaps] = useState<Overlap[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${AUTH_URL}/me`, { credentials: "include" })
            .then(res => {
                if (!res.ok) { window.location.href = AUTH_LOGIN_URL; return null; }
                return res.json();
            })
            .then(u => {
                if (!u) return;
                setUser(u);
                return Promise.all([
                    fetch(`${DASH_URL}/api/connections/stats`, { credentials: "include" }).then(r => r.json()),
                    fetch(`${DASH_URL}/api/connections/list?limit=50`, { credentials: "include" }).then(r => r.json()),
                    fetch(`${DASH_URL}/api/connections/insights`, { credentials: "include" }).then(r => r.json()),
                    fetch(`${DASH_URL}/api/connections/overlap`, { credentials: "include" }).then(r => r.json())
                ]);
            })
            .then((data: any) => {
                if (!data) return;
                setTotal(data[0]?.total || 0);
                setConnections(Array.isArray(data[1]) ? data[1] : []);
                setInsights(Array.isArray(data[2]) ? data[2] : []);
                setOverlaps(Array.isArray(data[3]) ? data[3] : []);
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="auth-wrapper"><div className="spinner" /></div>;
    if (!user) return null;

    return (
        <div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font)" }}>
            <DashboardNav userName={user.full_name || user.email} avatarUrl={user.avatar_url} />

            <main style={{ maxWidth: 1040, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
                <div style={{ marginBottom: "2.5rem" }}>
                    <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Rete di Collegamento</h1>
                    <p style={{ color: "var(--color-muted)", margin: 0 }}>
                        {total} contatti scansionati · Approfondisci la composizione del tuo network professionale.
                    </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "2rem" }}>
                    {/* List */}
                    <section>
                        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>Contatti Recenti</h2>
                        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 16, overflow: "hidden" }}>
                            {connections.length === 0 ? (
                                <p style={{ padding: "2rem", textAlign: "center", color: "var(--color-muted)" }}>Nessun contatto trovato.</p>
                            ) : (
                                connections.map((c, i) => (
                                    <div key={i} style={{
                                        padding: "1rem 1.5rem",
                                        borderBottom: i === connections.length - 1 ? "none" : "1px solid var(--color-border)",
                                        display: "flex", justifyContent: "space-between", alignItems: "center"
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{c.name}</div>
                                            <div style={{ fontSize: "0.8rem", color: "var(--color-muted)", maxWidth: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {c.headline}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>{c.connected_at}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    {/* Insights & Overlap */}
                    <aside style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                        <div>
                            <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>Insights Network</h2>
                            <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 16, padding: "1.5rem" }}>
                                <div style={{ fontSize: "0.85rem", color: "var(--color-muted)", marginBottom: "1.5rem" }}>
                                    Distribuzione dei ruoli identificati nelle headline.
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                    {insights.map((insight, i) => {
                                        const percentage = Math.round((insight.count / total) * 100);
                                        return (
                                            <div key={i}>
                                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.4rem" }}>
                                                    <span style={{ fontWeight: 600 }}>{insight.role}</span>
                                                    <span style={{ color: "var(--color-muted)" }}>{insight.count}</span>
                                                </div>
                                                <div style={{ height: 6, background: "var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
                                                    <div style={{ height: "100%", width: `${Math.min(100, percentage)}%`, background: "linear-gradient(90deg, #3b82f6, #60a5fa)", borderRadius: 10 }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div>
                            <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>🤝 Alleati (Peer Overlap)</h2>
                            <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 16, padding: "1.5rem" }}>
                                <div style={{ fontSize: "0.85rem", color: "var(--color-muted)", marginBottom: "1rem" }}>
                                    Persone che interagiscono spesso con gli stessi post che analizzi.
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                                    {overlaps.length === 0 ? (
                                        <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", textAlign: "center" }}>Analizza più post per trovare alleati.</p>
                                    ) : (
                                        overlaps.map((o, i) => (
                                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: i === overlaps.length - 1 ? "none" : "1px solid var(--color-border)" }}>
                                                <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{o.name}</div>
                                                <div style={{ fontSize: "0.75rem", color: "#10b981", background: "#10b98122", borderRadius: 20, padding: "0.1rem 0.6rem" }}>
                                                    {o.overlap_count} post
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
}
