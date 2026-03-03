"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardNav from "../components/DashboardNav";
import styles from "../dashboard.module.css";
import Link from "next/link";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:4000";
const AUTH_LOGIN_URL = process.env.NEXT_PUBLIC_AUTH_LOGIN_URL || "http://localhost:4000/login";
const DASH_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:5001";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface User { user_id: number; email: string; full_name?: string; avatar_url?: string; }
interface BridgeTarget { target_name: string; target_slug: string; bridge_name: string; bridge_slug: string; post_text: string; path_strength: number; }
interface Connection { name: string; slug: string; headline: string; connected_at: string; }
interface Insight { role: string; count: number; }
interface Overlap { name: string; slug: string; overlap_count: number; }
interface TrendPost { authorName: string; authorSlug: string; }
interface Trend { name: string; count: number; posts: TrendPost[]; }
interface OrbitingResult { targetName: string; bridgeName: string; strategy: string; reasoning: string; }

/* ─── Derived types ──────────────────────────────────────────────────────── */
interface GatewayContact {
    bridge_name: string;
    bridge_slug: string;
    targets: { name: string; slug: string }[];
    max_strength: number;
}

interface TopicLeader {
    name: string;
    slug: string;
    topics: string[];
}

/* ─── Data builders ──────────────────────────────────────────────────────── */
function buildGatewayContacts(bridges: BridgeTarget[]): GatewayContact[] {
    const map = new Map<string, GatewayContact>();
    bridges.forEach(b => {
        if (!b.bridge_slug) return;
        if (!map.has(b.bridge_slug)) {
            map.set(b.bridge_slug, {
                bridge_name: b.bridge_name || b.bridge_slug,
                bridge_slug: b.bridge_slug,
                targets: [],
                max_strength: 0,
            });
        }
        const gc = map.get(b.bridge_slug)!;
        if (b.target_slug && !gc.targets.find(t => t.slug === b.target_slug)) {
            gc.targets.push({ name: b.target_name || b.target_slug, slug: b.target_slug });
        }
        gc.max_strength = Math.max(gc.max_strength, b.path_strength);
    });
    return [...map.values()].sort((a, b) => b.targets.length - a.targets.length);
}

