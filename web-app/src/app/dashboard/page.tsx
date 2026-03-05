"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "./components/DashboardNav";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:4000";
const AUTH_LOGIN_URL = process.env.NEXT_PUBLIC_AUTH_LOGIN_URL || "http://localhost:4000/login";
const DASH_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:5001";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface User { user_id: number; email: string; full_name?: string; avatar_url?: string; auth_provider: string; tier?: string; extension_linked?: boolean; }
interface Stats { posts_analyzed: number; comments_generated: number; people_reached: number; usage_days: number; connections: number; }
interface Usage { tier: string; comments_today: number; daily_limit: number; graph_maturity: number; nodes_count: number; target_nodes_count: number; is_limit_reached: boolean; }
interface ActivityItem { post_urn: string; post_url: string; author_name: string; author_slug: string; action: string; post_text: string; timestamp: string; }
interface BridgeTarget { target_name: string; target_slug: string; bridge_name: string; bridge_slug: string; shared_post_urn: string; post_text: string; path_strength: number; }
interface Trend { name: string; count: number; }
interface Maturity { action_count: number; level: string; next_level_threshold: number; progress: number; description: string; }
interface Streak { streak_days: number; is_day7: boolean; posts_analyzed: number; profiles_met: number; comments_left: number; }
interface RelevantPost { post_urn: string; post_url: string; post_text: string; author_name: string; author_slug: string; timestamp: string; }

