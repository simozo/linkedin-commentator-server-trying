"use client";

import { useState, useEffect } from "react";
import { Logo, Spinner, Button, InfoBanner } from "@/components/ui";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:4000";
const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID || "";

type Goal = "presence" | "network";
type Sector = "Tech" | "Marketing" | "Consulenza" | "Sales" | "Altro";
type Tone = "Professionale" | "Diretto" | "Conversazionale";

// "checking"       → ping iniziale al mount
// "already"        → già installato prima di entrare nello step 3
// "not_installed"  → non trovato, mostra CTA
// "demo"           → utente ha cliccato "Mostrami come funziona"
// "waiting"        → utente ha cliccato installa, polling ogni 2s
// "anim_detected"  → estensione trovata, step 1 animazione
// "anim_linking"   → step 2 animazione
// "anim_complete"  → step 3 animazione, mostra [Continua →]
// "timeout"        → 60s senza rilevamento
type PluginPhase =
    | "checking"
    | "already"
    | "not_installed"
    | "demo"
    | "waiting"
    | "anim_detected"
    | "anim_linking"
    | "anim_complete"
    | "timeout";

const SECTOR_PROOF: Record<Sector, number> = {
    Tech: 312, Marketing: 189, Consulenza: 143, Sales: 97, Altro: 74,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function pingExtension(): Promise<{ ok: boolean; installToken?: string }> {
    return new Promise((resolve) => {
        const cr = (window as unknown as { chrome?: typeof chrome }).chrome;
        if (!EXTENSION_ID || !cr?.runtime?.sendMessage) { resolve({ ok: false }); return; }
        try {
            cr.runtime.sendMessage(EXTENSION_ID, { type: "ping" }, (response) => {
                if (cr.runtime.lastError) { resolve({ ok: false }); return; }
                resolve({ ok: response?.status === "ok", installToken: response?.installToken });
            });
        } catch { resolve({ ok: false }); }
    });
}

function linkExtensionToServer(installToken: string) {
    fetch(`${AUTH_URL}/link-extension`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ install_token: installToken }),
    }).catch(() => { });
}

async function sendTokenToPlugin() {
    const cr = (window as unknown as { chrome?: typeof chrome }).chrome;
    if (!EXTENSION_ID || !cr?.runtime?.sendMessage) return;
    try {
        const res = await fetch(`${AUTH_URL}/plugin-token`, { credentials: "include" });
        if (!res.ok) return;
        const { token, signing_secret } = await res.json();
        cr.runtime.sendMessage(EXTENSION_ID, { action: "LOGIN_SUCCESS", jwt: token, secret: signing_secret });
    } catch { /* non bloccante */ }
}

function notifyExtension(sector: string, tone: string) {
    const cr = (window as unknown as { chrome?: typeof chrome }).chrome;
    if (!EXTENSION_ID || !cr?.runtime?.sendMessage) return;
    try {
        cr.runtime.sendMessage(EXTENSION_ID, { action: "ONBOARDING_COMPLETE", sector, tone });
    } catch { /* non reachable */ }
}

// ── Progress bar ───────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: 1 | 2 | 3 | 4 }) {
    return (
        <div style={{ display: "flex", gap: "0.4rem", marginBottom: "2rem" }}>
            {([1, 2, 3, 4] as const).map(s => (
                <div key={s} style={{
                    flex: 1, height: "4px", borderRadius: "2px",
                    background: s <= step ? "var(--accent-blue)" : "var(--border-soft)",
                    transition: "background 0.3s ease",
                }} />
            ))}
        </div>
    );
}

// ── Step 1: Goal ───────────────────────────────────────────────────────────
// Le card avanzano direttamente con "[Scelgo questo]" — nessun "Avanti →" separato.

