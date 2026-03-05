"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AuthShell, Spinner, Button } from "@/components/ui";

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID || "";

type Status = "loading" | "success" | "error" | "no_extension" | "dashboard_redirect";

const TITLES: Record<Status, string> = {
    loading: "Autenticazione…",
    success: "Sei dentro!",
    error: "Qualcosa è andato storto",
    no_extension: "Accesso effettuato",
    dashboard_redirect: "Reindirizzamento…",
};

function CallbackContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<Status>("loading");
    const [message, setMessage] = useState("Completamento accesso in corso…");

    useEffect(() => {
        const token = searchParams.get("token");
        const secret = searchParams.get("secret");
        const source = searchParams.get("source");

        if (source !== "plugin" && !token) {
            setStatus("dashboard_redirect");
            setMessage("Accesso effettuato! Reindirizzamento alla dashboard…");
            router.push("/dashboard");
            return;
        }

        if (!token || !secret) {
            setStatus("error");
            setMessage("Parametri mancanti nel callback. Riprova il login.");
            return;
        }

        const cr = (window as unknown as { chrome?: { runtime?: { sendMessage?: (id: string, msg: object, cb: (r: unknown) => void) => void } } }).chrome;

        if (!cr?.runtime?.sendMessage) {
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

        cr.runtime.sendMessage(EXTENSION_ID, { action: "LOGIN_SUCCESS", jwt: token, secret }, () => {
            setStatus("success");
            setMessage("Plugin sbloccato! Puoi chiudere questa scheda e tornare su LinkedIn.");
            setTimeout(() => window.close(), 3000);
        });
    }, [searchParams, router]);

    const isSpinning = status === "loading" || status === "dashboard_redirect";

    return (
        <AuthShell centered>
            {isSpinning && (
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
                    <Spinner size={40} />
                </div>
            )}
            {status === "success" && <div className="callback-icon success">✓</div>}
            {status === "error" && <div className="callback-icon error">✕</div>}
            {status === "no_extension" && <div className="callback-icon success">🔌</div>}

            <div className="callback-text">
                <h1 className="auth-title" style={{ fontSize: "1.3rem" }}>{TITLES[status]}</h1>
                <p>{message}</p>

                {status === "success" && (
                    <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "var(--color-muted)" }}>
                        Questa scheda si chiuderà automaticamente tra qualche secondo…
                    </p>
                )}
                {status === "error" && (
                    <Button fullWidth style={{ marginTop: "1.5rem" }} onClick={() => { window.location.href = "/"; }}>
                        Torna al login
                    </Button>
                )}
            </div>
        </AuthShell>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <AuthShell centered>
                <div style={{ display: "flex", justifyContent: "center" }}>
                    <Spinner size={40} />
                </div>
            </AuthShell>
        }>
            <CallbackContent />
        </Suspense>
    );
}
