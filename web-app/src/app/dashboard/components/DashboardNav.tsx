"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:4000";
const AUTH_LOGIN_URL = process.env.NEXT_PUBLIC_AUTH_LOGIN_URL || "http://localhost:4000/login";

interface NavProps {
    userName?: string;
    avatarUrl?: string;
}

const navLinks = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/network", label: "Rete" },
    { href: "/dashboard/activity", label: "Attività" },
    { href: "/dashboard/reach", label: "🌉 Reach Map" },
];

export default function DashboardNav({ userName, avatarUrl }: NavProps) {
    const path = usePathname();

    const handleLogout = async () => {
        await fetch(`${AUTH_URL}/logout-web`, { method: "POST", credentials: "include" });
        window.location.href = AUTH_LOGIN_URL;
    };

    return (
        <nav style={{
            padding: "0 2rem",
            borderBottom: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 56,
            position: "sticky",
            top: 0,
            zIndex: 100,
        }}>
            {/* Logo + Nav Links */}
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none", color: "var(--color-text)" }}>
                    <div style={{
                        width: 28, height: 28, borderRadius: 7,
                        background: "linear-gradient(135deg, #3b82f6, #0ea5e9)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.9" />
                            <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
                            <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem", letterSpacing: "-0.02em" }}>
                        Co-pilot
                    </span>
                </Link>

                <div style={{ display: "flex", gap: "0.25rem" }}>
                    {navLinks.map(link => {
                        const active = path === link.href;
                        return (
                            <Link key={link.href} href={link.href} style={{
                                padding: "0.3rem 0.85rem",
                                borderRadius: 20,
                                fontSize: "0.82rem",
                                fontWeight: active ? 600 : 400,
                                textDecoration: "none",
                                color: active ? "#3b82f6" : "var(--color-muted)",
                                background: active ? "#3b82f614" : "transparent",
                                transition: "all 0.15s",
                            }}>
                                {link.label}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* User + Logout */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {avatarUrl && (
                    <img src={avatarUrl} alt="avatar"
                        style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                )}
                <span style={{ fontSize: "0.82rem", color: "var(--color-muted)" }}>{userName}</span>
                <button onClick={handleLogout} style={{
                    padding: "0.3rem 0.85rem", fontSize: "0.78rem", fontWeight: 600,
                    border: "1px solid var(--color-border)", borderRadius: 20,
                    background: "transparent", color: "var(--color-muted)", cursor: "pointer",
                }}>Esci</button>
            </div>
        </nav>
    );
}
