import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Compliance Copilot — Label Inspector",
  description:
    "Upload a packaged-product photo and instantly get a compliance report against Indian Legal Metrology and FSSAI regulations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        {/* ── Nav ── */}
        <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #2563eb, #38bdf8)", boxShadow: "0 0 12px rgba(56,189,248,0.4)" }}>
                <span className="text-sm" role="img" aria-label="label">🏷️</span>
              </div>
              <span className="font-bold text-white text-sm tracking-wide">
                Compliance Copilot
              </span>
              <span className="hidden sm:inline text-xs font-bold px-2 py-0.5 rounded-full
                               bg-brand-600/20 text-neon-cyan border border-neon-cyan/30">
                BETA
              </span>
            </div>

            {/* Right badges */}
            <div className="flex items-center gap-2">
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500
                               glass-light rounded-full px-3 py-1.5 border border-white/[0.06]">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                LM-PC 2011
              </span>
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500
                               glass-light rounded-full px-3 py-1.5 border border-white/[0.06]">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
                FSSAI 2020
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1">
          {children}
        </main>

        <footer className="border-t border-white/[0.05] py-4 text-center text-xs text-slate-600">
          AI Compliance Copilot — for informational use only. Always verify with a qualified compliance officer.
        </footer>
      </body>
    </html>
  );
}
