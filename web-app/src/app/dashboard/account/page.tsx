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

/* ── Helpers ─────────────────────────────────────────────────────────────── */
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

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID || "";

const GOAL_LABEL: Record<string, string> = {
    presence: "Essere più presente senza doverci pensare",
    network:  "Costruire relazioni che aprono porte",
};
const TONE_LABEL: Record<string, string> = {
    professional:   "Professionale",
    direct:         "Diretto",
    conversational: "Conversazionale",
};
const TIER_META: Record<string, { label: string; color: string; bg: string; description: string }> = {
    free:    { label: "Free",    color: "#64748b", bg: "rgba(100,116,139,0.1)", description: "5 commenti AI al giorno" },
    starter: { label: "Starter", color: "#2563eb", bg: "rgba(37,99,235,0.1)",   description: "Commenti illimitati + Bridge Map" },
    pro:     { label: "Pro",     color: "#7c3aed", bg: "rgba(124,58,237,0.1)",  description: "Tutto Starter + Piano editoriale AI" },
};

/* ── Sub-components ──────────────────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="bg-white border border-[#e8edf3] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f0f4f8]">
                <h2 className="text-[0.78rem] font-bold tracking-[0.07em] uppercase text-[#94a3b8] m-0 font-body">
                    {title}
                </h2>
            </div>
            <div className="px-6 py-5">{children}</div>
        </section>
    );
}

function Field({ label, value, pill, pillColor, pillBg }: {
    label: string; value: string;
    pill?: boolean; pillColor?: string; pillBg?: string;
}) {
    return (
        <div className="flex justify-between items-center py-[0.6rem] border-b border-[#f8fafc] last:border-0">
            <span className="text-[0.875rem] text-text-muted font-body">{label}</span>
            {pill ? (
                <span
                    className="text-[0.75rem] font-bold px-[0.65rem] py-[0.2rem] rounded-[20px] font-body"
                    style={{ color: pillColor || "#2563eb", background: pillBg || "rgba(37,99,235,0.08)" }}
                >
                    {value}
                </span>
            ) : (
                <span className="text-[0.875rem] font-semibold text-text-main font-body">
                    {value || "—"}
                </span>
            )}
        </div>
    );
}

/* ── Main ────────────────────────────────────────────────────────────────── */
export default function AccountPage() {
    const [user, setUser] = useState<User | null>(null);
    const [usage, setUsage] = useState<Usage | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [editForm, setEditForm] = useState({ goal: "", sector: "", role: "", tone: "" });

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
                    .catch(() => {})
                    .finally(() => setLoading(false));
            })
            .catch(() => { window.location.href = AUTH_LOGIN_URL; });
    }, []);

    const startEdit = () => {
        if (!user) return;
        setEditForm({ goal: user.onboarding_goal, sector: user.sector, role: user.role, tone: user.preferred_tone });
        setEditing(true);
        setSaveSuccess(false);
    };

    const handleSavePreferences = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const res = await fetch(`${AUTH_URL}/profile`, {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ goal: editForm.goal, sector: editForm.sector, role: editForm.role, tone: editForm.tone }),
            });
            if (!res.ok) throw new Error("Errore nel salvataggio");

            // Aggiorna lo stato locale
            setUser(u => u ? { ...u, onboarding_goal: editForm.goal, sector: editForm.sector, role: editForm.role, preferred_tone: editForm.tone } : u);
            setEditing(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);

            // Rigenera JWT e aggiorna il plugin
            const tokenRes = await fetch(`${AUTH_URL}/plugin-token`, { credentials: "include" });
            if (tokenRes.ok) {
                const { token, signing_secret } = await tokenRes.json();
                if (token && signing_secret && EXTENSION_ID) {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (window as any).chrome?.runtime?.sendMessage(EXTENSION_ID, {
                            action: "LOGIN_SUCCESS", jwt: token, secret: signing_secret,
                        });
                    } catch { /* extension non disponibile */ }
                }
            }
        } catch {
            alert("Errore nel salvataggio. Riprova.");
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        await fetch(`${AUTH_URL}/logout-web`, { method: "POST", credentials: "include" });
        window.location.href = AUTH_LOGIN_URL;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-2 flex items-center justify-center">
                <div className="spinner w-9 h-9 border-[3px]" style={{ borderTopColor: "var(--accent-blue)" }} />
            </div>
        );
    }

    if (!user) return null;

    const tier = TIER_META[user.tier] || TIER_META.free;
    const usedComments = usage?.comments_today ?? 0;
    const limitComments = usage?.daily_limit ?? 5;
    const usagePercent = Math.min(100, Math.round((usedComments / limitComments) * 100));
    const color = avatarColor(user.full_name || user.email);

    return (
        <div className="min-h-screen bg-surface-2">
            <DashboardNav userName={user.full_name || user.email} avatarUrl={user.avatar_url} />

            <main className="max-w-account mx-auto px-6 py-10 pb-16">

                {/* Hero profile */}
                <div className="bg-white border border-[#e8edf3] rounded-[20px] p-8 mb-5 flex items-center gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-br from-transparent to-brand-blue/[0.03] pointer-events-none" />

                    <div
                        className="w-[72px] h-[72px] rounded-full flex-shrink-0 flex items-center justify-center text-[1.6rem] font-extrabold select-none font-display tracking-[-0.02em]"
                        style={{ background: color.bg, color: color.text, boxShadow: `0 4px 20px ${color.bg}55` }}
                    >
                        {getInitials(user)}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-[1.35rem] font-bold text-text-main font-display m-0 tracking-[-0.02em]">
                                {user.full_name || user.email.split("@")[0]}
                            </h1>
                            <span
                                className="text-[0.72rem] font-extrabold px-[0.6rem] py-[0.2rem] rounded-[20px] tracking-[0.06em] uppercase font-body"
                                style={{ color: tier.color, background: tier.bg }}
                            >
                                {tier.label}
                            </span>
                        </div>
                        <p className="text-[0.875rem] text-text-muted mb-3 font-body">{user.email}</p>
                        <div className="flex gap-2 flex-wrap">
                            <span className="text-[0.75rem] text-[#94a3b8] bg-[#f1f5f9] px-[0.6rem] py-[0.2rem] rounded-lg font-body">
                                via {user.auth_provider === "linkedin" ? "LinkedIn OAuth" : "Email"}
                            </span>
                            {user.extension_linked && (
                                <span className="text-[0.75rem] text-success bg-success/[0.08] px-[0.6rem] py-[0.2rem] rounded-lg font-body">
                                    ✓ Plugin collegato
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2-col grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                    <Section title="Profilo">
                        <Field label="Email" value={user.email} />
                        <Field label="Nome" value={user.full_name || "—"} />
                        <Field
                            label="Accesso"
                            value={user.auth_provider === "linkedin" ? "LinkedIn OAuth" : "Email / Password"}
                            pill pillColor="#0077b5" pillBg="rgba(0,119,181,0.08)"
                        />
                        <Field
                            label="Onboarding"
                            value={user.onboarding_complete ? "Completato" : "In corso"}
                            pill
                            pillColor={user.onboarding_complete ? "#059669" : "#d97706"}
                            pillBg={user.onboarding_complete ? "rgba(16,185,129,0.08)" : "rgba(217,119,6,0.08)"}
                        />
                    </Section>

                    <section className="bg-white border border-[#e8edf3] rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-[#f0f4f8] flex items-center justify-between">
                            <h2 className="text-[0.78rem] font-bold tracking-[0.07em] uppercase text-[#94a3b8] m-0 font-body">
                                Preferenze AI
                            </h2>
                            {!editing ? (
                                <button onClick={startEdit} className="text-[0.78rem] font-semibold text-brand-blue bg-brand-soft px-3 py-1 rounded-lg border-none cursor-pointer font-body hover:bg-brand-blue/[0.12] transition-colors">
                                    Modifica
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={() => setEditing(false)} className="text-[0.78rem] font-semibold text-text-muted bg-transparent px-3 py-1 rounded-lg border border-[#e2e8f0] cursor-pointer font-body">
                                        Annulla
                                    </button>
                                    <button onClick={handleSavePreferences} disabled={saving} className="text-[0.78rem] font-semibold text-white bg-brand-blue px-3 py-1 rounded-lg border-none cursor-pointer font-body disabled:opacity-60">
                                        {saving ? "Salvataggio..." : "Salva"}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-5">
                            {saveSuccess && (
                                <div className="mb-3 px-3 py-2 bg-success/[0.08] border border-success/20 rounded-lg text-[0.8rem] text-success font-semibold font-body">
                                    ✓ Preferenze salvate e plugin aggiornato
                                </div>
                            )}
                            {!editing ? (
                                <>
                                    <Field label="Obiettivo" value={GOAL_LABEL[user.onboarding_goal] || user.onboarding_goal || "—"} />
                                    <Field label="Settore" value={user.sector || "—"} />
                                    <Field label="Ruolo" value={user.role || "—"} />
                                    <Field label="Tono" value={TONE_LABEL[user.preferred_tone] || user.preferred_tone || "—"} pill pillColor="#2563eb" pillBg="rgba(37,99,235,0.08)" />
                                </>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {[
                                        { label: "Obiettivo", key: "goal" as const, type: "select", options: [{ v: "presence", l: "Essere più presente" }, { v: "network", l: "Costruire relazioni" }] },
                                        { label: "Settore", key: "sector" as const, type: "text" },
                                        { label: "Ruolo", key: "role" as const, type: "text" },
                                        { label: "Tono", key: "tone" as const, type: "select", options: [{ v: "professional", l: "Professionale" }, { v: "direct", l: "Diretto" }, { v: "conversational", l: "Conversazionale" }] },
                                    ].map(field => (
                                        <div key={field.key} className="flex justify-between items-center py-2 border-b border-[#f8fafc] last:border-0 gap-4">
                                            <span className="text-[0.875rem] text-text-muted font-body flex-shrink-0">{field.label}</span>
                                            {field.type === "select" ? (
                                                <select
                                                    value={editForm[field.key]}
                                                    onChange={e => setEditForm(f => ({ ...f, [field.key]: e.target.value }))}
                                                    className="text-[0.875rem] font-semibold text-text-main font-body border border-[#e2e8f0] rounded-lg px-3 py-1.5 bg-white outline-none focus:border-brand-blue"
                                                >
                                                    {field.options?.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={editForm[field.key]}
                                                    onChange={e => setEditForm(f => ({ ...f, [field.key]: e.target.value }))}
                                                    className="text-[0.875rem] font-semibold text-text-main font-body border border-[#e2e8f0] rounded-lg px-3 py-1.5 bg-white outline-none focus:border-brand-blue w-48"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {/* Piano & Utilizzo */}
                <div className="mb-5">
                    <Section title="Piano & Utilizzo">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            <div>
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-2xl font-extrabold font-display" style={{ color: tier.color }}>
                                        {tier.label}
                                    </span>
                                    <span className="text-[0.82rem] text-text-muted font-body">{tier.description}</span>
                                </div>
                                {user.tier === "free" && (
                                    <button
                                        disabled
                                        title="Disponibile a breve"
                                        className="px-5 py-[0.6rem] rounded-[10px] text-[0.82rem] font-bold text-white border-none cursor-not-allowed opacity-70 font-body"
                                        style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)" }}
                                    >
                                        Passa a Starter — €19/mese ✦
                                    </button>
                                )}
                            </div>
                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-[0.8rem] text-text-muted font-body">Commenti AI oggi</span>
                                    <span
                                        className="text-[0.8rem] font-bold font-body"
                                        style={{ color: usage?.is_limit_reached ? "#ef4444" : "var(--text-main)" }}
                                    >
                                        {usedComments} / {limitComments}
                                    </span>
                                </div>
                                <div className="h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-[width] duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                                        style={{
                                            width: `${usagePercent}%`,
                                            background: usagePercent >= 100 ? "#ef4444" : usagePercent >= 80 ? "#f59e0b" : "linear-gradient(90deg, #2563eb, #3b82f6)",
                                        }}
                                    />
                                </div>
                                {usage?.is_limit_reached && (
                                    <p className="text-[0.75rem] text-error mt-1 font-body">
                                        Limite raggiunto — si resetta a mezzanotte
                                    </p>
                                )}
                            </div>
                        </div>
                    </Section>
                </div>

                {/* Estensione Chrome */}
                <div className="mb-5">
                    <Section title="Estensione Chrome">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                                    style={{
                                        background: user.extension_linked ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.08)",
                                    }}
                                >
                                    {user.extension_linked ? "✓" : "🔌"}
                                </div>
                                <div>
                                    <p className="text-[0.9rem] font-semibold text-text-main m-0 mb-[0.2rem] font-body">
                                        {user.extension_linked ? "Plugin collegato al tuo account" : "Plugin non ancora collegato"}
                                    </p>
                                    <p className="text-[0.8rem] text-[#94a3b8] m-0 font-body">
                                        {user.extension_linked
                                            ? "Il plugin invia i dati al tuo grafo automaticamente"
                                            : "Installa il plugin e fai login per collegarlo"}
                                    </p>
                                </div>
                            </div>
                            {!user.extension_linked && (
                                <a
                                    href="/onboarding"
                                    className="px-[1.1rem] py-[0.55rem] rounded-[10px] text-[0.82rem] font-semibold no-underline whitespace-nowrap font-body hover:opacity-80 transition-opacity"
                                    style={{ background: "rgba(37,99,235,0.08)", color: "#2563eb", border: "1px solid rgba(37,99,235,0.2)" }}
                                >
                                    Installa →
                                </a>
                            )}
                        </div>
                    </Section>
                </div>

                {/* Azioni */}
                <div className="flex justify-between items-center px-5 py-4 bg-white border border-[#e8edf3] rounded-xl">
                    <p className="text-[0.8rem] text-[#94a3b8] m-0 font-body">
                        Sessione attiva · ID #{user.user_id}
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-transparent text-text-muted border border-[#e2e8f0] rounded-lg text-[0.82rem] font-semibold cursor-pointer font-body hover:border-[#cbd5e1] transition-colors"
                        >
                            Esci
                        </button>
                        <button
                            disabled
                            title="Disponibile a breve"
                            className="px-4 py-2 bg-transparent border border-red-500/20 rounded-lg text-[0.82rem] font-semibold cursor-not-allowed opacity-50 font-body"
                            style={{ color: "#ef4444" }}
                        >
                            Elimina account
                        </button>
                    </div>
                </div>

            </main>
        </div>
    );
}
