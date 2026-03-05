"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:4000";
const AUTH_LOGIN_URL = process.env.NEXT_PUBLIC_AUTH_LOGIN_URL || "http://localhost:4000/login";

export default function RootPage() {
    const router = useRouter();

    useEffect(() => {
        fetch(`${AUTH_URL}/me`, { credentials: "include" })
            .then(res => {
                if (!res.ok) {
                    window.location.href = AUTH_LOGIN_URL;
                    return null;
                }
                return res.json();
            })
            .then((user) => {
                if (!user) return;
                if (!user.onboarding_complete) {
                    router.replace("/onboarding");
                } else {
                    router.replace("/dashboard");
                }
            })
            .catch(() => {
                window.location.href = AUTH_LOGIN_URL;
            });
    }, [router]);

    return null;
}
