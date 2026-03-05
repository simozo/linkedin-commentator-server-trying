"use client";

import { useEffect, useState } from "react";
import DashboardNav from "../components/DashboardNav";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:4000";
const AUTH_LOGIN_URL = process.env.NEXT_PUBLIC_AUTH_LOGIN_URL || "http://localhost:4000/login";
const DASH_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:5001";

interface User {
    user_id: number;
    email: string;
    full_name?: string;
    avatar_url?: string;
    auth_provider: string;
    tier: string;
    onboarding_complete: boolean;
    onboarding_goal: string;
    sector: string;
    role: string;
    preferred_tone: string;
    extension_linked: boolean;
}

interface Usage {
    comments_today: number;
    daily_limit: number;
    graph_maturity: number;
    nodes_count: number;
    is_limit_reached: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
    { bg: "#2563eb", text: "#fff" },
    { bg: "#0e7490", text: "#fff" },
    { bg: "#7c3aed", text: "#fff" },
    { bg: "#059669", text: "#fff" },
    { bg: "#d97706", text: "#fff" },
    { bg: "#dc2626", text: "#fff" },
    { bg: "#0f172a", text: "#fff" },
];

function avatarColor(seed: string) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getInitials(user: User): string {
    const name = user.full_name || user.email.split("@")[0];
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const GOAL_LABEL: Record<string, string> = {
    presence: "Essere più presente senza doverci pensare",
    network: "Costruire relazioni che aprono porte",
};
const TONE_LABEL: Record<string, string> = {
    professional: "Professionale", Professionale: "Professionale",
    direct: "Diretto", Diretto: "Diretto",
    conversational: "Conversazionale", Conversazionale: "Conversazionale",
};
const TIER_META: Record<string, { label: string; color: string; bg: string; description: string }> = {
    free: { label: "Free", color: "#64748b", bg: "rgba(100,116,139,0.1)", description: "5 commenti AI al giorno" },
    starter: { label: "Starter", color: "#2563eb", bg: "rgba(37,99,235,0.1)", description: "Commenti illimitati + Bridge Map" },
    pro: { label: "Pro", color: "#7c3aed", bg: "rgba(124,58,237,0.1)", description: "Tutto Starter + Piano editoriale AI" },
};

// ── Sub-components ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section style={{
            background: "#fff",
            border: "1px solid #e8edf3",
            borderRadius: 16,
            overflow: "hidden",
        }}>
            <div style={{
                padding: "1rem 1.5rem",
                borderBottom: "1px solid #f0f4f8",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
            }}>
                <h2 style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                    margin: 0,
                    fontFamily: "var(--font-body)",
                }}>
                    {title}
                </h2>
            </div>
            <div style={{ padding: "1.25rem 1.5rem" }}>
                {children}
            </div>
        </section>
    );
}

