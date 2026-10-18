import type { Metadata, Viewport } from "next";
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
});

export const viewport: Viewport = {
  themeColor: "#154360",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "RCRD",
  description: "Connect, Collaborate, Create - A simple video recording and messaging platform.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/apple-touch-icon.png",
  },
};

import GlobalRecordingManager from "@/components/GlobalRecordingManager";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} h-full w-full antialiased font-sans bg-[#F5F6F8] text-[#20262E] overflow-hidden`}
    >
      <body suppressHydrationWarning className="h-full w-full overflow-hidden flex flex-col m-0 p-0 font-sans bg-[#F5F6F8] text-[#20262E]">
        <script
          dangerouslySetInnerHTML={{
            __html: `if(typeof window!=='undefined'&&'serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(regs){for(var reg of regs){reg.unregister();}});if('caches' in window){caches.keys().then(function(names){for(var name of names)caches.delete(name);});}}`,
          }}
        />
        <GlobalRecordingManager>
          {children}
        </GlobalRecordingManager>
      </body>
    </html>
  );
}
