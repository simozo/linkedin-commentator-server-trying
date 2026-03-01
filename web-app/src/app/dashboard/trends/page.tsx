"use client";

import { useEffect, useState } from "react";
import styles from "../dashboard.module.css";
import DashboardNav from "../components/DashboardNav";
import Link from "next/link";

interface TrendPost {
    urn: string;
    text: string;
    authorName: string;
    authorAvatar: string;
    authorSlug: string;
}

interface TrendMention {
    name: string;
    avatar: string;
    slug: string;
}

interface Trend {
    name: string;
    count: number;
    posts: TrendPost[];
    mentions: TrendMention[];
}

interface User {
    id: number;
    email: string;
    full_name?: string;
    avatar_url?: string;
    tier?: string;
}

export default function TrendsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [trends, setTrends] = useState<Trend[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);

    const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:5001";

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch User
                const userRes = await fetch(`${DASHBOARD_URL}/api/user`, { credentials: "include" });
                if (userRes.ok) {
                    const userData = await userRes.json();
                    setUser(userData);
                }

                // Fetch Trends
                const trendsRes = await fetch(`${DASHBOARD_URL}/api/trends`, { credentials: "include" });
                if (trendsRes.ok) {
                    const trendsData = await trendsRes.json();
                    setTrends(trendsData);
                }
            } catch (err) {
                console.error("Failed to fetch trends data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const filteredTrends = trends.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return <div className={styles.loadingContainer}>Analisi del grafo in corso...</div>;
    }

    return (
        <div className={styles.dashboard}>
            <DashboardNav userName={user?.full_name} avatarUrl={user?.avatar_url} />

            <main className={styles.container}>
                <header className={styles.header} style={{ marginBottom: "3rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                        <Link href="/dashboard" className={styles.viewAll} style={{ margin: 0, padding: "0.4rem 0.8rem" }}>
                            ← Dashboard
                        </Link>
                        <h1 className={styles.title} style={{ margin: 0 }}>🔥 Feed Intelligence</h1>
                    </div>
                    <p className={styles.subtitle}>
                        Hashtag e argomenti ricorrenti estratti dai post che hai visto.
                    </p>
                </header>

                <div className={styles.section}>
                    <div className={styles.sectionHeader} style={{ marginBottom: "2rem" }}>
                        <h2 className={styles.sectionTitle}>I Tuoi Trend ({trends.length})</h2>
                        <input
                            type="text"
                            placeholder="Cerca argomento..."
                            className={styles.searchBar}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                padding: "0.6rem 1rem",
                                borderRadius: "10px",
                                border: "1px solid var(--border-soft)",
                                fontSize: "0.875rem",
                                width: "250px",
                                outline: "none",
                                background: "var(--bg-light)"
                            }}
                        />
                    </div>

                    {filteredTrends.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--text-muted)" }}>
                            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🔍</div>
                            <p>Nessun trend trovato per "{search}"</p>
                        </div>
                    ) : (
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                            gap: "1.5rem"
                        }}>
                            {filteredTrends.map((trend, i) => (
                                <div
                                    key={i}
                                    className={styles.statCard}
                                    onClick={() => setSelectedTrend(trend)}
                                    style={{
                                        padding: "1.75rem",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "flex-start",
                                        animationDelay: `${i * 30}ms`,
                                        cursor: "pointer",
                                    }}
                                >
                                    <div style={{
                                        fontSize: "1.25rem",
                                        fontWeight: 800,
                                        color: "var(--text-main)",
                                        marginBottom: "0.25rem"
                                    }}>
                                        #{trend.name}
                                    </div>
                                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: "1.5rem" }}>
                                        {trend.count} occorrenze
                                    </div>

                                    {/* Small preview of authors */}
                                    <div style={{ display: "flex", alignItems: "center", marginTop: "auto" }}>
                                        <div style={{ display: "flex", marginLeft: "4px" }}>
                                            {(trend.posts || []).slice(0, 3).map((p, idx) => (
                                                <img
                                                    key={idx}
                                                    src={p.authorAvatar || "https://www.google.com/url?sa=i&url=https%3A%2F%2Fwww.flaticon.com%2Ffree-icon%2Fuser_149071&psig=AOvVaw2yZ_Z-Z_Z-Z_Z-Z_Z-Z_Z&ust=1710000000000000&source=images&cd=vfe&opi=89978449&ved=0CBIQjRxqFwoTCIDP_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z"}
                                                    alt={p.authorName}
                                                    style={{
                                                        width: "24px",
                                                        height: "24px",
                                                        borderRadius: "50%",
                                                        border: "2px solid #fff",
                                                        marginLeft: idx === 0 ? 0 : "-8px",
                                                        objectFit: "cover",
                                                        background: "#eee"
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "8px", fontWeight: 700 }}>
                                            +{trend.count > 3 ? trend.count - 3 : 0} altri
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Detail Drawer */}
            {selectedTrend && (
                <div className={styles.detailOverlay} onClick={() => setSelectedTrend(null)}>
                    <div className={styles.detailDrawer} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.closeButton} onClick={() => setSelectedTrend(null)}>×</button>

                        <div className={styles.detailHeader}>
                            <div className={styles.detailTag}>#{selectedTrend.name}</div>
                            <div className={styles.detailCount}>Identificato in {selectedTrend.count} post nel tuo feed</div>
                        </div>

                        <div style={{ marginBottom: "2rem" }}>
                            <h3 style={{ fontSize: "0.9rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "1rem" }}>
                                Menzioni Correlate
                            </h3>
                            <div className={styles.mentionsSection}>
                                {(selectedTrend.mentions || []).length > 0 ? selectedTrend.mentions.map((m, i) => (
                                    <span key={i} className={styles.mentionPill}>
                                        {m.name || "Anonimo"}
                                    </span>
                                )) : <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Nessuna menzione rilevante trovata.</p>}
                            </div>
                        </div>

                        <div>
                            <h3 style={{ fontSize: "0.9rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "1rem" }}>
                                Conversazioni Recenti
                            </h3>
                            <div className={styles.postList}>
                                {(selectedTrend.posts || []).map((post, i) => (
                                    <div key={i} className={styles.postCardDetails}>
                                        <div className={styles.authorInfo}>
                                            <img
                                                src={post.authorAvatar || "https://www.google.com/url?sa=i&url=https%3A%2F%2Fwww.flaticon.com%2Ffree-icon%2Fuser_149071&psig=AOvVaw2yZ_Z-Z_Z-Z_Z-Z_Z-Z_Z&ust=1710000000000000&source=images&cd=vfe&opi=89978449&ved=0CBIQjRxqFwoTCIDP_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z"}
                                                className={styles.avatarCircle}
                                                alt={post.authorName}
                                            />
                                            <div className={styles.authorNameMain}>{post.authorName}</div>
                                        </div>
                                        <p className={styles.postSnippetText}>
                                            {post.text}
                                        </p>
                                        <a
                                            href={`https://www.linkedin.com/feed/update/${post.urn}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ fontSize: "0.8rem", color: "var(--accent-blue)", fontWeight: 700, textDecoration: "none" }}
                                        >
                                            Vedi post originale →
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
