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
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "RCRD - one solution",
  description: "Connect, Collaborate, Create - A simple video recording and messaging platform.",
  icons: {
    icon: "/ICONS/favicon-square.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} h-full w-full antialiased font-sans bg-[#F5F6F8] text-[#20262E] overflow-hidden`}
    >
      <body suppressHydrationWarning className="h-full w-full overflow-hidden flex flex-col m-0 p-0 font-sans bg-[#F5F6F8] text-[#20262E]">{children}</body>
    </html>
  );
}
