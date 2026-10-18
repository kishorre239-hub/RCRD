"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Lock, Mail, Eye, EyeOff, AlertCircle, Sparkles } from "lucide-react";
import RcrdLogo from "@/components/RcrdLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Invalid email or password");
      }

      // Persist token and user details
      if (typeof window !== "undefined") {
        if (data.token) {
          localStorage.setItem("token", data.token);
          sessionStorage.setItem("token", data.token);
        }
        const profileObj = {
          name: data.name || "Hari Kishore Reddy",
          email: data.email || email,
          role: data.role || "Admin",
          plan: "Pro Plan",
          avatarText: (data.name || "HR")
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase(),
        };
        localStorage.setItem("rcrd_user_profile", JSON.stringify(profileObj));
        localStorage.setItem("user", JSON.stringify(data));
        window.dispatchEvent(new CustomEvent("rcrd_profile_updated", { detail: profileObj }));
      }

      router.push("/");
    } catch (err: unknown) {
      setError((err as Error).message || "Login failed. Please check credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] font-sans text-[#20262E] flex flex-col justify-between selection:bg-[#EBF5FB] selection:text-[#0E2F44]">
      
      {/* Top Navbar */}
      <header className="h-20 px-6 sm:px-12 flex items-center justify-between border-b border-[#E2E7EC] bg-white sticky top-0 z-30 shadow-xs">
        <Link href="/" className="flex items-center gap-2 group">
          <RcrdLogo className="h-16 sm:h-18 md:h-20 w-auto scale-130 sm:scale-145 origin-left transition-transform group-hover:scale-155" />
        </Link>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-[#57636E]">Don&apos;t have an account?</span>
          <Link
            href="/signup"
            className="font-bold text-[#154360] hover:text-[#0E2F44] px-3 py-1.5 rounded-lg border border-[#154360]/30 hover:bg-[#EBF5FB] transition-all"
          >
            Sign up free
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[440px] bg-white border border-[#E2E7EC] rounded-3xl p-8 sm:p-10 shadow-sm shadow-slate-200/50">
          
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-[#EBF5FB] border border-[#154360]/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#154360]">
              <Sparkles size={22} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#20262E] tracking-tight">
              Welcome back
            </h1>
            <p className="text-xs text-[#57636E] mt-1.5 font-normal">
              Sign in to manage your meetings, screen recordings, and team spaces
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#20262E] uppercase tracking-wider mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#57636E]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-[#F5F6F8] hover:bg-slate-50 focus:bg-white border border-[#E2E7EC] focus:border-[#154360] focus:ring-2 focus:ring-[#154360]/15 rounded-xl text-xs text-[#20262E] outline-none transition-all font-medium placeholder:text-[#57636E]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#20262E] uppercase tracking-wider">
                  Password
                </label>
                <a href="#" className="text-[11px] font-semibold text-[#154360] hover:underline">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#57636E]" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-[#F5F6F8] hover:bg-slate-50 focus:bg-white border border-[#E2E7EC] focus:border-[#154360] focus:ring-2 focus:ring-[#154360]/15 rounded-xl text-xs text-[#20262E] outline-none transition-all font-medium placeholder:text-[#57636E]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#57636E] hover:text-[#20262E]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#57636E]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#E2E7EC] text-[#154360] focus:ring-[#154360] cursor-pointer"
                />
                <span>Remember this device</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 bg-[#154360] hover:bg-[#0E2F44] disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              {isLoading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials for Fast Testing */}
          <div className="mt-6 pt-5 border-t border-[#E2E7EC]">
            <p className="text-[11px] font-bold text-[#57636E] uppercase tracking-wider mb-2.5 text-center">
              Quick 1-Click Demo Accounts
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickDemo("admin@rcrd.com", "2026")}
                className="p-2 rounded-xl border border-[#E2E7EC] hover:border-[#154360] hover:bg-[#EBF5FB] text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-[#20262E]">Admin Studio</div>
                <div className="text-[10px] text-[#57636E]">admin@rcrd.com</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo("geonixa@rcrd.com", "9908")}
                className="p-2 rounded-xl border border-[#E2E7EC] hover:border-[#154360] hover:bg-[#EBF5FB] text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-[#20262E]">Geonixa Host</div>
                <div className="text-[10px] text-[#57636E]">geonixa@rcrd.com</div>
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 text-center text-xs text-[#57636E] border-t border-[#E2E7EC] bg-white">
        © 2026 RCRD Technologies. All rights reserved · Built with Glassdoor Prism theme.
      </footer>
    </div>
  );
}
