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
    post_saved: "#f59e0b", post_ignored: "#6b7280",
};

function fmtDate(ts: string) {
    if (!ts) return "—";
    try { return new Date(ts).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
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
            <>
                <DashboardNav userName="…" />
                <div className="auth-wrapper"><div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} /></div>
            </>
        );
    }

    return (
        <div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font)" }}>
            <DashboardNav userName={user?.full_name || user?.email} avatarUrl={user?.avatar_url} />

            <main style={{ maxWidth: 760, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.75rem" }}>
                    <div>
                        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "0.25rem" }}>
                            Attività Recente
                        </h1>
                        <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", margin: 0 }}>
                            Tutte le azioni registrate dal plugin su LinkedIn
                        </p>
                    </div>
                    <Link href="/dashboard" style={{
                        fontSize: "0.8rem", color: "var(--color-muted)", textDecoration: "none",
                        padding: "0.35rem 0.85rem", border: "1px solid var(--color-border)", borderRadius: 20,
                    }}>
                        ← Overview
                    </Link>
                </div>

                {/* Filters */}
                <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
                    {[
                        { key: "all", label: "Tutti" },
                        { key: "comment_generated", label: "💬 Commenti" },
                        { key: "post_viewed", label: "👁 Visualizzati" },
                        { key: "post_saved", label: "📌 Salvati" },
                        { key: "post_ignored", label: "⏭ Saltati" },
                    ].map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key)} style={{
                            padding: "0.3rem 0.85rem", borderRadius: 20, fontSize: "0.8rem",
                            fontWeight: filter === f.key ? 600 : 400, cursor: "pointer",
                            border: `1px solid ${filter === f.key ? "#3b82f6" : "var(--color-border)"}`,
                            background: filter === f.key ? "#3b82f614" : "transparent",
                            color: filter === f.key ? "#3b82f6" : "var(--color-muted)",
                            transition: "all 0.15s",
                        }}>{f.label}</button>
                    ))}
                </div>

                {/* List */}
                <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 16, overflow: "hidden" }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--color-muted)", fontSize: "0.875rem" }}>
                            {items.length === 0
                                ? "Nessuna attività ancora. Avvia il Co-pilot e naviga su LinkedIn."
                                : "Nessun risultato per questo filtro."}
                        </div>
                    ) : (
                        filtered.map((item, i) => {
                            const color = actionColor[item.action] || "#6b7280";
                            const label = actionLabel[item.action] || item.action;
                            return (
                                <div key={i} style={{
                                    display: "flex", alignItems: "flex-start", gap: "1rem",
                                    padding: "1rem 1.25rem",
                                    borderBottom: i < filtered.length - 1 ? "1px solid var(--color-border)" : "none",
                                }}>
                                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, marginTop: 7, flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem", flexWrap: "wrap" }}>
                                            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                                                {item.author_name || "—"}
                                            </span>
                                            {item.author_slug && (
                                                <a href={`https://linkedin.com/in/${item.author_slug}`} target="_blank" rel="noopener noreferrer"
                                                    style={{ fontSize: "0.72rem", color: "#3b82f6", textDecoration: "none", opacity: 0.7 }}>
                                                    /in/{item.author_slug}
                                                </a>
                                            )}
                                            <span style={{ fontSize: "0.72rem", color, background: `${color}22`, borderRadius: 20, padding: "0.1rem 0.5rem" }}>
                                                {label}
                                            </span>
                                        </div>
                                        {item.post_text && (
                                            <div style={{ fontSize: "0.8rem", color: "var(--color-muted)", lineHeight: 1.5 }}>
                                                {item.post_text.slice(0, 160)}{item.post_text.length > 160 ? "…" : ""}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.35rem", flexShrink: 0 }}>
                                        <span style={{ fontSize: "0.72rem", color: "var(--color-muted)", whiteSpace: "nowrap" }}>
                                            {fmtDate(item.timestamp)}
                                        </span>
                                        {item.post_url && (
                                            <a href={item.post_url} target="_blank" rel="noopener noreferrer" style={{
                                                fontSize: "0.7rem", color: "#3b82f6", textDecoration: "none",
                                                padding: "0.15rem 0.5rem", border: "1px solid #3b82f644", borderRadius: 12,
                                            }}>
                                                Apri →
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
                    <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
                        <button onClick={() => fetchActivity(offset, items)} disabled={loadingMore} style={{
                            padding: "0.6rem 1.5rem", borderRadius: 20, fontSize: "0.85rem", fontWeight: 600,
                            border: "1px solid var(--color-border)", background: "var(--color-surface)",
                            color: "var(--color-text)", cursor: loadingMore ? "default" : "pointer", opacity: loadingMore ? 0.6 : 1,
                        }}>
                            {loadingMore ? "Caricamento…" : "Carica altri"}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
