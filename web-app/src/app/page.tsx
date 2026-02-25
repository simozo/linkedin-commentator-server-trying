"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();
  // Root redirect: send users to the dashboard.
  // If not authenticated, dashboard will redirect them to localhost:4000/login.
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return null;
}
