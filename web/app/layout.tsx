import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Encurtador — links curtos, acessos com contexto",
  description: "Cole uma URL, crie um link curto e compartilhe seu conteúdo. Encurtamento de links com contagem e auditoria de acessos.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
