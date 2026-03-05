"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:4000";
const AUTH_LOGIN_URL = process.env.NEXT_PUBLIC_AUTH_LOGIN_URL || "http://localhost:4000/login";

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

function getInitials(name?: string): string {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const navLinks = [
    { href: "/dashboard",          label: "Overview" },
    { href: "/dashboard/network",  label: "Rete" },
    { href: "/dashboard/activity", label: "Attività" },
    { href: "/dashboard/reach",    label: "🌉 Reach Map" },
    { href: "/dashboard/trends",   label: "🔥 Trends" },
    { href: "/dashboard/upgrade",  label: "✦ Upgrade" },
];

interface NavProps {
    userName?: string;
    avatarUrl?: string;
}

export default function DashboardNav({ userName }: NavProps) {
    const path = usePathname();

    const handleLogout = async () => {
        await fetch(`${AUTH_URL}/logout-web`, { method: "POST", credentials: "include" });
        window.location.href = AUTH_LOGIN_URL;
    };

    const color = avatarColor(userName || "?");

    return (
        <nav className="sticky top-0 z-[100] flex items-center justify-between h-16 px-4 md:px-8 border-b border-black/[0.06] bg-white/70 backdrop-blur-[12px]">

            {/* Logo + Nav Links */}
            <div className="flex items-center gap-10">
                <Link href="/dashboard" className="flex items-center no-underline">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60" width="140" height="35">
                        <defs>
                            <style>{`
                                .cls-node { fill: #2563eb; }
                                .cls-line { stroke: #2563eb; stroke-width: 1.5; opacity: 0.4; }
                                .cls-text-dark { fill: #1a1a24; font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 600; letter-spacing: -0.04em; }
                                .cls-text-blue { fill: #2563eb; font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 600; letter-spacing: -0.04em; }
                            `}</style>
                        </defs>
                        <g transform="translate(10, 10)">
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

                <div className="hidden md:flex gap-1">
                    {navLinks.map(link => {
                        const active = path === link.href;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={[
                                    "px-4 py-[0.4rem] rounded-lg text-sm no-underline transition-all duration-200 font-body",
                                    active
                                        ? "font-semibold text-brand-blue bg-brand-soft"
                                        : "font-medium text-text-muted hover:text-text-main hover:bg-black/[0.04]",
                                ].join(" ")}
                            >
                                {link.label}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* User + Logout */}
            <div className="flex items-center gap-3">
                <Link
                    href="/dashboard/account"
                    className="flex items-center gap-[0.6rem] py-1 pl-1 pr-3 rounded-[30px] border border-black/[0.06] bg-surface-2 no-underline transition-all duration-200 hover:border-brand-blue/30 hover:shadow-sm"
                >
                    <div
                        className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[0.68rem] font-extrabold tracking-[0.02em] select-none font-display"
                        style={{ background: color.bg, color: color.text }}
                    >
                        {getInitials(userName)}
                    </div>
                    <span className="text-[0.82rem] font-semibold text-text-main font-body">
                        {userName?.split(" ")[0]}
                    </span>
                </Link>

                <button
                    onClick={handleLogout}
                    className="px-4 py-[0.4rem] text-[0.82rem] font-semibold border border-black/[0.06] rounded-lg bg-white text-text-main cursor-pointer transition-all duration-200 hover:border-black/10 hover:shadow-sm font-body"
                >
                    Esci
                </button>
            </div>
        </nav>
    );
}
