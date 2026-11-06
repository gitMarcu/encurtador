import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Atkinson_Hyperlegible_Mono, Host_Grotesk } from "next/font/google";
import "./globals.css";

const host = Host_Grotesk({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-host", display: "swap" });
const measured = Atkinson_Hyperlegible_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-measured", display: "swap", adjustFontFallback: false });

export const metadata: Metadata = {
  title: "cuturl.dev: links curtos com registro de acessos",
  description: "Cole uma URL, crie um link curto e compartilhe seu conteúdo. Encurtamento de links com contagem e auditoria de acessos.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="pt-BR" className={`${host.variable} ${measured.variable}`}><body>{children}</body></html>;
}
