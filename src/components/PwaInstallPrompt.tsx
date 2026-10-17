'use client';

import { useEffect, useState } from 'react';
import { 
  Download, 
  Smartphone, 
  X, 
  CheckCircle2, 
  Share2, 
  PlusSquare, 
  MoreVertical,
  Laptop
} from 'lucide-react';
import Image from 'next/image';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  });
  const [selectedPlatform, setSelectedPlatform] = useState<'android' | 'iphone'>('android');
  const [hasPromptedOnce, setHasPromptedOnce] = useState(false);

  useEffect(() => {
    if (isInstalled) return;

    // 1. Register Service Worker
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration skipped or failed:', err);
      });
    }

    // 2. Detect user platform
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    setSelectedPlatform(isIOS ? 'iphone' : 'android');

    // 4. Capture BeforeInstallPromptEvent (Android & Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. Check if user dismissed prompt previously
    const dismissedAt = localStorage.getItem('rcrd_pwa_dismissed');
    const dismissedTime = dismissedAt ? parseInt(dismissedAt, 10) : 0;
    const now = Date.now();
    // Re-prompt after 3 days if not installed
    const shouldShow = !dismissedTime || (now - dismissedTime > 3 * 24 * 60 * 60 * 1000);

    if (shouldShow && !isInstalled) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasPromptedOnce(true);
      }, 2500); // Friendly non-blocking delay
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setIsOpen(false);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('PWA prompt error:', err);
      }
    } else if (selectedPlatform === 'android') {
      // Show guided steps
      setSelectedPlatform('android');
    }
  };

  const dismissPrompt = () => {
    setIsOpen(false);
    try {
      localStorage.setItem('rcrd_pwa_dismissed', Date.now().toString());
    } catch {}
  };

  if (isInstalled) return null;

  return (
    <>
      {/* Floating launcher button if prompt is closed so users can trigger it on demand */}
      {!isOpen && hasPromptedOnce && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-3.5 py-2 bg-white/95 hover:bg-white text-[#20262E] hover:text-[#154360] text-xs font-bold rounded-full shadow-lg border border-[#E2E7EC] hover:border-[#154360]/40 backdrop-blur-md transition-all active:scale-95 cursor-pointer"
          title="Install RCRD App on Android or iPhone"
        >
          <div className="w-5 h-5 rounded-full bg-[#EBF5FB] flex items-center justify-center text-[#154360]">
            <Download className="w-3 h-3" />
          </div>
          <span>Install App</span>
        </button>
      )}

      {/* Main PWA Install Modal / Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E2E7EC] overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative p-5 bg-gradient-to-br from-[#EBF5FB] via-white to-slate-50 border-b border-[#E2E7EC]">
              <button
                onClick={dismissPrompt}
                className="absolute top-4 right-4 p-1.5 text-[#57636E] hover:text-[#20262E] rounded-full hover:bg-black/5 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white p-1.5 shadow-md border border-[#E2E7EC] flex items-center justify-center shrink-0">
                  <Image
                    src="/ICONS/favicon-square.png"
                    alt="RCRD Logo"
                    width={38}
                    height={38}
                    className="rounded-lg object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#20262E] tracking-tight">
                    Install RCRD App
                  </h3>
                  <p className="text-xs text-[#57636E] font-medium">
                    Native app speed, full-screen recording & zero distractions.
                  </p>
                </div>
              </div>
            </div>

            {/* Platform Selection Tabs: Android vs iPhone */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#57636E] uppercase tracking-wider mb-2">
                  Select your device:
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSelectedPlatform('android')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedPlatform === 'android'
                        ? 'bg-white text-[#154360] shadow-xs'
                        : 'text-[#57636E] hover:text-[#20262E]'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Android / Chrome</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPlatform('iphone')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedPlatform === 'iphone'
                        ? 'bg-white text-[#154360] shadow-xs'
                        : 'text-[#57636E] hover:text-[#20262E]'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>iPhone / iOS</span>
                  </button>
                </div>
              </div>

              {/* Instructions for Android */}
              {selectedPlatform === 'android' && (
                <div className="space-y-3 bg-[#F9FAFB] p-4 rounded-xl border border-[#E2E7EC]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#20262E]">
                    <span>Installation on Android & Chrome:</span>
                    <span className="text-[10px] font-bold text-[#154360] bg-[#EBF5FB] px-2 py-0.5 rounded-full">
                      PWA Ready
                    </span>
                  </div>

                  <ul className="text-xs text-[#57636E] space-y-2.5 font-medium leading-relaxed">
                    <li className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#EBF5FB] text-[#154360] flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                        1
                      </div>
                      <span>Click the <b>&quot;Install on Android&quot;</b> button below for instant 1-tap installation.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#EBF5FB] text-[#154360] flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                        2
                      </div>
                      <span>
                        Or tap the <b>menu (⋮)</b> in Chrome and select <span className="text-[#20262E] font-semibold flex-inline items-center gap-1"><MoreVertical className="w-3 h-3 inline" /> Install app</span>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#EBF5FB] text-[#154360] flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                        3
                      </div>
                      <span>RCRD will be added to your home screen and app launcher.</span>
                    </li>
                  </ul>

                  {deferredPrompt && (
                    <button
                      type="button"
                      onClick={handleInstallClick}
                      className="w-full mt-2 py-2.5 px-4 bg-[#154360] hover:bg-[#0E2F44] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Install on Android Now</span>
                    </button>
                  )}
                </div>
              )}

              {/* Instructions for iPhone / iOS */}
              {selectedPlatform === 'iphone' && (
                <div className="space-y-3 bg-[#F9FAFB] p-4 rounded-xl border border-[#E2E7EC]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#20262E]">
                    <span>Installation on iPhone & iPad (Safari):</span>
                    <span className="text-[10px] font-bold text-[#154360] bg-[#EBF5FB] px-2 py-0.5 rounded-full">
                      Apple Safari
                    </span>
                  </div>

                  <ul className="text-xs text-[#57636E] space-y-2.5 font-medium leading-relaxed">
                    <li className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#EBF5FB] text-[#154360] flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                        1
                      </div>
                      <span>
                        Tap the <b>Share</b> button <Share2 className="w-3.5 h-3.5 inline text-[#154360]" /> at the bottom bar of Safari.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#EBF5FB] text-[#154360] flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                        2
                      </div>
                      <span>
                        Scroll down and tap <span className="font-bold text-[#20262E]"><PlusSquare className="w-3.5 h-3.5 inline text-[#154360]" /> Add to Home Screen</span>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#EBF5FB] text-[#154360] flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                        3
                      </div>
                      <span>Tap <b>&quot;Add&quot;</b> at the top right to complete.</span>
                    </li>
                  </ul>

                  <div className="flex items-center gap-2 p-2.5 bg-[#EBF5FB]/40 rounded-xl border border-[#2980B9]/30 text-[11px] text-[#0E2F44] font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[#154360]" />
                    <span>Launches in full-screen mode like a native iOS App!</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={dismissPrompt}
                  className="px-4 py-2 text-xs font-semibold text-[#57636E] hover:text-[#20262E] transition-colors cursor-pointer"
                >
                  Maybe Later
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (deferredPrompt) {
                        handleInstallClick();
                      } else {
                        dismissPrompt();
                      }
                    }}
                    className="px-5 py-2.5 bg-[#154360] hover:bg-[#0E2F44] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Laptop className="w-3.5 h-3.5" />
                    <span>Got It</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