function Field({ label, value, pill, pillColor, pillBg }: {
    label: string;
    value: string;
    pill?: boolean;
    pillColor?: string;
    pillBg?: string;
}) {
    return (
        <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.6rem 0",
            borderBottom: "1px solid #f8fafc",
        }}>
            <span style={{ fontSize: "0.875rem", color: "#64748b", fontFamily: "var(--font-body)" }}>
                {label}
            </span>
            {pill ? (
                <span style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: pillColor || "#2563eb",
                    background: pillBg || "rgba(37,99,235,0.08)",
                    padding: "0.2rem 0.65rem",
                    borderRadius: 20,
                    fontFamily: "var(--font-body)",
                }}>
                    {value}
                </span>
            ) : (
                <span style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "#1a1a24",
                    fontFamily: "var(--font-body)",
                }}>
                    {value || "—"}
                </span>
            )}
        </div>
    );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function AccountPage() {
    const [user, setUser] = useState<User | null>(null);
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
                fetch(`${DASH_URL}/api/user/usage`, { credentials: "include" })
                    .then(r => r.ok ? r.json() : null)
                    .then(data => { if (data) setUsage(data); })
                    .catch(() => { })
                    .finally(() => setLoading(false));
            })
            .catch(() => { window.location.href = AUTH_LOGIN_URL; });
    }, []);

    const handleLogout = async () => {
        await fetch(`${AUTH_URL}/logout-web`, { method: "POST", credentials: "include" });
        window.location.href = AUTH_LOGIN_URL;
    };

    if (loading) {
        return (
            <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderTopColor: "var(--accent-blue)" }} />
            </div>
        );
    }

    if (!user) return null;

    const tier = TIER_META[user.tier] || TIER_META.free;
    const usedComments = usage?.comments_today ?? 0;
    const limitComments = usage?.daily_limit ?? 5;
    const usagePercent = Math.min(100, Math.round((usedComments / limitComments) * 100));

    return (
        <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
            <DashboardNav userName={user.full_name || user.email} avatarUrl={user.avatar_url} />

            <main style={{ maxWidth: 780, margin: "0 auto", padding: "2.5rem 1.5rem 4rem" }}>

                {/* ── Hero profile ── */}
                <div style={{
                    background: "#fff",
                    border: "1px solid #e8edf3",
                    borderRadius: 20,
                    padding: "2rem",
                    marginBottom: "1.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1.5rem",
                    position: "relative",
                    overflow: "hidden",
                }}>
                    {/* Background accent */}
                    <div style={{
                        position: "absolute", top: 0, right: 0,
                        width: 260, height: "100%",
                        background: "linear-gradient(135deg, transparent, rgba(37,99,235,0.03))",
                        pointerEvents: "none",
                    }} />

                    {/* Avatar */}
                    {(() => {
                        const color = avatarColor(user.full_name || user.email);
                        return (
                            <div style={{
                                width: 72, height: 72, borderRadius: "50%", flexShrink: 0,
                                background: color.bg,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.6rem", fontWeight: 800, color: color.text,
                                boxShadow: `0 4px 20px ${color.bg}55`,
                                fontFamily: "var(--font-display)",
                                letterSpacing: "-0.02em",
                                userSelect: "none",
                            }}>
                                {getInitials(user)}
                            </div>
                        );
                    })()}

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
                            <h1 style={{
                                fontSize: "1.35rem", fontWeight: 700, color: "#1a1a24",
                                fontFamily: "var(--font-display)", margin: 0,
                                letterSpacing: "-0.02em",
                            }}>
                                {user.full_name || user.email.split("@")[0]}
                            </h1>
                            <span style={{
                                fontSize: "0.72rem", fontWeight: 800,
                                color: tier.color, background: tier.bg,
                                padding: "0.2rem 0.6rem", borderRadius: 20,
                                letterSpacing: "0.06em", textTransform: "uppercase",
                                fontFamily: "var(--font-body)",
                            }}>
                                {tier.label}
                            </span>
                        </div>
                        <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0 0 0.75rem", fontFamily: "var(--font-body)" }}>
                            {user.email}
                        </p>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            <span style={{
                                fontSize: "0.75rem", color: "#94a3b8",
                                background: "#f1f5f9", padding: "0.2rem 0.6rem",
                                borderRadius: 8, fontFamily: "var(--font-body)",
                            }}>
                                via {user.auth_provider === "linkedin" ? "LinkedIn OAuth" : "Email"}
                            </span>
                            {user.extension_linked && (
                                <span style={{
                                    fontSize: "0.75rem", color: "#059669",
                                    background: "rgba(16,185,129,0.08)", padding: "0.2rem 0.6rem",
                                    borderRadius: 8, fontFamily: "var(--font-body)",
                                }}>
                                    ✓ Plugin collegato
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Grid 2 colonne ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.25rem" }}>

                    {/* Profilo */}
                    <Section title="Profilo">
                        <Field label="Email" value={user.email} />
                        <Field label="Nome" value={user.full_name || "—"} />
                        <Field
                            label="Accesso"
                            value={user.auth_provider === "linkedin" ? "LinkedIn OAuth" : "Email / Password"}
                            pill
                            pillColor="#0077b5"
                            pillBg="rgba(0,119,181,0.08)"
                        />
                        <Field
                            label="Onboarding"
                            value={user.onboarding_complete ? "Completato" : "In corso"}
                            pill
                            pillColor={user.onboarding_complete ? "#059669" : "#d97706"}
                            pillBg={user.onboarding_complete ? "rgba(16,185,129,0.08)" : "rgba(217,119,6,0.08)"}
                        />
                    </Section>

                    {/* Preferenze AI */}
                    <Section title="Preferenze AI">
                        <Field
                            label="Obiettivo"
                            value={GOAL_LABEL[user.onboarding_goal] || user.onboarding_goal || "—"}
                        />
                        <Field label="Settore" value={user.sector || "—"} />
                        <Field label="Ruolo" value={user.role || "—"} />
                        <Field
                            label="Tono"
                            value={TONE_LABEL[user.preferred_tone] || user.preferred_tone || "—"}
                            pill
                            pillColor="#2563eb"
                            pillBg="rgba(37,99,235,0.08)"
                        />
                    </Section>
                </div>

                {/* ── Piano & Utilizzo ── */}
                <div style={{ marginBottom: "1.25rem" }}>
                    <Section title="Piano & Utilizzo">
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>

                            {/* Piano corrente */}
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                                    <span style={{
                                        fontSize: "1.5rem", fontWeight: 800, color: tier.color,
                                        fontFamily: "var(--font-display)",
                                    }}>
                                        {tier.label}
                                    </span>
                                    <span style={{ fontSize: "0.82rem", color: "#64748b", fontFamily: "var(--font-body)" }}>
                                        {tier.description}
                                    </span>
                                </div>
                                {user.tier === "free" && (
                                    <button
                                        style={{
                                            padding: "0.6rem 1.25rem",
                                            background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                                            color: "#fff", border: "none", borderRadius: 10,
                                            fontSize: "0.82rem", fontWeight: 700,
                                            cursor: "not-allowed", opacity: 0.7,
                                            fontFamily: "var(--font-body)",
                                            letterSpacing: "0.01em",
                                        }}
                                        disabled
                                        title="Disponibile a breve"
                                    >
                                        Passa a Starter — €19/mese ✦
                                    </button>
                                )}
                            </div>

                            {/* Utilizzo giornaliero */}
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                                    <span style={{ fontSize: "0.8rem", color: "#64748b", fontFamily: "var(--font-body)" }}>
                                        Commenti AI oggi
                                    </span>
                                    <span style={{
                                        fontSize: "0.8rem", fontWeight: 700, fontFamily: "var(--font-body)",
                                        color: usage?.is_limit_reached ? "#ef4444" : "#1a1a24",
                                    }}>
                                        {usedComments} / {limitComments}
                                    </span>
                                </div>
                                <div style={{
                                    height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden",
                                }}>
                                    <div style={{
                                        height: "100%", borderRadius: 4,
                                        width: `${usagePercent}%`,
                                        background: usagePercent >= 100
                                            ? "#ef4444"
                                            : usagePercent >= 80
                                                ? "#f59e0b"
                                                : "linear-gradient(90deg, #2563eb, #3b82f6)",
                                        transition: "width 0.8s cubic-bezier(0.34,1.56,0.64,1)",
                                    }} />
                                </div>
                                {usage?.is_limit_reached && (
                                    <p style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "0.4rem", fontFamily: "var(--font-body)" }}>
                                        Limite raggiunto — si resetta a mezzanotte
                                    </p>
                                )}
                            </div>
                        </div>
                    </Section>
                </div>

                {/* ── Estensione ── */}
                <div style={{ marginBottom: "1.25rem" }}>
                    <Section title="Estensione Chrome">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 12,
                                    background: user.extension_linked
                                        ? "rgba(16,185,129,0.1)"
                                        : "rgba(239,68,68,0.08)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "1.25rem", flexShrink: 0,
                                }}>
                                    {user.extension_linked ? "✓" : "🔌"}
                                </div>
                                <div>
                                    <p style={{
                                        fontSize: "0.9rem", fontWeight: 600, color: "#1a1a24",
                                        margin: "0 0 0.2rem", fontFamily: "var(--font-body)",
                                    }}>
                                        {user.extension_linked
                                            ? "Plugin collegato al tuo account"
                                            : "Plugin non ancora collegato"}
                                    </p>
                                    <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0, fontFamily: "var(--font-body)" }}>
                                        {user.extension_linked
                                            ? "Il plugin invia i dati al tuo grafo automaticamente"
                                            : "Installa il plugin e fai login per collegarlo"}
                                    </p>
                                </div>
                            </div>
                            {!user.extension_linked && (
                                <a
                                    href="/onboarding"
                                    style={{
                                        padding: "0.55rem 1.1rem",
                                        background: "rgba(37,99,235,0.08)", color: "#2563eb",
                                        border: "1px solid rgba(37,99,235,0.2)",
                                        borderRadius: 10, fontSize: "0.82rem", fontWeight: 600,
                                        textDecoration: "none", fontFamily: "var(--font-body)",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    Installa →
                                </a>
                            )}
                        </div>
                    </Section>
                </div>

                {/* ── Azioni account ── */}
                <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "1rem 1.25rem",
                    background: "#fff", border: "1px solid #e8edf3", borderRadius: 12,
                }}>
                    <div>
                        <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0, fontFamily: "var(--font-body)" }}>
                            Sessione attiva · ID #{user.user_id}
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem" }}>
                        <button
                            onClick={handleLogout}
                            style={{
                                padding: "0.5rem 1rem",
                                background: "transparent", color: "#64748b",
                                border: "1px solid #e2e8f0", borderRadius: 8,
                                fontSize: "0.82rem", fontWeight: 600,
                                cursor: "pointer", fontFamily: "var(--font-body)",
                            }}
                        >
                            Esci
                        </button>
                        <button
                            disabled
                            title="Disponibile a breve"
                            style={{
                                padding: "0.5rem 1rem",
                                background: "transparent", color: "#ef4444",
                                border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8,
                                fontSize: "0.82rem", fontWeight: 600,
                                cursor: "not-allowed", opacity: 0.5, fontFamily: "var(--font-body)",
                            }}
                        >
                            Elimina account
                        </button>
                    </div>
                </div>

            </main>
        </div>
    );
}