function StepGoal({ onNext }: { onNext: (goal: Goal) => void }) {
    const cards: { goal: Goal; emoji: string; lines: string[] }[] = [
        {
            goal: "presence",
            emoji: "💬",
            lines: ["Voglio essere più", "presente su LinkedIn", "senza doverci pensare", "troppo"],
        },
        {
            goal: "network",
            emoji: "🧗",
            lines: ["Voglio costruire", "relazioni che mi", "aprano porte nuove"],
        },
    ];

    return (
        <div>
            <h1 className="auth-title">Cosa vuoi ottenere?</h1>
            <p className="auth-subtitle" style={{ marginBottom: "1.75rem" }}>
                Scegli l&apos;obiettivo principale.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
                {cards.map(({ goal, emoji, lines }) => (
                    <div key={goal} style={{
                        display: "flex", flexDirection: "column",
                        padding: "1.25rem 1rem",
                        border: "1px solid var(--border-soft)",
                        borderRadius: "var(--radius-md)",
                        background: "var(--color-surface-2)",
                        gap: "0.75rem",
                    }}>
                        <span style={{ fontSize: "1.8rem" }}>{emoji}</span>
                        <p style={{ fontSize: "0.88rem", color: "var(--text-main)", lineHeight: 1.5, flex: 1 }}>
                            {lines.map((l, i) => (
                                <span key={i}>{l}{i < lines.length - 1 ? <br /> : null}</span>
                            ))}
                        </p>
                        <Button variant="outline" onClick={() => onNext(goal)}>
                            Scelgo questo
                        </Button>
                    </div>
                ))}
            </div>

            <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Puoi cambiare la tua scelta in qualsiasi momento
            </p>
        </div>
    );
}

// ── Step 2: Profile ────────────────────────────────────────────────────────

