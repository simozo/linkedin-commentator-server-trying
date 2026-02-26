"use client";

import { useEffect, useState } from "react";
import DashboardNav from "../components/DashboardNav";
import styles from "../dashboard.module.css";
import Link from "next/link";

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

    if (loading) {
        return (
            <div className="auth-wrapper" style={{ background: "var(--bg-light)" }}>
                <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, borderTopColor: "var(--accent-blue)" }} />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-light)" }}>
            <DashboardNav userName={user.full_name || user.email} avatarUrl={user.avatar_url} />

            <main className={styles.container}>
                <header className={styles.header}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                            <h1 className={styles.title}>Analisi del Network</h1>
                            <p className={styles.subtitle}>
                                {total} contatti scansionati · Approfondisci la composizione del tuo network professionale.
                            </p>
                        </div>
                        <Link href="/dashboard" className={styles.viewAll} style={{ background: "#fff", border: "1px solid var(--border-soft)", color: "var(--text-muted)" }}>
                            ← Dashboard
                        </Link>
                    </div>
                </header>

                <div className={styles.mainGrid}>
                    {/* List */}
                    <div className={styles.section} style={{ padding: 0 }}>
                        <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid var(--border-soft)" }}>
                            <h2 className={styles.sectionTitle}>Contatti Recenti</h2>
                        </div>
                        <div style={{ overflow: "hidden" }}>
                            {connections.length === 0 ? (
                                <p style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>Nessun contatto trovato.</p>
                            ) : (
                                connections.map((c, i) => (
                                    <div key={i} className={styles.activityRow} style={{ padding: "1.25rem 2rem" }}>
                                        <div style={{ flex: 1 }}>
                                            <div className={styles.author}>{c.name}</div>
                                            <div className={styles.snippet} style={{ maxWidth: "100%" }}>
                                                {c.headline}
                                            </div>
                                        </div>
                                        <div className={styles.timestamp}>{c.connected_at}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Insights & Overlap */}
                    <aside style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle} style={{ marginBottom: "1rem" }}>Insights Network</h2>
                            <p className={styles.snippet} style={{ marginBottom: "1.5rem" }}>
                                Distribuzione dei ruoli identificati nelle headline.
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                                {insights.map((insight, i) => {
                                    const percentage = Math.round((insight.count / total) * 100);
                                    return (
                                        <div key={i}>
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                                                <span style={{ color: "var(--text-main)" }}>{insight.role}</span>
                                                <span style={{ color: "var(--text-muted)" }}>{insight.count}</span>
                                            </div>
                                            <div style={{ height: 8, background: "var(--bg-light)", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-soft)" }}>
                                                <div style={{
                                                    height: "100%",
                                                    width: `${Math.min(100, percentage)}%`,
                                                    background: "var(--accent-blue)",
                                                    borderRadius: 10,
                                                    transition: "width 1s ease-out"
                                                }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle} style={{ marginBottom: "1rem" }}>🤝 Alleati</h2>
                            <p className={styles.snippet} style={{ marginBottom: "1.5rem" }}>
                                Persone che interagiscono spesso con gli stessi post che analizzi.
                            </p>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                {overlaps.length === 0 ? (
                                    <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", textAlign: "center", padding: "1rem 0" }}>Analizza più post per trovare alleati.</p>
                                ) : (
                                    overlaps.map((o, i) => (
                                        <div key={i} style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "0.75rem 0",
                                            borderBottom: i === overlaps.length - 1 ? "none" : "1px solid var(--border-soft)"
                                        }}>
                                            <div className={styles.author} style={{ fontSize: "0.875rem" }}>{o.name}</div>
                                            <span className={styles.badge} style={{ color: "#10b981", background: "rgba(16, 185, 129, 0.08)" }}>
                                                {o.overlap_count} post
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
}
