"use client";

import { useEffect, useState } from "react";
import DashboardNav from "../components/DashboardNav";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:4000";
const AUTH_LOGIN_URL = process.env.NEXT_PUBLIC_AUTH_LOGIN_URL || "http://localhost:4000/login";

interface User { user_id: number; email: string; full_name?: string; avatar_url?: string; tier: string; }

const PLANS = [
    {
        id: "free",
        name: "Free",
        price: "€0",
        period: "",
        description: "Per iniziare a esplorare",
        color: "#64748b",
        features: [
            { text: "5 commenti AI al giorno", included: true },
            { text: "Feed Observer passivo", included: true },
            { text: "Dashboard base", included: true },
            { text: "Commenti illimitati", included: false },
            { text: "Warm Reach Map completa", included: false },
            { text: "Piano editoriale AI", included: false },
            { text: "Analytics avanzate", included: false },
        ],
        cta: "Piano attuale",
        ctaDisabled: true,
    },
    {
        id: "starter",
        name: "Starter",
        price: "€19",
        period: "/mese",
        description: "Per chi vuole crescere con costanza",
        color: "#2563eb",
        highlight: true,
        features: [
            { text: "Commenti AI illimitati", included: true },
            { text: "Feed Observer passivo", included: true },
            { text: "Dashboard completa", included: true },
            { text: "Warm Reach Map completa", included: true },
            { text: "Export dati CSV", included: true },
            { text: "Piano editoriale AI", included: false },
            { text: "Analytics avanzate", included: false },
        ],
        cta: "Passa a Starter",
        ctaDisabled: true,
        badge: "Più popolare",
    },
    {
        id: "pro",
        name: "Pro",
        price: "€49",
        period: "/mese",
        description: "Per chi fa del LinkedIn il suo lavoro",
        color: "#7c3aed",
        features: [
            { text: "Tutto di Starter", included: true },
            { text: "Piano editoriale AI", included: true },
            { text: "Analytics avanzate", included: true },
            { text: "CRM contatti integrato", included: true },
            { text: "Supporto prioritario", included: true },
            { text: "API access", included: true },
            { text: "Team workspace (prossimamente)", included: true },
        ],
        cta: "Passa a Pro",
        ctaDisabled: true,
    },
];

