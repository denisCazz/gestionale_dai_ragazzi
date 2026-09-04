import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast-provider";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Gestionale Dai Ragazzi",
  description: "Magazzino, menu, dipendenti e cassa del Bar Dai Ragazzi.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${outfit.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ToastProvider />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
