"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID || "";
const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:4000";

type Status = "loading" | "success" | "error" | "no_extension" | "dashboard_redirect";

function CallbackContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<Status>("loading");
    const [message, setMessage] = useState("Completamento accesso in corso…");

    useEffect(() => {
        const token = searchParams.get("token");
        const secret = searchParams.get("secret");
        const source = searchParams.get("source");

        // Dashboard flow: no token/secret in URL, session cookie already set
        if (source !== "plugin" && !token) {
            setStatus("dashboard_redirect");
            setMessage("Accesso effettuato! Reindirizzamento alla dashboard…");
            router.push("/dashboard");
            return;
        }

        // Plugin flow: must have token + secret
        if (!token || !secret) {
            setStatus("error");
            setMessage("Parametri mancanti nel callback. Riprova il login.");
            return;
        }

        const chrome = (window as unknown as { chrome?: { runtime?: { sendMessage?: (id: string, msg: object, cb: (r: unknown) => void) => void } } }).chrome;

        if (!chrome?.runtime?.sendMessage) {
            sessionStorage.setItem("plugin_token", token);
            sessionStorage.setItem("plugin_secret", secret);
            setStatus("no_extension");
            setMessage("Accesso effettuato! Apri il plugin dal browser per continuare.");
            return;
        }

        if (!EXTENSION_ID) {
            setStatus("no_extension");
            setMessage("ID estensione non configurato. Contatta il supporto.");
            return;
        }

        chrome.runtime.sendMessage(
            EXTENSION_ID,
            { action: "LOGIN_SUCCESS", jwt: token, secret },
            (response: unknown) => {
                console.log("Plugin notified:", response);
                setStatus("success");
                setMessage("Plugin sbloccato! Puoi chiudere questa scheda e tornare su LinkedIn.");
                setTimeout(() => window.close(), 3000);
            }
        );
    }, [searchParams, router]);

    const titles: Record<Status, string> = {
        loading: "Autenticazione…",
        success: "Sei dentro! 🎉",
        error: "Qualcosa è andato storto",
        no_extension: "Accesso effettuato",
        dashboard_redirect: "Reindirizzamento…",
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-card" style={{ textAlign: "center" }}>
                <div className="auth-logo" style={{ justifyContent: "center", marginBottom: "2rem" }}>
                    <div className="auth-logo-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.9" />
                            <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
                            <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </div>
                    <span className="auth-logo-text">LinkedIn <span>Co-pilot</span></span>
                </div>

                {(status === "loading" || status === "dashboard_redirect") && (
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
                        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
                    </div>
                )}
                {status === "success" && <div className="callback-icon success">✓</div>}
                {status === "error" && <div className="callback-icon error">✕</div>}
                {status === "no_extension" && <div className="callback-icon success">🔌</div>}

                <div className="callback-text">
                    <h1 className="auth-title" style={{ fontSize: "1.3rem" }}>{titles[status]}</h1>
                    <p>{message}</p>

                    {status === "success" && (
                        <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "var(--color-muted)" }}>
                            Questa scheda si chiuderà automaticamente tra qualche secondo…
                        </p>
                    )}
                    {status === "error" && (
                        <button className="btn btn-primary" style={{ marginTop: "1.5rem" }}
                            onClick={() => window.location.href = "/"}>
                            Torna al login
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="auth-wrapper">
                <div className="auth-card" style={{ display: "flex", justifyContent: "center" }}>
                    <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
                </div>
            </div>
        }>
            <CallbackContent />
        </Suspense>
    );
}