export default function UpgradePage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [waitlistEmail, setWaitlistEmail] = useState("");
    const [waitlistDone, setWaitlistDone] = useState(false);

    useEffect(() => {
        fetch(`${AUTH_URL}/me`, { credentials: "include" })
            .then(res => {
                if (!res.ok) { window.location.href = AUTH_LOGIN_URL; return null; }
                return res.json();
            })
            .then((u: User | null) => { if (u) setUser(u); })
            .catch(() => { window.location.href = AUTH_LOGIN_URL; })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-bg-light flex items-center justify-center">
                <div className="spinner w-10 h-10 border-[3px]" style={{ borderTopColor: "var(--accent-blue)" }} />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-bg-light">
            <DashboardNav userName={user.full_name || user.email} avatarUrl={undefined} />

            <main className="max-w-[960px] mx-auto px-6 py-12">
                {/* Header */}
                <header className="text-center mb-12">
                    <h1 className="text-[2.25rem] font-bold text-text-main tracking-[-0.04em] mb-3 font-display">
                        Scegli il tuo piano
                    </h1>
                    <p className="text-base text-text-muted font-body max-w-lg mx-auto">
                        Sblocca il pieno potenziale del tuo LinkedIn Grow. Cancella quando vuoi.
                    </p>
                </header>

                {/* Plans grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    {PLANS.map(plan => {
                        const isCurrent = user.tier === plan.id;
                        return (
                            <div
                                key={plan.id}
                                className={[
                                    "bg-white rounded-2xl p-8 flex flex-col transition-all duration-200 relative",
                                    plan.highlight
                                        ? "border-2 shadow-[0_8px_30px_rgba(37,99,235,0.12)] -translate-y-1"
                                        : "border border-black/[0.06] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]",
                                ].join(" ")}
                                style={plan.highlight ? { borderColor: plan.color } : {}}
                            >
                                {plan.badge && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[0.75rem] font-bold text-white font-body" style={{ background: plan.color }}>
                                        {plan.badge}
                                    </div>
                                )}
                                {isCurrent && (
                                    <div className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-[0.7rem] font-bold bg-success/10 text-success font-body">
                                        Attivo
                                    </div>
                                )}

                                <div className="mb-6">
                                    <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] mb-2 font-body" style={{ color: plan.color }}>
                                        {plan.name}
                                    </p>
                                    <div className="flex items-end gap-1 mb-1">
                                        <span className="text-[2.5rem] font-extrabold tracking-[-0.04em] font-display text-text-main">
                                            {plan.price}
                                        </span>
                                        {plan.period && (
                                            <span className="text-text-muted font-body mb-2">{plan.period}</span>
                                        )}
                                    </div>
                                    <p className="text-[0.875rem] text-text-muted font-body">{plan.description}</p>
                                </div>

                                <ul className="flex flex-col gap-2.5 mb-8 flex-1">
                                    {plan.features.map((f, i) => (
                                        <li key={i} className="flex items-start gap-2.5">
                                            <span className={[
                                                "text-sm font-bold flex-shrink-0 mt-0.5",
                                                f.included ? "text-success" : "text-text-muted opacity-40",
                                            ].join(" ")}>
                                                {f.included ? "✓" : "✕"}
                                            </span>
                                            <span className={[
                                                "text-[0.875rem] font-body",
                                                f.included ? "text-text-main" : "text-text-muted opacity-50",
                                            ].join(" ")}>
                                                {f.text}
                                            </span>
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    disabled={plan.ctaDisabled || isCurrent}
                                    className="w-full py-3 rounded-xl text-[0.9rem] font-bold border-none cursor-not-allowed font-body transition-all"
                                    style={{
                                        background: isCurrent || plan.id === "free"
                                            ? "rgba(0,0,0,0.04)"
                                            : plan.color,
                                        color: isCurrent || plan.id === "free" ? "var(--text-muted)" : "#fff",
                                        opacity: plan.ctaDisabled && !isCurrent ? 0.6 : 1,
                                    }}
                                >
                                    {isCurrent ? "Piano attuale" : plan.cta}
                                    {!isCurrent && plan.id !== "free" && " — Prossimamente"}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Waitlist */}
                <div className="bg-white border border-black/[0.06] rounded-2xl p-8 text-center max-w-lg mx-auto">
                    <p className="text-[1.1rem] font-bold text-text-main font-display mb-1">
                        Vuoi essere avvisato al lancio?
                    </p>
                    <p className="text-[0.875rem] text-text-muted font-body mb-5">
                        Stiamo lavorando all&apos;integrazione con Stripe. Lascia la tua email e ti scriviamo appena è pronto.
                    </p>
                    {waitlistDone ? (
                        <p className="text-success font-semibold font-body text-[0.9rem]">
                            ✓ Perfetto! Ti avviseremo presto.
                        </p>
                    ) : (
                        <form
                            onSubmit={e => { e.preventDefault(); if (waitlistEmail) setWaitlistDone(true); }}
                            className="flex gap-2 max-w-sm mx-auto"
                        >
                            <input
                                type="email"
                                placeholder={user.email}
                                value={waitlistEmail}
                                onChange={e => setWaitlistEmail(e.target.value)}
                                className="flex-1 px-4 py-2.5 rounded-lg border border-[#e2e8f0] text-[0.875rem] font-body outline-none focus:border-brand-blue"
                            />
                            <button
                                type="submit"
                                className="px-5 py-2.5 bg-brand-blue text-white rounded-lg text-[0.875rem] font-bold font-body border-none cursor-pointer hover:opacity-90 transition-opacity"
                            >
                                Iscriviti
                            </button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}
