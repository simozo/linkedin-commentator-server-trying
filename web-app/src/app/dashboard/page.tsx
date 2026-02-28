"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "./components/DashboardNav";
import styles from "./dashboard.module.css";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:4000";
const AUTH_LOGIN_URL = process.env.NEXT_PUBLIC_AUTH_LOGIN_URL || "http://localhost:4000/login";
const DASH_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:5001";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface User { user_id: number; email: string; full_name?: string; avatar_url?: string; auth_provider: string; }
interface Stats { posts_analyzed: number; comments_generated: number; people_reached: number; usage_days: number; connections: number; }
interface Usage { tier: string; comments_today: number; daily_limit: number; graph_maturity: number; nodes_count: number; target_nodes_count: number; is_limit_reached: boolean; }
interface ActivityItem { post_urn: string; post_url: string; author_name: string; author_slug: string; action: string; post_text: string; timestamp: string; }
interface BridgeTarget { target_name: string; target_slug: string; bridge_name: string; bridge_slug: string; shared_post_urn: string; post_text: string; path_strength: number; }

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const actionLabel: Record<string, string> = {
    post_viewed: "Visualizzato", comment_generated: "Commentato",
    post_saved: "Salvato", post_ignored: "Saltato",
};
const actionColor: Record<string, string> = {
    post_viewed: "#3b82f6", comment_generated: "#10b981",
    post_saved: "#f59e0b", post_ignored: "#64748b",
};

function apiFetch<T>(path: string): Promise<T> {
    return fetch(`${DASH_URL}${path}`, { credentials: "include" }).then(r => r.json());
}

