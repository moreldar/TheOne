import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MemoryCanvas — AI photo gifts",
  description: "Turn a photo into a beautiful AI-illustrated gift, printed and shipped.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <header className="border-b border-neutral-200">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              MemoryCanvas
            </Link>
            <nav className="flex items-center gap-4 text-sm text-neutral-600">
              <Link href="/cart" className="hover:text-neutral-900">
                Cart
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mt-16 border-t border-neutral-200 py-8 text-center text-xs text-neutral-400">
          MemoryCanvas MVP
        </footer>
      </body>
    </html>
  );
}