function buildTopicLeaders(trends: Trend[]): TopicLeader[] {
    const map = new Map<string, TopicLeader>();
    trends.forEach(trend => {
        (trend.posts || []).forEach(post => {
            if (!post.authorSlug || post.authorSlug === "unknown") return;
            if (!map.has(post.authorSlug)) {
                map.set(post.authorSlug, { name: post.authorName || post.authorSlug, slug: post.authorSlug, topics: [] });
            }
            const leader = map.get(post.authorSlug)!;
            if (!leader.topics.includes(trend.name)) leader.topics.push(trend.name);
        });
    });
    return [...map.values()]
        .filter(l => l.topics.length > 0)
        .sort((a, b) => b.topics.length - a.topics.length)
        .slice(0, 8);
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */
function GatewayCard({
    contact,
    onAskStrategy,
    orbitingState,
}: {
    contact: GatewayContact;
    onAskStrategy: (bridgeSlug: string, targetSlug: string) => void;
    orbitingState: OrbitingResult | "loading" | "error" | undefined;
}) {
    const SHOW = 3;
    const extra = contact.targets.length - SHOW;
    const firstTarget = contact.targets[0];

    return (
        <div style={{
            background: "#fff",
            border: "1px solid var(--border-soft)",
            borderRadius: 12,
            padding: "1.25rem 1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.875rem",
        }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                        🌉
                    </div>
                    <div>
                        <a
                            href={`https://www.linkedin.com/in/${contact.bridge_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-main)", textDecoration: "none" }}
                        >
                            {contact.bridge_name}
                        </a>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                            Bridge contact · forza {contact.max_strength}
                        </div>
                    </div>
                </div>
                <span style={{
                    fontSize: "0.75rem", fontWeight: 800,
                    background: "rgba(245,158,11,0.12)", color: "#b45309",
                    padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0,
                }}>
                    sblocca {contact.targets.length} target
                </span>
            </div>

            {/* Targets */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {contact.targets.slice(0, SHOW).map(t => (
                    <a
                        key={t.slug}
                        href={`https://www.linkedin.com/in/${t.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            fontSize: "0.75rem", padding: "3px 10px", borderRadius: 20,
                            background: "var(--bg-light)", border: "1px solid var(--border-soft)",
                            color: "var(--text-main)", textDecoration: "none",
                            transition: "border-color 0.15s",
                        }}
                    >
                        {t.name || t.slug}
                    </a>
                ))}
                {extra > 0 && (
                    <span style={{ fontSize: "0.75rem", padding: "3px 10px", borderRadius: 20, color: "var(--text-muted)", background: "var(--bg-light)", border: "1px solid var(--border-soft)" }}>
                        +{extra} altri
                    </span>
                )}
            </div>

            {/* AI Strategy button + result */}
            {firstTarget && (
                <div>
                    {!orbitingState && (
                        <button
                            onClick={() => onAskStrategy(contact.bridge_slug, firstTarget.slug)}
                            style={{
                                fontSize: "0.8125rem", fontWeight: 600, padding: "6px 14px",
                                borderRadius: 8, border: "1px solid var(--accent-blue)",
                                background: "rgba(37,99,235,0.06)", color: "var(--accent-blue)",
                                cursor: "pointer", transition: "background 0.15s",
                            }}
                        >
                            Chiedi strategia AI →
                        </button>
                    )}
                    {orbitingState === "loading" && (
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                            Generando strategia...
                        </div>
                    )}
                    {orbitingState === "error" && (
                        <div style={{ fontSize: "0.8rem", color: "#ef4444" }}>
                            Errore nel generare la strategia. Riprova.
                        </div>
                    )}
                    {orbitingState && orbitingState !== "loading" && orbitingState !== "error" && (
                        <div style={{
                            background: "rgba(37,99,235,0.04)", border: "1px solid rgba(37,99,235,0.15)",
                            borderRadius: 8, padding: "0.875rem 1rem",
                            display: "flex", flexDirection: "column", gap: "0.5rem",
                        }}>
                            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--accent-blue)" }}>
                                Strategia per raggiungere {orbitingState.targetName}
                            </div>
                            <div style={{ fontSize: "0.8125rem", color: "var(--text-main)", lineHeight: 1.55 }}>
                                {orbitingState.strategy}
                            </div>
                            {orbitingState.reasoning && (
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", borderTop: "1px solid rgba(37,99,235,0.1)", paddingTop: "0.5rem", marginTop: "0.25rem" }}>
                                    {orbitingState.reasoning}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function TopicLeaderRow({ leader }: { leader: TopicLeader }) {
    return (
        <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0.875rem 0",
            borderBottom: "1px solid var(--border-soft)",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(16,185,129,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                    ✍️
                </div>
                <div>
                    <a
                        href={`https://www.linkedin.com/in/${leader.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-main)", textDecoration: "none" }}
                    >
                        {leader.name}
                    </a>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: 4 }}>
                        {leader.topics.slice(0, 4).map(t => (
                            <span key={t} style={{ fontSize: "0.7rem", padding: "1px 7px", borderRadius: 10, background: "rgba(16,185,129,0.08)", color: "#065f46", fontWeight: 600 }}>
                                #{t}
                            </span>
                        ))}
                        {leader.topics.length > 4 && (
                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>+{leader.topics.length - 4}</span>
                        )}
                    </div>
                </div>
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", flexShrink: 0, marginLeft: "1rem" }}>
                {leader.topics.length} topic
            </span>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function NetworkPage() {
    const [user, setUser] = useState<User | null>(null);
    const [bridges, setBridges] = useState<BridgeTarget[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [insights, setInsights] = useState<Insight[]>([]);
    const [overlaps, setOverlaps] = useState<Overlap[]>([]);
    const [trends, setTrends] = useState<Trend[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [orbitingMap, setOrbitingMap] = useState<Record<string, OrbitingResult | "loading" | "error">>({});

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
                    fetch(`${DASH_URL}/api/connections/stats`, { credentials: "include" }).then(r => r.json()).catch(() => ({})),
                    fetch(`${DASH_URL}/api/connections/list?limit=50`, { credentials: "include" }).then(r => r.json()).catch(() => []),
                    fetch(`${DASH_URL}/api/connections/insights`, { credentials: "include" }).then(r => r.json()).catch(() => []),
                    fetch(`${DASH_URL}/api/connections/overlap`, { credentials: "include" }).then(r => r.json()).catch(() => []),
                    fetch(`${DASH_URL}/api/bridge-targets`, { credentials: "include" }).then(r => r.json()).catch(() => []),
                    fetch(`${DASH_URL}/api/trends`, { credentials: "include" }).then(r => r.json()).catch(() => []),
                ]);
            })
            .then((data: any) => {
                if (!data) return;
                setTotal(data[0]?.total || 0);
                setConnections(Array.isArray(data[1]) ? data[1] : []);
                setInsights(Array.isArray(data[2]) ? data[2] : []);
                setOverlaps(Array.isArray(data[3]) ? data[3] : []);
                setBridges(Array.isArray(data[4]) ? data[4] : []);
                setTrends(Array.isArray(data[5]) ? data[5] : []);
            })
            .finally(() => setLoading(false));
    }, []);

    const handleAskStrategy = useCallback((bridgeSlug: string, targetSlug: string) => {
        setOrbitingMap(prev => ({ ...prev, [bridgeSlug]: "loading" }));
        fetch(`${DASH_URL}/api/ai/orbiting-suggestion?target=${targetSlug}`, { credentials: "include" })
            .then(r => {
                if (!r.ok) throw new Error("error");
                return r.json();
            })
            .then((result: OrbitingResult) => {
                setOrbitingMap(prev => ({ ...prev, [bridgeSlug]: result }));
            })
            .catch(() => {
                setOrbitingMap(prev => ({ ...prev, [bridgeSlug]: "error" }));
            });
    }, []);

    if (loading) {
        return (
            <div className="auth-wrapper" style={{ background: "var(--bg-light)" }}>
                <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, borderTopColor: "var(--accent-blue)" }} />
            </div>
        );
    }

    if (!user) return null;

    const gatewayContacts = buildGatewayContacts(bridges);
    const topicLeaders = buildTopicLeaders(trends);

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-light)" }}>
            <DashboardNav userName={user.full_name || user.email} avatarUrl={user.avatar_url} />

            <main className={styles.container}>
                <header className={styles.header}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                            <h1 className={styles.title}>Relationship Intelligence</h1>
                            <p className={styles.subtitle}>
                                {total} connessioni · {gatewayContacts.length} gateway attivi · {topicLeaders.length} topic leader identificati
                            </p>
                        </div>
                        <Link href="/dashboard" className={styles.viewAll} style={{ background: "#fff", border: "1px solid var(--border-soft)", color: "var(--text-muted)" }}>
                            ← Dashboard
                        </Link>
                    </div>
                </header>

                {/* Section 1: Contatti Gateway */}
                <div className={styles.section} style={{ marginBottom: "2rem" }}>
                    <div className={styles.sectionHeader}>
                        <div>
                            <h2 className={styles.sectionTitle}>🌉 Contatti Gateway</h2>
                            <p className={styles.snippet} style={{ marginTop: 4 }}>
                                Le persone che sblocca più target raggiungibili. Investi tempo su di loro.
                            </p>
                        </div>
                        {gatewayContacts.length > 0 && (
                            <span className={styles.viewAll}>{gatewayContacts.length} bridge</span>
                        )}
                    </div>

                    {gatewayContacts.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🕸️</div>
                            Nessun percorso bridge ancora. Continua a navigare su LinkedIn per popolare il grafo.
                        </div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1rem" }}>
                            {gatewayContacts.map(contact => (
                                <GatewayCard
                                    key={contact.bridge_slug}
                                    contact={contact}
                                    onAskStrategy={handleAskStrategy}
                                    orbitingState={orbitingMap[contact.bridge_slug]}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Section 2: Topic Leaders */}
                <div className={styles.section} style={{ marginBottom: "2rem" }}>
                    <div className={styles.sectionHeader}>
                        <div>
                            <h2 className={styles.sectionTitle}>✍️ Topic Leader</h2>
                            <p className={styles.snippet} style={{ marginTop: 4 }}>
                                Chi guida le conversazioni nei topic del tuo feed. Commentare i loro post ti posiziona.
                            </p>
                        </div>
                        {topicLeaders.length > 0 && (
                            <span className={styles.viewAll}>{topicLeaders.length} profili</span>
                        )}
                    </div>

                    {topicLeaders.length === 0 ? (
                        <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                            Analizzando i topic del tuo feed...
                        </p>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0 2rem" }}>
                            {topicLeaders.map((leader, i) => (
                                <div key={leader.slug} style={{ borderBottom: i < topicLeaders.length - 1 ? "1px solid var(--border-soft)" : "none" }}>
                                    <TopicLeaderRow leader={leader} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Section 3: two-column — Connections + Insights/Alleati */}
                <div className={styles.mainGrid}>
                    {/* Connections list */}
                    <div className={styles.section} style={{ padding: 0 }}>
                        <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid var(--border-soft)" }}>
                            <h2 className={styles.sectionTitle}>Connessioni Recenti</h2>
                        </div>
                        <div>
                            {connections.length === 0 ? (
                                <p style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                                    Nessun contatto trovato.
                                </p>
                            ) : (
                                connections.map((c, i) => (
                                    <div key={i} className={styles.activityRow} style={{ padding: "1.25rem 2rem" }}>
                                        <div style={{ flex: 1 }}>
                                            <a
                                                href={`https://www.linkedin.com/in/${c.slug}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={styles.author}
                                                style={{ textDecoration: "none" }}
                                            >
                                                {c.name}
                                            </a>
                                            <div className={styles.snippet} style={{ maxWidth: "100%" }}>{c.headline}</div>
                                        </div>
                                        <div className={styles.timestamp}>{c.connected_at}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right column */}
                    <aside style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                        {/* Network Insights */}
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle} style={{ marginBottom: "1rem" }}>Composizione Network</h2>
                            <p className={styles.snippet} style={{ marginBottom: "1.5rem" }}>
                                Distribuzione dei ruoli nelle headline dei tuoi contatti.
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                                {insights.map((insight, i) => {
                                    const percentage = total > 0 ? Math.round((insight.count / total) * 100) : 0;
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
                                                    transition: "width 1s ease-out",
                                                }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Alleati */}
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle} style={{ marginBottom: "1rem" }}>🤝 Alleati</h2>
                            <p className={styles.snippet} style={{ marginBottom: "1.5rem" }}>
                                Commentano gli stessi post che analizzi tu. Potenziali amplificatori.
                            </p>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                {overlaps.length === 0 ? (
                                    <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", textAlign: "center", padding: "1rem 0" }}>
                                        Analizza più post per trovare alleati.
                                    </p>
                                ) : (
                                    overlaps.map((o, i) => (
                                        <div key={i} style={{
                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                            padding: "0.75rem 0",
                                            borderBottom: i === overlaps.length - 1 ? "none" : "1px solid var(--border-soft)",
                                        }}>
                                            <a
                                                href={`https://www.linkedin.com/in/${o.slug}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={styles.author}
                                                style={{ fontSize: "0.875rem", textDecoration: "none" }}
                                            >
                                                {o.name}
                                            </a>
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
