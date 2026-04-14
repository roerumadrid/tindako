import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TindaKo",
    template: "%s | TindaKo",
  },
  description: "Track mo ang tinda mo. Simple POS and inventory for Filipino small businesses.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen">
        <div className="flex min-h-screen flex-col">
          <main className="flex-1">{children}</main>
          <footer className="py-6 pb-24 text-center text-xs text-muted-foreground">
            © 2026 TindaKo · Built by <span className="font-medium">roeru-madrid</span>
          </footer>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