function StepProfile({ onNext }: { onNext: (data: { sector: Sector; role: string; tone: Tone }) => void }) {
    const [sector, setSector] = useState<Sector | "">("");
    const [role, setRole] = useState("");
    const [tone, setTone] = useState<Tone>("Professionale");

    const sectors: Sector[] = ["Tech", "Marketing", "Consulenza", "Sales", "Altro"];
    const tones: Tone[] = ["Professionale", "Diretto", "Conversazionale"];

    return (
        <div>
            <h1 className="auth-title">Di cosa ti occupi?</h1>
            <p className="auth-subtitle" style={{ marginBottom: "1.5rem" }}>
                Tre domande rapide. Personalizzano il tuo primo commento AI.
            </p>

            <div className="form-group" style={{ marginBottom: "0.75rem" }}>
                <div className="form-field">
                    <label className="form-label">Settore</label>
                    <select
                        className="form-input"
                        value={sector}
                        onChange={e => setSector(e.target.value as Sector | "")}
                        style={{ cursor: "pointer" }}
                    >
                        <option value="" disabled>Scegli il tuo settore</option>
                        {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <div className="form-field">
                    <label className="form-label">
                        Ruolo{" "}
                        <span style={{ fontWeight: 400, textTransform: "none", fontSize: "0.75rem" }}>
                            (opzionale)
                        </span>
                    </label>
                    <input
                        className="form-input"
                        type="text"
                        placeholder="es. Developer, PM, Freelance"
                        value={role}
                        onChange={e => setRole(e.target.value)}
                    />
                </div>

                <div className="form-field">
                    <label className="form-label">Tono preferito</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        {tones.map(t => (
                            <button
                                key={t}
                                onClick={() => setTone(t)}
                                style={{
                                    flex: 1, padding: "0.6rem 0.4rem",
                                    border: `2px solid ${tone === t ? "var(--accent-blue)" : "var(--border-soft)"}`,
                                    borderRadius: "var(--radius-sm)",
                                    background: tone === t ? "var(--accent-soft)" : "var(--color-surface-2)",
                                    color: tone === t ? "var(--accent-blue)" : "var(--text-muted)",
                                    fontSize: "0.8rem", fontWeight: 600,
                                    cursor: "pointer", fontFamily: "var(--font-body)",
                                    transition: "all 0.2s",
                                }}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Social proof contestuale — appare dopo selezione settore */}
            {sector && (
                <InfoBanner variant="success" style={{ marginBottom: "0.75rem" }}>
                    <span>✓</span>
                    <span>
                        Ti unisci a <strong>{SECTOR_PROOF[sector as Sector] ?? 74}</strong> persone
                        nel settore {sector} già su LinkedIn Grow
                    </span>
                </InfoBanner>
            )}

            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: 1.5 }}>
                ℹ️ Usiamo questi dati solo per personalizzare i tuoi commenti. Non li condividiamo con nessuno.
            </p>

            <Button
                fullWidth
                disabled={!sector}
                onClick={() => sector && onNext({ sector: sector as Sector, role, tone })}
            >
                Avanti →
            </Button>
        </div>
    );
}

// ── Step 3: Extension ──────────────────────────────────────────────────────

function StepExtension({ sector, tone, onNext }: { sector: Sector; tone: Tone; onNext: () => void }) {
    const [phase, setPhase] = useState<PluginPhase>("checking");
    const [verifying, setVerifying] = useState(false);
    const [verifyFailed, setVerifyFailed] = useState(false);

    // 1. Ping on mount
    useEffect(() => {
        pingExtension().then(({ ok, installToken }) => {
            if (ok) {
                if (installToken) linkExtensionToServer(installToken);
                sendTokenToPlugin();
            }
            setPhase(ok ? "already" : "not_installed");
        });
    }, []);

    // 2. Già installato → notifica estensione
    useEffect(() => {
        if (phase !== "already") return;
        notifyExtension(sector, tone);
    }, [phase, sector, tone]);

    // 3. Polling quando "waiting"
    // Intervallo breve (800ms) nei primi 15 tentativi per catturare subito il wake-up
    // del service worker dopo che l'estensione viene riattivata; poi 2s.
    useEffect(() => {
        if (phase !== "waiting") return;
        let cancelled = false;
        const deadline = Date.now() + 60_000;
        let attempt = 0;

        async function poll() {
            if (cancelled) return;
            if (Date.now() > deadline) { setPhase("timeout"); return; }
            attempt++;
            const { ok, installToken } = await pingExtension();
            if (ok && !cancelled) {
                if (installToken) linkExtensionToServer(installToken);
                sendTokenToPlugin();
                setPhase("anim_detected");
                return;
            }
            if (!cancelled) setTimeout(poll, attempt <= 15 ? 800 : 2000);
        }
        poll();
        return () => { cancelled = true; };
    }, [phase]);

    // 4. Sequenza animazione rilevamento
    useEffect(() => {
        if (phase === "anim_detected") {
            notifyExtension(sector, tone);
            const t = setTimeout(() => setPhase("anim_linking"), 900);
            return () => clearTimeout(t);
        }
        if (phase === "anim_linking") {
            const t = setTimeout(() => setPhase("anim_complete"), 900);
            return () => clearTimeout(t);
        }
    }, [phase, sector, tone]);

    // ── Checking ──
    if (phase === "checking") {
        return (
            <div style={{ textAlign: "center", padding: "2.5rem 0" }}>
                <Spinner size={28} />
                <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                    Verifica del plugin in corso…
                </p>
            </div>
        );
    }

    // ── Già installato ──
    if (phase === "already") {
        return (
            <div>
                <InfoBanner variant="success" style={{ marginBottom: "1.75rem" }}>
                    <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>✅</span>
                    <div>
                        <p style={{ fontWeight: 600, color: "var(--text-main)", marginBottom: "0.25rem" }}>
                            LinkedIn Grow è già attivo nel tuo browser
                        </p>
                        <p style={{ fontSize: "0.88rem" }}>
                            Abbiamo collegato il tuo account automaticamente.
                        </p>
                    </div>
                </InfoBanner>
                <Button fullWidth onClick={onNext}>Continua →</Button>
            </div>
        );
    }

    // ── Animazione rilevamento ──
    if (phase === "anim_detected" || phase === "anim_linking" || phase === "anim_complete") {
        const animSteps: { label: string; done: boolean; active: boolean }[] = [
            { label: "Plugin rilevato!", done: true, active: false },
            { label: "Collegamento account...", done: phase === "anim_complete", active: phase === "anim_linking" },
            { label: "Account collegato. Benvenuto.", done: phase === "anim_complete", active: phase === "anim_complete" },
        ];

        return (
            <div>
                <h1 className="auth-title" style={{ marginBottom: "1.75rem" }}>Un ultimo passo</h1>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
                    {animSteps.map(({ label, done, active }, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.95rem" }}>
                            <span style={{ width: "22px", textAlign: "center", flexShrink: 0 }}>
                                {done || active
                                    ? (done ? "✅" : <Spinner size={14} />)
                                    : <span style={{ color: "var(--text-muted)" }}>○</span>
                                }
                            </span>
                            <span style={{ color: done || active ? "var(--text-main)" : "var(--text-muted)" }}>
                                {label}
                            </span>
                        </div>
                    ))}
                </div>
                {phase === "anim_complete" && (
                    <Button fullWidth onClick={onNext}>Continua →</Button>
                )}
            </div>
        );
    }

    // ── Timeout ──
    if (phase === "timeout") {
        return (
            <div>
                <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>⏳</p>
                <h1 className="auth-title" style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
                    Non ho ancora rilevato il plugin.
                </h1>
                <p className="auth-subtitle" style={{ marginBottom: "1.5rem" }}>Hai bisogno di aiuto?</p>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                    <Button variant="ghost" style={{ flex: 1 }} onClick={() => setPhase("waiting")}>
                        Riprova
                    </Button>
                    <Button href="https://www.youtube.com" target="_blank" rel="noreferrer" style={{ flex: 1 }}>
                        Guarda il video →
                    </Button>
                </div>
            </div>
        );
    }

    // ── Demo inline ──
    if (phase === "demo") {
        return (
            <div>
                <h1 className="auth-title" style={{ marginBottom: "1rem" }}>Come funziona</h1>
                <div style={{
                    background: "var(--color-surface-2)", border: "1px solid var(--border-soft)",
                    borderRadius: "var(--radius-md)", padding: "1.25rem", marginBottom: "1.5rem",
                }}>
                    <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                        Mentre navighi LinkedIn, accanto al campo commento compare il pulsante ✨
                    </p>
                    <div style={{ background: "#fff", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-sm)", padding: "0.9rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--accent-soft)", border: "1px solid var(--accent-blue)", flexShrink: 0 }} />
                            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", flex: 1 }}>Scrivi un commento...</span>
                            <span style={{ fontSize: "1.1rem" }}>✨</span>
                        </div>
                        <div style={{
                            background: "var(--accent-soft)", border: "1px solid rgba(37,99,235,0.2)",
                            borderRadius: "var(--radius-sm)", padding: "0.75rem",
                            fontSize: "0.82rem", lineHeight: 1.55, marginBottom: "0.5rem",
                        }}>
                            &ldquo;Ottimo punto sulla scalabilità. Nel mio lavoro come developer ho visto esattamente
                            questa dinamica con i sistemi distribuiti...&rdquo;
                        </div>
                        <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.75rem" }}>
                            <span style={{ color: "#059669" }}>🎯 Personalizzato per il tuo profilo Tech</span>
                            <span style={{ color: "var(--text-muted)" }}>👥 Marco è un 2° grado</span>
                        </div>
                    </div>
                </div>
                <Button fullWidth onClick={() => setPhase("not_installed")}>
                    Installa il plugin →
                </Button>
            </div>
        );
    }

    // ── Default: non installato (include fase "waiting") ──
    return (
        <div>
            <p style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>🔌</p>
            <h1 className="auth-title">Un ultimo passo — il plugin per Chrome</h1>
            <p className="auth-subtitle" style={{ marginBottom: "1.5rem" }}>
                LinkedIn Grow funziona mentre navighi LinkedIn.<br />
                Senza il plugin non possiamo raccogliere dati<br />
                né mostrarti i suggerimenti nel momento giusto.
            </p>

            <InfoBanner style={{ marginBottom: "1.5rem" }}>
                <span>⏱</span>
                <span>Ci vogliono 30 secondi.</span>
            </InfoBanner>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Button
                    href={EXTENSION_ID ? `https://chromewebstore.google.com/detail/${EXTENSION_ID}` : "https://chromewebstore.google.com"}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setPhase("waiting")}
                >
                    Installa il plugin →
                </Button>

                {/* Resta dentro il flow — NON è "Lo faccio dopo" */}
                <Button variant="ghost" onClick={() => setPhase("demo")}>
                    Mostrami prima come funziona
                </Button>
            </div>

            {phase === "waiting" && (
                <InfoBanner style={{ marginTop: "1.5rem" }}>
                    <Spinner />
                    <span>In attesa del plugin… installa dal Chrome Web Store e torna qui.</span>
                </InfoBanner>
            )}

            <div style={{ marginTop: "1.25rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <button
                    disabled={verifying}
                    onClick={async () => {
                        setVerifying(true);
                        setVerifyFailed(false);
                        const { ok, installToken } = await pingExtension();
                        setVerifying(false);
                        if (ok) {
                            if (installToken) linkExtensionToServer(installToken);
                            sendTokenToPlugin();
                            setPhase("anim_detected");
                        } else {
                            setVerifyFailed(true);
                        }
                    }}
                    style={{
                        background: "none", border: "none", padding: 0,
                        fontSize: "0.82rem", color: "var(--accent-blue)",
                        cursor: verifying ? "default" : "pointer",
                        fontFamily: "var(--font-body)",
                        textDecoration: "underline", textDecorationStyle: "dotted",
                        opacity: verifying ? 0.6 : 1,
                        display: "flex", alignItems: "center", gap: "0.4rem",
                    }}
                >
                    {verifying && <Spinner size={12} />}
                    {verifying ? "Verifica in corso…" : "Hai già installato il plugin? Clicca per verificare"}
                </button>
                {verifyFailed && (
                    <p style={{ fontSize: "0.78rem", color: "var(--color-error, #dc2626)", margin: 0 }}>
                        Plugin non trovato. Assicurati che sia attivo e riprova.
                    </p>
                )}
            </div>
        </div>
    );
}

// ── Step 4: Ready ──────────────────────────────────────────────────────────

function StepReady() {
    return (
        <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🎯</div>
            <h1 className="auth-title" style={{ marginBottom: "0.5rem" }}>Sei pronto.</h1>
            <p className="auth-subtitle" style={{ marginBottom: "1.5rem", textAlign: "left" }}>
                Ecco l&apos;unica cosa da fare adesso:
            </p>

            <div style={{
                background: "var(--color-surface-2)", border: "1px solid var(--border-soft)",
                borderRadius: "var(--radius-md)", padding: "1.25rem 1.5rem",
                textAlign: "left", marginBottom: "1.5rem",
                fontSize: "0.92rem", lineHeight: 1.7,
            }}>
                <p style={{ marginBottom: "0.9rem" }}>
                    <strong>1.</strong> Apri LinkedIn → scorri il feed normalmente<br />
                    <span style={{ color: "var(--text-muted)", fontSize: "0.84rem" }}>
                        (il sistema inizia a imparare il tuo network in silenzio)
                    </span>
                </p>
                <p>
                    <strong>2.</strong> Quando vuoi commentare un post,<br />
                    clicca <strong>✨</strong> accanto al campo commento
                </p>
            </div>

            <p style={{ fontSize: "0.83rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                Questo è tutto.<br />Il grafo si costruisce da solo mentre navighi.
            </p>

            <Button href="https://www.linkedin.com/feed/" target="_blank" rel="noreferrer" fullWidth>
                Apri LinkedIn ora →
            </Button>

            <Button
                variant="ghost"
                href="/dashboard"
                fullWidth
                style={{ marginTop: "0.75rem" }}
            >
                Vai alla home
            </Button>
        </div>
    );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [goal, setGoal] = useState<Goal>("presence");
    const [sector, setSector] = useState<Sector>("Tech");
    const [tone, setTone] = useState<Tone>("Professionale");

    // Auth guard
    useEffect(() => {
        fetch(`${AUTH_URL}/me`, { credentials: "include" }).then(res => {
            if (!res.ok) window.location.href = `${AUTH_URL}/login`;
        }).catch(() => {
            window.location.href = `${AUTH_URL}/login`;
        });
    }, []);

    async function handleProfileNext(data: { sector: Sector; role: string; tone: Tone }) {
        setSector(data.sector);
        setTone(data.tone);

        fetch(`${AUTH_URL}/profile/onboarding`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ goal, sector: data.sector, role: data.role || undefined, tone: data.tone }),
        }).catch(() => { });

        setStep(3);
    }

    // Step 1 ha la card più larga per il layout a 2 colonne
    const maxWidth = step === 1 ? 580 : 440;

    return (
        <div className="auth-wrapper">
            <div style={{
                width: "100%", maxWidth,
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: "2.5rem 2rem",
                boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
                animation: "fadeUp 0.4s ease both",
                transition: "max-width 0.35s ease",
            }}>
                <Logo />
                <ProgressBar step={step} />

                {step === 1 && <StepGoal onNext={g => { setGoal(g); setStep(2); }} />}
                {step === 2 && <StepProfile onNext={handleProfileNext} />}
                {step === 3 && <StepExtension sector={sector} tone={tone} onNext={() => setStep(4)} />}
                {step === 4 && <StepReady />}
            </div>
        </div>
    );
}
