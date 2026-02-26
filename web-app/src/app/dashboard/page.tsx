"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "./components/DashboardNav";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:4000";
const AUTH_LOGIN_URL = process.env.NEXT_PUBLIC_AUTH_LOGIN_URL || "http://localhost:4000/login";
const DASH_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:5001";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface User { user_id: number; email: string; full_name?: string; avatar_url?: string; auth_provider: string; }
interface Stats { posts_analyzed: number; comments_generated: number; people_reached: number; usage_days: number; connections: number; }
interface ActivityItem { post_urn: string; post_url: string; author_name: string; author_slug: string; action: string; post_text: string; timestamp: string; }
interface BridgeTarget { target_name: string; target_slug: string; bridge_name: string; bridge_slug: string; shared_post_urn: string; post_text: string; path_strength: number; }

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const actionLabel: Record<string, string> = {
    post_viewed: "Visualizzato", comment_generated: "Commentato",
    post_saved: "Salvato", post_ignored: "Saltato",
};
const actionColor: Record<string, string> = {
    post_viewed: "#3b82f6", comment_generated: "#10b981",
    post_saved: "#f59e0b", post_ignored: "#6b7280",
};

function apiFetch<T>(path: string): Promise<T> {
    return fetch(`${DASH_URL}${path}`, { credentials: "include" }).then(r => r.json());
}

function fmtDate(ts: string) {
    if (!ts) return "—";
    try { return new Date(ts).toLocaleDateString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch { return ts; }
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number | string; color: string }) {
    return (
        <div style={{
            background: "var(--color-surface)", border: "1px solid var(--color-border)",
            borderRadius: 16, padding: "1.5rem", position: "relative", overflow: "hidden",
        }}>
            <div style={{ position: "absolute", top: 12, right: 14, fontSize: "1.5rem", opacity: 0.15 }}>{icon}</div>
            <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-muted)", marginBottom: "0.6rem" }}>{label}</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color, letterSpacing: "-0.03em" }}>{value ?? "—"}</div>
        </div>
    );
}

function ActivityRow({ item }: { item: ActivityItem }) {
    const color = actionColor[item.action] || "#6b7280";
    const label = actionLabel[item.action] || item.action;
    return (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.9rem 0", borderBottom: "1px solid var(--color-border)" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, marginTop: 6, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{item.author_name || "—"}</span>
                    <span style={{ fontSize: "0.75rem", color, background: `${color}22`, borderRadius: 20, padding: "0.1rem 0.5rem" }}>{label}</span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--color-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.post_text?.slice(0, 100) || "—"}
                </div>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", whiteSpace: "nowrap", marginLeft: "0.5rem" }}>
                {fmtDate(item.timestamp)}
            </div>
        </div>
    );
}

function BridgeCard({ t }: { t: BridgeTarget }) {
    return (
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 14, padding: "1.1rem 1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
                <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{t.target_name || t.target_slug || "—"}</span>
                <span style={{ fontSize: "0.7rem", color: "#10b981", background: "#10b98122", borderRadius: 20, padding: "0.1rem 0.5rem" }}>
                    forza {t.path_strength}
                </span>
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>
                🌉 via <strong style={{ color: "var(--color-text)" }}>{t.bridge_name || t.bridge_slug}</strong>
            </div>
            {t.post_text && (
                <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "0.4rem", fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    "{t.post_text.slice(0, 80)}"
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
                    apiFetch<ActivityItem[]>("/api/activity?limit=10").then(setActivity).catch(() => { }),
                    apiFetch<BridgeTarget[]>("/api/bridge-targets").then(setBridges).catch(() => { }),
                ]).finally(() => setLoading(false));
            })
            .catch(() => { window.location.href = AUTH_LOGIN_URL; });
    }, []);

    if (loading) {
        return (
            <div className="auth-wrapper">
                <div className="spinner" style={{ width: 48, height: 48, borderWidth: 3 }} />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font)" }}>

            <DashboardNav userName={user.full_name || user.email} avatarUrl={user.avatar_url} />

            <main style={{ maxWidth: 1040, margin: "0 auto", padding: "2.5rem 1.5rem" }}>

                {/* Header */}
                <div style={{ marginBottom: "2rem" }}>
                    <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "0.35rem" }}>
                        Ciao, {user.full_name?.split(" ")[0] || "utente"} 👋
                    </h1>
                    <p style={{ color: "var(--color-muted)", fontSize: "0.9rem", margin: 0 }}>
                        {stats ? `${stats.usage_days} giorni attivi · Ultimo aggiornamento adesso` : "Caricamento statistiche..."}
                    </p>
                </div>

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
                    <StatCard icon="📊" label="Post analizzati" value={stats?.posts_analyzed ?? "—"} color="#3b82f6" />
                    <StatCard icon="💬" label="Commenti generati" value={stats?.comments_generated ?? "—"} color="#10b981" />
                    <StatCard icon="🤝" label="Rete contatti" value={stats?.connections ?? "—"} color="#8b5cf6" />
                    <StatCard icon="🔥" label="Giorni di utilizzo" value={stats?.usage_days ?? "—"} color="#ef4444" />
                </div>

                {/* Two-column layout: Activity + Bridge */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

                    {/* Activity Feed */}
                    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 16, padding: "1.5rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                            <h2 style={{ fontWeight: 700, fontSize: "1rem", margin: 0 }}>Attività Recente</h2>
                            <Link href="/dashboard/activity" style={{
                                fontSize: "0.78rem", color: "#3b82f6", textDecoration: "none",
                                padding: "0.25rem 0.7rem", border: "1px solid #3b82f644", borderRadius: 20,
                            }}>
                                Vedi tutto →
                            </Link>
                        </div>
                        {activity.length === 0 ? (
                            <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginTop: "1rem" }}>
                                Nessuna attività ancora. Avvia il Co-pilot e naviga su LinkedIn.
                            </p>
                        ) : (
                            activity.map((item, i) => <ActivityRow key={i} item={item} />)
                        )}
                    </div>

                    {/* Warm Reach Map preview */}
                    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 16, padding: "1.5rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <h2 style={{ fontWeight: 700, fontSize: "1rem", margin: 0 }}>🌉 Warm Reach Map</h2>
                            <Link href="/dashboard/reach" style={{
                                fontSize: "0.78rem", color: "#10b981", textDecoration: "none",
                                padding: "0.25rem 0.7rem", border: "1px solid #10b98144", borderRadius: 20,
                            }}>
                                Esplora →
                            </Link>
                        </div>
                        {bridges.length === 0 ? (
                            <p style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
                                Il grafo si costruisce man mano che usi il plugin. Continua ad analizzare post!
                            </p>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                {bridges.slice(0, 5).map((t, i) => <BridgeCard key={i} t={t} />)}
                                {bridges.length > 5 && (
                                    <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: 0, textAlign: "center" }}>
                                        + {bridges.length - 5} altri percorsi disponibili
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Account info footer */}
                <div style={{ marginTop: "1.5rem", padding: "1rem 1.5rem", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 14 }}>
                    <p style={{ color: "var(--color-muted)", fontSize: "0.8rem", margin: 0 }}>
                        📌 <strong style={{ color: "var(--color-text)" }}>Account:</strong>{" "}
                        {user.email} · ID {user.user_id} · Auth via <em>{user.auth_provider}</em>
                    </p>
                </div>
            </main>
        </div>
    );
}
