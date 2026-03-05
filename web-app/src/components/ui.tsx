/**
 * ui.tsx — componenti base riusabili
 * Logo · Spinner · Button · InfoBanner · AuthShell
 */
import React from "react";

// ── Logo ──────────────────────────────────────────────────────────────────

export function Logo({ centered }: { centered?: boolean }) {
    return (
        <div style={{
            display: "flex", alignItems: "center", gap: "0.6rem",
            marginBottom: "2rem",
            justifyContent: centered ? "center" : undefined,
        }}>
            <div className="auth-logo-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                        stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    />
                </svg>
            </div>
            <span className="auth-logo-text">LinkedIn <span>Grow</span></span>
        </div>
    );
}

// ── Spinner ───────────────────────────────────────────────────────────────

export function Spinner({ size = 18 }: { size?: number }) {
    return (
        <div
            className="spinner"
            style={{
                width: size, height: size,
                borderColor: "rgba(37,99,235,0.2)",
                borderTopColor: "var(--accent-blue)",
                flexShrink: 0,
            }}
        />
    );
}

// ── Button ────────────────────────────────────────────────────────────────
// Supporta sia <button> che <a> (href).

type ButtonVariant = "primary" | "ghost" | "outline";

type ButtonBaseProps = {
    variant?: ButtonVariant;
    fullWidth?: boolean;
    children: React.ReactNode;
    style?: React.CSSProperties;
};

type ButtonAsButton = ButtonBaseProps & {
    href?: undefined;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
    target?: undefined;
    rel?: undefined;
};

type ButtonAsLink = ButtonBaseProps & {
    href: string;
    target?: string;
    rel?: string;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    disabled?: undefined;
    type?: undefined;
};

type ButtonProps = ButtonAsButton | ButtonAsLink;

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
        background: "linear-gradient(135deg, var(--accent-blue), var(--color-primary))",
        color: "#fff",
        border: "none",
        boxShadow: "0 4px 20px rgba(59,130,246,0.3)",
    },
    ghost: {
        background: "transparent",
        color: "var(--text-muted)",
        border: "1px solid var(--border-soft)",
    },
    outline: {
        background: "transparent",
        color: "var(--accent-blue)",
        border: "2px solid var(--accent-blue)",
    },
};

const BASE_STYLE: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.85rem 1.5rem",
    borderRadius: "var(--radius-sm)",
    fontSize: "0.95rem",
    fontWeight: 600,
    fontFamily: "var(--font-body)",
    cursor: "pointer",
    textDecoration: "none",
    transition: "opacity 0.2s, transform 0.15s",
    textAlign: "center",
};

export function Button(props: ButtonProps) {
    const { variant = "primary", fullWidth, children, style } = props;

    const merged: React.CSSProperties = {
        ...BASE_STYLE,
        ...VARIANT_STYLES[variant],
        width: fullWidth ? "100%" : undefined,
        ...style,
    };

    if (props.href !== undefined) {
        return (
            <a
                href={props.href}
                target={props.target}
                rel={props.rel}
                onClick={props.onClick}
                style={merged}
            >
                {children}
            </a>
        );
    }

    return (
        <button
            type={props.type ?? "button"}
            onClick={props.onClick}
            disabled={props.disabled}
            style={{ ...merged, opacity: props.disabled ? 0.5 : 1, cursor: props.disabled ? "not-allowed" : "pointer" }}
        >
            {children}
        </button>
    );
}

// ── InfoBanner ────────────────────────────────────────────────────────────

type BannerVariant = "success" | "info" | "neutral";

const BANNER_STYLES: Record<BannerVariant, React.CSSProperties> = {
    success: {
        background: "rgba(16,185,129,0.08)",
        border: "1px solid rgba(16,185,129,0.2)",
        color: "#059669",
    },
    info: {
        background: "var(--accent-soft)",
        border: "1px solid rgba(37,99,235,0.2)",
        color: "var(--accent-blue)",
    },
    neutral: {
        background: "var(--color-surface-2)",
        border: "1px solid var(--border-soft)",
        color: "var(--text-muted)",
    },
};

export function InfoBanner({
    variant = "neutral",
    children,
    style,
}: {
    variant?: BannerVariant;
    children: React.ReactNode;
    style?: React.CSSProperties;
}) {
    return (
        <div style={{
            display: "flex", alignItems: "flex-start", gap: "0.65rem",
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.875rem",
            lineHeight: 1.5,
            ...BANNER_STYLES[variant],
            ...style,
        }}>
            {children}
        </div>
    );
}

// ── AuthShell ─────────────────────────────────────────────────────────────
// Wrapper condiviso dalle pagine auth/onboarding:
// auth-wrapper (fullscreen centrato) + card + Logo.

export function AuthShell({
    children,
    maxWidth = 440,
    centered,
}: {
    children: React.ReactNode;
    maxWidth?: number | string;
    centered?: boolean;
}) {
    return (
        <div className="auth-wrapper">
            <div style={{
                width: "100%",
                maxWidth,
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: "2.5rem 2rem",
                boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
                animation: "fadeUp 0.4s ease both",
                textAlign: centered ? "center" : undefined,
            }}>
                <Logo centered={centered} />
                {children}
            </div>
        </div>
    );
}
