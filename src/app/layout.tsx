import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "RCRD - one solution",
  description: "Connect, Collaborate, Create - A simple Loom-like video recording platform.",
  icons: {
    icon: "/ICONS/favicon-square.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} ${outfit.className} h-full w-full antialiased font-outfit overflow-hidden`}
    >
      <body suppressHydrationWarning className="h-full w-full overflow-hidden flex flex-col m-0 p-0">{children}</body>
    </html>
  );
}
