import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import Script from "next/script";
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
      <Script
        src="https://umami.bitora.it/script.js"
        data-website-id="dee3e962-5742-4b5d-ba76-1d2b010a7ccc"
        strategy="afterInteractive"
      />
    </html>
  );
}
