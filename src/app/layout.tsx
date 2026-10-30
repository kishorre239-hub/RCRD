import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#4F46E5",
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
      className={`${inter.variable} ${jetbrainsMono.variable} h-full w-full antialiased font-sans bg-[#F8FAFC] text-[#0F172A] overflow-hidden`}
    >
      <body suppressHydrationWarning className="h-full w-full overflow-hidden flex flex-col m-0 p-0 font-sans bg-[#F8FAFC] text-[#0F172A]">
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