function fmtDate(ts: string) {
    if (!ts) return "—";
    try {
        const date = new Date(ts);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 60) return `${diffMins}m fa`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h fa`;

        return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
    }
    catch { return ts; }
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, color, delay }: { icon: string; label: string; value: number | string; color: string; delay: number }) {
    return (
        <div className={styles.statCard} style={{ animationDelay: `${delay}ms` }}>
            <div className={styles.statIcon}>{icon}</div>
            <div className={styles.statLabel}>{label}</div>
            <div className={styles.statValue} style={{ color }}>{value ?? "—"}</div>
        </div>
    );
}

function ActivityRow({ item }: { item: ActivityItem }) {
    const color = actionColor[item.action] || "#64748b";
    const label = actionLabel[item.action] || item.action;
    return (
        <div className={styles.activityRow}>
            <div className={styles.dot} style={{ background: color }} />
            <div className={styles.activityContent}>
                <div className={styles.activityMeta}>
                    <span className={styles.author}>{item.author_name || "—"}</span>
                    <span className={styles.badge} style={{ color, background: `${color}12` }}>{label}</span>
                </div>
                <div className={styles.snippet}>
                    {item.post_text?.slice(0, 100) || "—"}
                </div>
            </div>
            <div className={styles.timestamp}>
                {fmtDate(item.timestamp)}
            </div>
        </div>
    );
}

function BridgeCard({ t }: { t: BridgeTarget }) {
    return (
        <div className={styles.bridgeCard}>
            <div className={styles.bridgeTarget}>
                <span className={styles.targetName}>{t.target_name || t.target_slug || "—"}</span>
                <span className={styles.strength}>
                    {t.path_strength}
                </span>
            </div>
            <div className={styles.bridgePath}>
                🌉 via <strong>{t.bridge_name || t.bridge_slug}</strong>
            </div>
            {t.post_text && (
                <div className={styles.snippet} style={{ marginTop: "0.5rem", fontStyle: "italic" }}>
                    "{t.post_text.slice(0, 80)}..."
                </div>
            )}
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function DashboardPage() {
    const [user, setUser] = useState<User | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [bridges, setBridges] = useState<BridgeTarget[]>([]);
    const [usage, setUsage] = useState<Usage | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${AUTH_URL}/me`, { credentials: "include" })
            .then(res => {
                if (!res.ok) { window.location.href = AUTH_LOGIN_URL; return null; }
                return res.json();
            })
            .then((u: User | null) => {
                if (!u) return;
                setUser(u);
                Promise.all([
                    apiFetch<Stats>("/api/stats").then(setStats).catch(() => { }),
                    apiFetch<ActivityItem[]>("/api/activity?limit=5").then(setActivity).catch(() => { }),
                    apiFetch<BridgeTarget[]>("/api/bridge-targets").then(setBridges).catch(() => { }),
                    apiFetch<Usage>("/api/user/usage").then(setUsage).catch(() => { }),
                ]).finally(() => setLoading(false));
            })
            .catch(() => { window.location.href = AUTH_LOGIN_URL; });
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
                {/* Header */}
                <header className={styles.header}>
                    <h1 className={styles.title}>
                        Bentornato, {user.full_name?.split(" ")[0] || "utente"}
                        {user.tier && <span className={styles.tierBadge}>{user.tier.toUpperCase()}</span>}
                    </h1>
                    <p className={styles.subtitle}>
                        {stats ? `${stats.usage_days} giorni di attività · Dati aggiornati in tempo reale` : "Caricamento statistiche..."}
                    </p>
                </header>

                {/* Stats */}
                <div className={styles.statsGrid}>
                    <StatCard icon="📈" label="Post analizzati" value={stats?.posts_analyzed ?? "—"} color="var(--accent-blue)" delay={100} />
                    <StatCard icon="✨" label="Commenti oggi" value={usage ? `${usage.comments_today}/${usage.daily_limit}` : (stats?.comments_generated ?? "—")} color="var(--color-success)" delay={200} />
                    <div className={styles.statCard} style={{ animationDelay: '300ms', border: '1px solid var(--accent-blue-20)' }}>
                        <div className={styles.statIcon}>🕸️</div>
                        <div className={styles.statLabel}>Maturità Grafo</div>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', marginTop: '8px', overflow: 'hidden' }}>
                            <div style={{ width: `${(usage?.graph_maturity || 0) * 100}%`, height: '100%', background: 'var(--accent-blue)', transition: 'width 1s ease-out' }} />
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {Math.floor((usage?.graph_maturity || 0) * 100)}% attivato
                        </div>
                    </div>
                    <StatCard icon="⚡" label="Daily Streak" value={stats?.usage_days ?? "—"} color="#f59e0b" delay={400} />
                </div>

                {/* Two-column layout */}
                <div className={styles.mainGrid}>
                    {/* Activity Feed */}
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Attività Recente</h2>
                            <Link href="/dashboard/activity" className={styles.viewAll}>
                                Vedi tutto
                            </Link>
                        </div>
                        {activity.length === 0 ? (
                            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", textAlign: "center", padding: "2rem 0" }}>
                                Nessuna attività registrata. Avvia l'estensione su LinkedIn per iniziare.
                            </p>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                {activity.map((item, i) => <ActivityRow key={i} item={item} />)}
                            </div>
                        )}
                    </div>

                    {/* Warm Reach preview */}
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>🌉 Warm Reach Map</h2>
                            <Link href="/dashboard/reach" className={styles.viewAll} style={{ color: "var(--color-success)", background: "rgba(16, 185, 129, 0.08)" }}>
                                Mappa
                            </Link>
                        </div>
                        {bridges.length === 0 ? (
                            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", textAlign: "center", padding: "2rem 0" }}>
                                La tua rete di ponti si sta caricando. Continua a navigare su LinkedIn!
                            </p>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                {bridges.slice(0, 4).map((t, i) => <BridgeCard key={i} t={t} />)}
                                {bridges.length > 4 && (
                                    <Link href="/dashboard/reach" style={{ fontSize: "0.8125rem", color: "var(--text-muted)", textAlign: "center", textDecoration: "none", display: "block", marginTop: "1rem", fontWeight: 600 }}>
                                        + esplora altri {bridges.length - 4} percorsi
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Account info footer */}
                <footer className={styles.footer}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-success)" }} />
                    <p style={{ margin: 0 }}>
                        Connesso come <strong>{user.email}</strong> via {user.auth_provider}
                    </p>
                </footer>
            </main>
        </div>
    );
}
