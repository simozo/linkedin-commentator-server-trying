"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "../components/DashboardNav";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:4000";
const AUTH_LOGIN_URL = process.env.NEXT_PUBLIC_AUTH_LOGIN_URL || "http://localhost:4000/login";
const DASH_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:5001";

interface User { user_id: number; email: string; full_name?: string; avatar_url?: string; auth_provider: string; }
interface ActivityItem {
    post_urn: string; post_url: string; author_name: string; author_slug: string;
    action: string; post_text: string; timestamp: string;
}

const actionLabel: Record<string, string> = {
    post_viewed: "Visualizzato", comment_generated: "Commentato",
    post_saved: "Salvato", post_ignored: "Saltato",
};
const actionColor: Record<string, string> = {
    post_viewed: "#3b82f6", comment_generated: "#10b981",
    post_saved: "#f59e0b", post_ignored: "#64748b",
};

function fmtDate(ts: string) {
    if (!ts) return "—";
    try {
        return new Date(ts).toLocaleString("it-IT", {
            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
        });
    }
    catch { return ts; }
}

const PAGE_SIZE = 20;

export default function ActivityPage() {
    const [user, setUser] = useState<User | null>(null);
    const [items, setItems] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [filter, setFilter] = useState("all");

    useEffect(() => {
        fetch(`${AUTH_URL}/me`, { credentials: "include" })
            .then(r => { if (!r.ok) { window.location.href = AUTH_LOGIN_URL; return null; } return r.json(); })
            .then((u: User | null) => {
                if (!u) return;
                setUser(u);
                fetchActivity(0, []);
            }).catch(() => { window.location.href = AUTH_LOGIN_URL; });
    }, []);

    const fetchActivity = (off: number, prev: ActivityItem[]) => {
        if (off === 0) setLoading(true); else setLoadingMore(true);
        fetch(`${DASH_URL}/api/activity?limit=${PAGE_SIZE}&offset=${off}`, { credentials: "include" })
            .then(r => r.json())
            .then((data: ActivityItem[]) => {
                const merged = off === 0 ? data : [...prev, ...data];
                setItems(merged);
                setOffset(off + PAGE_SIZE);
                setHasMore(data.length === PAGE_SIZE);
            })
            .finally(() => { setLoading(false); setLoadingMore(false); });
    };

    const filtered = filter === "all" ? items : items.filter(i => i.action === filter);

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

            <main className="max-w-[1080px] mx-auto px-6 py-12 animate-fadeIn" style={{ maxWidth: 800 }}>
                {/* Header */}
                <header className="mb-12" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
                    <div>
                        <h1 className="text-[2.25rem] font-bold text-text-main tracking-[-0.04em] mb-2 font-display" style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>
                            Registro Attività
                        </h1>
                        <p className="text-base text-text-muted font-medium font-body">
                            Tutte le azioni registrate dal plugin su LinkedIn
                        </p>
                    </div>
                    <Link href="/dashboard" className="text-[0.875rem] font-semibold text-brand-blue no-underline px-4 py-2 bg-brand-soft rounded-lg transition-all duration-200 hover:bg-brand-blue/[0.12]" style={{ background: "#fff", border: "1px solid var(--border-soft)", color: "var(--text-muted)" }}>
                        ← Dashboard
                    </Link>
                </header>

                {/* Filters */}
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", flexWrap: "wrap" }}>
                    {[
                        { key: "all", label: "Tutti" },
                        { key: "comment_generated", label: "💬 Commenti" },
                        { key: "post_viewed", label: "👁 Visualizzati" },
                        { key: "post_saved", label: "📌 Salvati" },
                        { key: "post_ignored", label: "⏭ Saltati" },
                    ].map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key)} style={{
                            padding: "0.5rem 1rem", borderRadius: 8, fontSize: "0.875rem",
                            fontWeight: filter === f.key ? 700 : 500, cursor: "pointer",
                            border: "1px solid",
                            borderColor: filter === f.key ? "var(--accent-blue)" : "var(--border-soft)",
                            background: filter === f.key ? "var(--accent-soft)" : "#fff",
                            color: filter === f.key ? "var(--accent-blue)" : "var(--text-muted)",
                            transition: "all 0.2s ease",
                            fontFamily: "var(--font-body)"
                        }}>{f.label}</button>
                    ))}
                </div>

                {/* List */}
                <div className="bg-white border border-black/[0.06] rounded-[24px] p-8 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]" style={{ padding: 0, overflow: "hidden" }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                            {items.length === 0
                                ? "Nessuna attività ancora. Avvia il Co-pilot e naviga su LinkedIn."
                                : "Nessun risultato per questo filtro."}
                        </div>
                    ) : (
                        filtered.map((item, i) => {
                            const color = actionColor[item.action] || "#64748b";
                            const label = actionLabel[item.action] || item.action;
                            return (
                                <div key={i} className="flex items-start gap-4 py-5 border-b border-black/[0.04] last:border-0" style={{ padding: "1.25rem 1.5rem" }}>
                                    <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="font-bold text-[0.9375rem] text-text-main font-body">{item.author_name || "—"}</span>
                                            {item.author_slug && (
                                                <a href={`https://linkedin.com/in/${item.author_slug}`} target="_blank" rel="noopener noreferrer"
                                                    style={{ fontSize: "0.75rem", color: "var(--accent-blue)", textDecoration: "none", fontWeight: 600, opacity: 0.8 }}>
                                                    /in/{item.author_slug}
                                                </a>
                                            )}
                                            <span className="text-[0.7rem] font-bold uppercase tracking-[0.05em] px-[0.6rem] py-[0.2rem] rounded-[6px] font-body" style={{ color, background: `${color}12` }}>
                                                {label}
                                            </span>
                                        </div>
                                        {item.post_text && (
                                            <div className="text-[0.875rem] text-text-muted leading-relaxed font-body">
                                                {item.post_text.slice(0, 160)}{item.post_text.length > 160 ? "…" : ""}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem", flexShrink: 0 }}>
                                        <span className="text-[0.8125rem] font-semibold text-text-muted whitespace-nowrap font-body">
                                            {fmtDate(item.timestamp)}
                                        </span>
                                        {item.post_url && (
                                            <a href={item.post_url} target="_blank" rel="noopener noreferrer" className="text-[0.875rem] font-semibold text-brand-blue no-underline px-4 py-2 bg-brand-soft rounded-lg transition-all duration-200 hover:bg-brand-blue/[0.12]" style={{
                                                fontSize: "0.75rem", padding: "0.25rem 0.6rem", borderRadius: 6
                                            }}>
                                                Apri post
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Load more */}
                {hasMore && filtered.length > 0 && (
                    <div style={{ textAlign: "center", marginTop: "2rem" }}>
                        <button onClick={() => fetchActivity(offset, items)} disabled={loadingMore} style={{
                            padding: "0.75rem 2rem", borderRadius: 8, fontSize: "0.9rem", fontWeight: 700,
                            border: "1px solid var(--border-soft)", background: "#fff",
                            color: "var(--text-main)", cursor: loadingMore ? "default" : "pointer", opacity: loadingMore ? 0.6 : 1,
                            transition: "all 0.2s ease", boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                            fontFamily: "var(--font-body)"
                        }}>
                            {loadingMore ? "Caricamento…" : "Carica altri"}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
