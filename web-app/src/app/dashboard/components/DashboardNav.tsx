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
            borderBottom: "1px solid var(--border-soft)",
            background: "var(--glass-white)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 64,
            position: "sticky",
            top: 0,
            zIndex: 100,
        }}>
            {/* Logo + Nav Links */}
            <div style={{ display: "flex", alignItems: "center", gap: "2.5rem" }}>
                <Link href="/dashboard" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60" width="140" height="35">
                        <defs>
                            <style>{`
                                .cls-node { fill: #2563eb; }
                                .cls-line { stroke: #2563eb; stroke-width: 1.5; opacity: 0.4; }
                                .cls-text-dark { fill: #1a1a24; font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 600; letter-spacing: -0.04em; }
                                .cls-text-blue { fill: #2563eb; font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 600; letter-spacing: -0.04em; }
                            `}</style>
                        </defs>
                        <g id="icon" transform="translate(10, 10)">
                            <line className="cls-line" x1="10" y1="30" x2="25" y2="15" />
                            <line className="cls-line" x1="10" y1="30" x2="25" y2="40" />
                            <line className="cls-line" x1="25" y1="15" x2="45" y2="10" />
                            <line className="cls-line" x1="25" y1="15" x2="40" y2="25" />
                            <line className="cls-line" x1="25" y1="40" x2="40" y2="25" />
                            <line className="cls-line" x1="40" y1="25" x2="45" y2="10" />
                            <circle className="cls-node" cx="10" cy="30" r="4" />
                            <circle className="cls-node" cx="25" cy="15" r="5" />
                            <circle className="cls-node" cx="25" cy="40" r="3" />
                            <circle className="cls-node" cx="40" cy="25" r="6" />
                            <circle className="cls-node" cx="45" cy="10" r="4" />
                        </g>
                        <text x="75" y="38" className="cls-text-blue">Linkedin</text>
                        <text x="170" y="38" className="cls-text-dark">Grow</text>
                    </svg>
                </Link>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                    {navLinks.map(link => {
                        const active = path === link.href;
                        return (
                            <Link key={link.href} href={link.href} style={{
                                padding: "0.4rem 1rem",
                                borderRadius: 8,
                                fontSize: "0.875rem",
                                fontWeight: active ? 600 : 500,
                                textDecoration: "none",
                                color: active ? "var(--accent-blue)" : "var(--text-muted)",
                                background: active ? "var(--accent-soft)" : "transparent",
                                transition: "all 0.2s ease",
                                fontFamily: "var(--font-body)"
                            }}>
                                {link.label}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* User + Logout */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0.6rem", borderRadius: 30, background: "var(--bg-light)", border: "1px solid var(--border-soft)" }}>
                    {avatarUrl && (
                        <img src={avatarUrl} alt="avatar"
                            style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
                    )}
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-main)" }}>{userName?.split(" ")[0]}</span>
                </div>
                <button onClick={handleLogout} style={{
                    padding: "0.4rem 1rem", fontSize: "0.82rem", fontWeight: 600,
                    border: "1px solid var(--border-soft)", borderRadius: 8,
                    background: "#fff", color: "var(--text-main)", cursor: "pointer",
                    transition: "all 0.2s ease", boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                }}>Esci</button>
            </div>
        </nav>
    );
}
