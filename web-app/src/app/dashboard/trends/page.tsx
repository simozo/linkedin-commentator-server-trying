"use client";

import { useEffect, useState } from "react";
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
    type: string;
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
        return <div className="flex items-center justify-center h-screen font-semibold text-text-muted bg-bg-light">Analisi del grafo in corso...</div>;
    }

    return (
        <div className="/* TODO: dashboard */">
            <DashboardNav userName={user?.full_name} avatarUrl={user?.avatar_url} />

            <main className="max-w-[1080px] mx-auto px-6 py-12 animate-fadeIn">
                <header className="mb-12" style={{ marginBottom: "3rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                        <Link href="/dashboard" className="text-[0.875rem] font-semibold text-brand-blue no-underline px-4 py-2 bg-brand-soft rounded-lg transition-all duration-200 hover:bg-brand-blue/[0.12]" style={{ margin: 0, padding: "0.4rem 0.8rem" }}>
                            ← Dashboard
                        </Link>
                        <h1 className="text-[2.25rem] font-bold text-text-main tracking-[-0.04em] mb-2 font-display" style={{ margin: 0 }}>🔥 Feed Intelligence</h1>
                    </div>
                    <p className="text-base text-text-muted font-medium font-body">
                        Hashtag e argomenti ricorrenti estratti dai post che hai visto.
                    </p>
                </header>

                <div className="bg-white border border-black/[0.06] rounded-[24px] p-8 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]">
                    <div className="flex justify-between items-center mb-6" style={{ marginBottom: "2rem" }}>
                        <h2 className="text-[1.25rem] font-bold text-text-main font-display">I Tuoi Trend ({trends.length})</h2>
                        <input
                            type="text"
                            placeholder="Cerca argomento..."
                            className="/* TODO: searchBar */"
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
                                    className="bg-white border border-black/[0.06] rounded-md p-7 relative overflow-hidden transition-all duration-300 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] hover:-translate-y-1 hover:shadow-lg hover:border-brand-blue"
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
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur z-[1000] flex justify-end" onClick={() => setSelectedTrend(null)}>
                    <div className="w-full max-w-[500px] h-full bg-white/70 backdrop-blur-xl shadow-[-10px_0_40px_rgba(0,0,0,0.1)] p-12 overflow-y-auto relative" onClick={(e) => e.stopPropagation()}>
                        <button className="absolute top-6 right-6 w-8 h-8 rounded-full flex items-center justify-center bg-bg-light border-none cursor-pointer text-[1.25rem] text-text-muted transition-all duration-200 hover:bg-brand-soft hover:text-brand-blue hover:rotate-90" onClick={() => setSelectedTrend(null)}>×</button>

                        <div className="mb-10">
                            <div className="text-[2.5rem] font-extrabold text-brand-blue tracking-[-0.05em] mb-2 font-display">#{selectedTrend.name}</div>
                            <div className="text-base text-text-muted font-semibold font-body">Identificato in {selectedTrend.count} post nel tuo feed</div>
                        </div>

                        <div style={{ marginBottom: "2rem" }}>
                            <h3 style={{ fontSize: "0.9rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "1rem" }}>
                                Menzioni Correlate
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-black/[0.06]">
                                {(selectedTrend.mentions || []).length > 0 ? selectedTrend.mentions.map((m, i) => {
                                    let icon = "📝";
                                    if (m.type === "liked") icon = "❤️";
                                    if (m.type === "reposted") icon = "🔁";
                                    if (m.type === "suggested") icon = "🤝";
                                    if (m.type === "commented") icon = "💬";

                                    return (
                                        <span key={i} className="text-[0.75rem] font-bold text-text-muted bg-bg-light px-[0.7rem] py-[0.3rem] rounded-[20px] border border-black/[0.06] transition-all duration-200 hover:bg-brand-soft hover:text-brand-blue font-body">
                                            <span style={{ marginRight: "4px" }}>{icon}</span>
                                            {m.name || "Anonimo"}
                                        </span>
                                    );
                                }) : <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Nessuna menzione rilevante trovata.</p>}
                            </div>
                        </div>

                        <div>
                            <h3 style={{ fontSize: "0.9rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "1rem" }}>
                                Conversazioni Recenti
                            </h3>
                            <div className="flex flex-col gap-6">
                                {(selectedTrend.posts || []).map((post, i) => (
                                    <div key={i} className="bg-white border border-black/[0.06] rounded-2xl p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] transition-transform duration-200 hover:-translate-y-0.5">
                                        <div className="flex items-center gap-[0.85rem] mb-4">
                                            <img
                                                src={post.authorAvatar || "https://www.google.com/url?sa=i&url=https%3A%2F%2Fwww.flaticon.com%2Ffree-icon%2Fuser_149071&psig=AOvVaw2yZ_Z-Z_Z-Z_Z-Z_Z-Z_Z&ust=1710000000000000&source=images&cd=vfe&opi=89978449&ved=0CBIQjRxqFwoTCIDP_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z"}
                                                className="w-10 h-10 rounded-full object-cover border-2 border-brand-soft"
                                                alt={post.authorName}
                                            />
                                            <div className="font-bold text-[0.9375rem] text-text-main font-body">{post.authorName}</div>
                                        </div>
                                        <p className="text-[0.9375rem] text-text-main leading-relaxed mb-4 line-clamp-4 font-body">
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
