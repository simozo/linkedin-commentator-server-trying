import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinkedIn Grow — Dashboard",
  description: "Potenzia la tua presenza su LinkedIn con analisi avanzate e suggerimenti basati sull'IA.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