/* ── Helpers ─────────────────────────────────────────────────────────────── */
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
        const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diffMins < 60) return `${diffMins}m fa`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h fa`;
        return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
    } catch { return ts; }
}

/* ── Empty State ─────────────────────────────────────────────────────────── */
function EmptyState({ extensionLinked }: { extensionLinked: boolean }) {
    const step1 = extensionLinked
        ? {
            icon: "✅",
            title: "Plugin collegato",
            desc: "Il plugin è già collegato al tuo account. Ora apri LinkedIn e scorri il feed per raccogliere i primi dati.",
            href: null,
            cta: null,
            done: true,
        }
        : {
            icon: "🔌",
            title: "Installa il plugin",
            desc: "Scarica l'estensione Chrome e collegala al tuo account dalla pagina di onboarding.",
            href: "/onboarding",
            cta: "Installa →",
            done: false,
        };

    const steps = [
        step1,
        { icon: "📜", title: "Scorri LinkedIn", desc: "Apri il feed di LinkedIn e naviga normalmente. Il plugin raccoglie i dati in background.", href: "https://www.linkedin.com/feed/", cta: "Vai al feed →", done: false },
        { icon: "📊", title: "Torna qui", desc: "Dopo qualche minuto di navigazione, i tuoi dati appariranno in questa dashboard.", href: null, cta: null, done: false },
    ];

    return (
        <div className="bg-white border border-black/[0.06] rounded-2xl p-10 text-center animate-fadeIn">
            <div className="text-5xl mb-4">🌱</div>
            <h2 className="text-[1.5rem] font-bold text-text-main font-display mb-2">Nessun dato ancora</h2>
            <p className="text-text-muted font-body text-[0.9375rem] mb-10 max-w-md mx-auto">
                {extensionLinked
                    ? "Il plugin è già collegato. Ora scorri il feed di LinkedIn e i dati appariranno qui."
                    : "Il tuo grafo è vuoto. Segui questi 3 step per iniziare a raccogliere dati dal tuo LinkedIn."}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                {steps.map((s, i) => (
                    <div
                        key={i}
                        className={[
                            "border rounded-xl p-6 transition-all",
                            s.done
                                ? "bg-success/[0.04] border-success/30"
                                : "bg-bg-light border-black/[0.06]",
                        ].join(" ")}
                    >
                        <div className="text-3xl mb-3">{s.icon}</div>
                        <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-text-muted mb-1 font-body">Step {i + 1}</p>
                        <h3 className={["text-[1rem] font-bold font-display mb-2", s.done ? "text-success" : "text-text-main"].join(" ")}>{s.title}</h3>
                        <p className="text-[0.875rem] text-text-muted font-body leading-relaxed mb-4">{s.desc}</p>
                        {s.href && s.cta && (
                            <a
                                href={s.href}
                                target={s.href.startsWith("http") ? "_blank" : undefined}
                                rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                                className="text-[0.8125rem] font-bold text-brand-blue no-underline hover:underline font-body"
                            >
                                {s.cta}
                            </a>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, color, delay }: {
    icon: string; label: string; value: number | string; color: string; delay: number;
}) {
    return (
        <div
            className="bg-white border border-black/[0.06] rounded-md p-7 relative overflow-hidden transition-all duration-300 ease-out shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] hover:-translate-y-1 hover:shadow-[0_12px_20px_-5px_rgba(0,0,0,0.05)] hover:border-brand-blue animate-fadeIn"
            style={{ animationDelay: `${delay}ms` }}
        >
            <span className="absolute top-4 right-5 text-[1.75rem] opacity-10 transition-opacity duration-300 group-hover:opacity-20">
                {icon}
            </span>
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.1em] text-text-muted mb-3 font-body">
                {label}
            </p>
            <p className="text-[2.5rem] font-extrabold tracking-[-0.04em] leading-none font-display" style={{ color }}>
                {value ?? "—"}
            </p>
        </div>
    );
}

function ActivityRow({ item }: { item: ActivityItem }) {
    const color = actionColor[item.action] || "#64748b";
    const label = actionLabel[item.action] || item.action;
    return (
        <div className="flex items-start gap-4 py-5 border-b border-black/[0.04] last:border-0">
            <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 shadow-[0_0_0_4px_rgba(0,0,0,0.03)]" style={{ background: color }} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-[0.9375rem] text-text-main font-body">{item.author_name || "—"}</span>
                    <span
                        className="text-[0.7rem] font-bold uppercase tracking-[0.05em] px-[0.6rem] py-[0.2rem] rounded-[6px] font-body"
                        style={{ color, background: `${color}12` }}
                    >
                        {label}
                    </span>
                </div>
                <p className="text-[0.875rem] text-text-muted leading-relaxed truncate font-body">
                    {item.post_text?.slice(0, 100) || "—"}
                </p>
            </div>
            <span className="text-[0.8125rem] font-semibold text-text-muted whitespace-nowrap font-body">
                {fmtDate(item.timestamp)}
            </span>
        </div>
    );
}

function BridgeCard({ t }: { t: BridgeTarget }) {
    return (
        <div className="bg-bg-light border border-black/[0.06] rounded-md p-5 transition-all duration-200 mb-4 hover:border-brand-blue hover:bg-white">
            <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-base text-text-main font-body">{t.target_name || t.target_slug || "—"}</span>
                <span className="text-[0.7rem] font-extrabold px-2 py-[0.15rem] rounded-[4px] font-body" style={{ color: "#10b981", background: "rgba(16,185,129,0.1)" }}>
                    {t.path_strength}
                </span>
            </div>
            <p className="text-[0.8125rem] text-text-muted font-body">
                🌉 via <strong className="text-text-main">{t.bridge_name || t.bridge_slug}</strong>
            </p>
            {t.post_text && (
                <p className="text-[0.875rem] text-text-muted leading-relaxed mt-2 italic font-body">
                    &ldquo;{t.post_text.slice(0, 80)}...&rdquo;
                </p>
            )}
        </div>
    );
}

/* ── Main Page ──────────────────────────────────────────────────────────── */
export default function DashboardPage() {
    const [user, setUser] = useState<User | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [bridges, setBridges] = useState<BridgeTarget[]>([]);
    const [trends, setTrends] = useState<Trend[]>([]);
    const [usage, setUsage] = useState<Usage | null>(null);
    const [maturity, setMaturity] = useState<Maturity | null>(null);
    const [streak, setStreak] = useState<Streak | null>(null);
    const [relevantPosts, setRelevantPosts] = useState<RelevantPost[]>([]);
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
                    apiFetch<Stats>("/api/stats").then(setStats).catch(() => {}),
                    apiFetch<ActivityItem[]>("/api/activity?limit=5").then(setActivity).catch(() => {}),
                    apiFetch<BridgeTarget[]>("/api/bridge-targets").then(setBridges).catch(() => {}),
                    apiFetch<Trend[]>("/api/trends").then(setTrends).catch(() => {}),
                    apiFetch<Usage>("/api/user/usage").then(setUsage).catch(() => {}),
                    apiFetch<Maturity>("/api/stats/maturity").then(setMaturity).catch(() => {}),
                    apiFetch<Streak>("/api/stats/streak").then(setStreak).catch(() => {}),
                    apiFetch<RelevantPost[]>("/api/posts/relevant").then(setRelevantPosts).catch(() => {}),
                ]).finally(() => setLoading(false));
            })
            .catch(() => { window.location.href = AUTH_LOGIN_URL; });
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-bg-light flex items-center justify-center">
                <div className="spinner w-10 h-10 border-[3px]" style={{ borderTopColor: "var(--accent-blue)" }} />
            </div>
        );
    }

    if (!user) return null;

    const remaining = usage ? Math.max(0, usage.daily_limit - usage.comments_today) : null;

    return (
        <div className="min-h-screen bg-bg-light">
            <DashboardNav userName={user.full_name || user.email} avatarUrl={user.avatar_url} />

            <main className="max-w-dashboard mx-auto px-6 py-12 animate-fadeIn">

                {/* Plugin install banner */}
                {!user.extension_linked && (
                    <div className="mb-6 px-5 py-4 rounded-xl border border-brand-blue/20 bg-gradient-to-r from-brand-blue/[0.03] to-purple-500/[0.03] flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl leading-none">🔌</span>
                            <div>
                                <p className="font-bold text-[0.9375rem] text-text-main font-body m-0">Plugin non collegato</p>
                                <p className="text-[0.8125rem] text-text-muted font-body mt-0.5 m-0">
                                    Installa l&apos;estensione Chrome per raccogliere dati e generare commenti direttamente da LinkedIn.
                                </p>
                            </div>
                        </div>
                        <a href="/onboarding" className="px-5 py-2 bg-brand-blue text-white rounded-lg text-[0.875rem] font-bold no-underline whitespace-nowrap flex-shrink-0 hover:opacity-90 transition-opacity font-body">
                            Installa →
                        </a>
                    </div>
                )}

                {/* Day-7 anchor panel */}
                {streak?.is_day7 && (
                    <div className="mb-8 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-50/80 to-orange-50/60 p-7 animate-fadeIn">
                        <div className="flex items-start gap-4">
                            <span className="text-3xl leading-none flex-shrink-0">🔥</span>
                            <div className="flex-1">
                                <p className="text-[1.05rem] font-bold text-text-main font-display mb-3">
                                    {streak.streak_days} giorni con LinkedIn Grow
                                </p>
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div className="text-center">
                                        <p className="text-[1.6rem] font-extrabold tracking-tight font-display text-brand-blue">{streak.posts_analyzed}</p>
                                        <p className="text-[0.75rem] text-text-muted font-body">post analizzati</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[1.6rem] font-extrabold tracking-tight font-display text-brand-blue">{streak.profiles_met}</p>
                                        <p className="text-[0.75rem] text-text-muted font-body">profili incontrati</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[1.6rem] font-extrabold tracking-tight font-display text-brand-blue">{streak.comments_left}</p>
                                        <p className="text-[0.75rem] text-text-muted font-body">commenti lasciati</p>
                                    </div>
                                </div>
                                <p className="text-[0.875rem] text-text-muted font-body mb-4 leading-relaxed">
                                    Il tuo grafo sta diventando qualcosa di utile. Continua così — stai costruendo un vantaggio che altri non hanno.
                                </p>
                                <Link href="/dashboard/network" className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-blue text-white rounded-lg text-[0.875rem] font-bold no-underline hover:opacity-90 transition-opacity font-body">
                                    Vedi cosa hai costruito →
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <header className="mb-12">
                    <h1 className="text-[2.25rem] font-bold text-text-main tracking-[-0.04em] mb-2 font-display">
                        Bentornato, {user.full_name?.split(" ")[0] || "utente"}
                        {user.tier && (
                            <span className="inline-block text-[0.75rem] bg-brand-blue text-white px-[0.6rem] py-[0.2rem] rounded-[20px] ml-3 align-middle tracking-[0.05em] font-extrabold font-body">
                                {user.tier.toUpperCase()}
                            </span>
                        )}
                    </h1>
                    <p className="text-base text-text-muted font-medium font-body">
                        {stats ? `${stats.usage_days} giorni di attività · Dati aggiornati in tempo reale` : "Caricamento statistiche..."}
                    </p>
                </header>

                {/* Stats grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-4">
                    <StatCard icon="📈" label="Post analizzati"  value={stats?.posts_analyzed ?? "—"}  color="var(--accent-blue)"   delay={100} />
                    <StatCard icon="✨" label="Commenti oggi"    value={usage ? `${usage.comments_today}/${usage.daily_limit}` : (stats?.comments_generated ?? "—")} color="var(--color-success)" delay={200} />

                    {/* Maturity card */}
                    <div className="bg-white border border-brand-blue/20 rounded-md p-7 relative overflow-hidden animate-fadeIn bg-gradient-to-br from-white to-blue-50/50 backdrop-blur-sm shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]" style={{ animationDelay: "300ms" }}>
                        <div className="flex justify-between items-center w-full mb-2">
                            <p className="text-[0.75rem] font-bold uppercase tracking-[0.1em] text-text-muted m-0 font-body">Maturità Grafo</p>
                            <span className="text-[10px] font-extrabold bg-brand-blue text-white px-2 py-[2px] rounded-xl uppercase tracking-wide font-body">
                                {maturity?.level || "SEED"}
                            </span>
                        </div>
                        <div className="w-full h-2.5 bg-black/[0.05] rounded-full overflow-hidden relative mb-2">
                            <div
                                className="h-full rounded-full transition-all duration-[1500ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                style={{ width: `${maturity?.progress || 0}%`, background: "linear-gradient(90deg, #3b82f6, #8b5cf6)" }}
                            />
                        </div>
                        <p className="text-[11px] text-text-muted italic leading-relaxed m-0 font-body">
                            {maturity?.description || "Inizializzazione del grafo..."}
                        </p>
                    </div>

                    <StatCard icon="⚡" label="Daily Streak" value={stats?.usage_days ?? "—"} color="#f59e0b" delay={400} />
                </div>

                {/* Usage bar */}
                {usage && !usage.is_limit_reached && (usage.tier === "free" || !usage.tier) && remaining !== null && (
                    <div className="mb-10 px-5 py-3 rounded-[10px] border border-amber-400/20 bg-amber-400/[0.06] flex items-center gap-2 text-[0.875rem] text-text-muted font-body">
                        <span>⚡</span>
                        <span>
                            Ti restano <strong className="text-amber-500">{remaining} commenti AI</strong> oggi
                            &nbsp;·&nbsp; {usage.comments_today}/{usage.daily_limit} utilizzati
                        </span>
                    </div>
                )}
                {usage?.is_limit_reached && (
                    <div className="mb-10 px-5 py-3 rounded-[10px] border border-red-500/20 bg-red-500/[0.05] flex items-center justify-between gap-2 flex-wrap font-body">
                        <span className="text-red-600 font-semibold text-[0.875rem]">🚫 Limite giornaliero raggiunto — torna domani o passa a Pro</span>
                        <Link href="/dashboard/account" className="text-brand-blue font-bold no-underline text-[0.8125rem] hover:underline">Upgrade →</Link>
                    </div>
                )}

                {/* Empty state */}
                {stats && stats.posts_analyzed === 0 && <EmptyState extensionLinked={user.extension_linked ?? false} />}

                {/* Two-column layout */}
                {(stats?.posts_analyzed ?? 1) > 0 && <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8">
                    {/* Activity */}
                    <div className="bg-white border border-black/[0.06] rounded-lg p-8 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-[1.25rem] font-bold text-text-main font-display">Attività Recente</h2>
                            <Link href="/dashboard/activity" className="text-[0.875rem] font-semibold text-brand-blue no-underline px-4 py-2 bg-brand-soft rounded-lg transition-all duration-200 hover:bg-brand-blue/[0.12] hover:translate-x-0.5">
                                Vedi tutto
                            </Link>
                        </div>
                        {activity.length === 0 ? (
                            <p className="text-text-muted text-[0.875rem] text-center py-8 font-body">
                                Nessuna attività registrata. Avvia l&apos;estensione su LinkedIn per iniziare.
                            </p>
                        ) : (
                            <div className="flex flex-col">
                                {activity.map((item, i) => <ActivityRow key={i} item={item} />)}
                            </div>
                        )}
                    </div>

                    {/* Warm Reach */}
                    <div className="bg-white border border-black/[0.06] rounded-lg p-8 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-[1.25rem] font-bold text-text-main font-display">🌉 Warm Reach Map</h2>
                            <Link href="/dashboard/reach" className="text-[0.875rem] font-semibold no-underline px-4 py-2 rounded-lg transition-all duration-200 hover:translate-x-0.5" style={{ color: "var(--color-success)", background: "rgba(16,185,129,0.08)" }}>
                                Mappa
                            </Link>
                        </div>
                        {bridges.length === 0 ? (
                            <p className="text-text-muted text-[0.875rem] text-center py-8 font-body">
                                La tua rete di ponti si sta caricando. Continua a navigare su LinkedIn!
                            </p>
                        ) : (
                            <div className="flex flex-col">
                                {bridges.slice(0, 4).map((t, i) => <BridgeCard key={i} t={t} />)}
                                {bridges.length > 4 && (
                                    <Link href="/dashboard/reach" className="text-[0.8125rem] text-text-muted text-center no-underline block mt-4 font-semibold hover:text-text-main font-body">
                                        + esplora altri {bridges.length - 4} percorsi
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>}

                {/* Post rilevanti oggi */}
                {relevantPosts.length > 0 && (
                    <div className="bg-white border border-black/[0.06] rounded-lg p-8 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] mt-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-[1.25rem] font-bold text-text-main font-display">📌 Post rilevanti oggi</h2>
                            <span className="text-[0.8rem] font-semibold text-text-muted font-body">Ultimi 24h</span>
                        </div>
                        <div className="flex flex-col gap-4">
                            {relevantPosts.map((p, i) => (
                                <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-black/[0.05] bg-bg-light hover:border-brand-blue/30 hover:bg-white transition-all duration-200">
                                    <div className="w-8 h-8 rounded-full bg-brand-blue/10 flex items-center justify-center flex-shrink-0 text-brand-blue font-extrabold text-[0.75rem] font-display">
                                        {(p.author_name || "?")[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-[0.9rem] text-text-main font-body mb-0.5">{p.author_name || "—"}</p>
                                        <p className="text-[0.8125rem] text-text-muted font-body leading-relaxed line-clamp-2">
                                            {p.post_text?.slice(0, 120) || "—"}
                                        </p>
                                    </div>
                                    {p.post_url && (
                                        <a
                                            href={p.post_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-shrink-0 px-3 py-1.5 bg-brand-blue text-white rounded-lg text-[0.78rem] font-bold no-underline hover:opacity-90 transition-opacity font-body whitespace-nowrap"
                                        >
                                            Commenta →
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Trends */}
                {(stats?.posts_analyzed ?? 1) > 0 && <div className="bg-white border border-black/[0.06] rounded-lg p-8 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] mt-8">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-[1.25rem] font-bold text-text-main font-display">🔥 Trending Topics (dal tuo Feed)</h2>
                        <span className="text-[0.875rem] font-semibold text-brand-blue px-4 py-2 bg-brand-soft rounded-lg font-body">Live Intelligence</span>
                    </div>
                    {trends.length === 0 ? (
                        <p className="text-text-muted text-[0.875rem] text-center py-8 font-body">
                            Analizzando il tuo feed per identificare i trend più caldi...
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-3 py-2">
                            {trends.map((t, i) => (
                                <div key={i} className="inline-flex items-center bg-white border border-black/[0.06] px-[0.85rem] py-2 rounded-xl shadow-[0_2px_4px_rgba(0,0,0,0.02)] transition-all duration-200 cursor-default hover:border-brand-blue hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(37,99,235,0.08)]">
                                    <span className="font-bold text-[0.875rem] text-text-main mr-2 font-body">#{t.name}</span>
                                    <span className="text-[0.75rem] font-extrabold text-brand-blue bg-brand-soft px-[0.45rem] py-[0.15rem] rounded-[6px] font-body">{t.count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>}

                {/* Footer */}
                <footer className="mt-10 px-6 py-5 bg-white border border-black/[0.06] rounded-md flex items-center gap-3 text-[0.875rem] text-text-muted font-body">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--color-success)" }} />
                    <p className="m-0">
                        Connesso come <strong className="text-text-main">{user.email}</strong> via {user.auth_provider}
                    </p>
                </footer>
            </main>
        </div>
    );
}
