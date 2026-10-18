"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Lock, Mail, User, Eye, EyeOff, AlertCircle, ShieldCheck } from "lucide-react";
import RcrdLogo from "@/components/RcrdLogo";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("MENTOR");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!termsAccepted) {
      setError("Please accept the terms to create your account.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      // Persist auth details
      if (typeof window !== "undefined") {
        if (data.token) {
          localStorage.setItem("token", data.token);
          sessionStorage.setItem("token", data.token);
        }
        const profileObj = {
          name: data.name || name,
          email: data.email || email,
          role: data.role === "MENTOR" ? "Admin" : "Member",
          plan: "Pro Plan",
          avatarText: (data.name || name || "HR")
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
      setError((err as Error).message || "Signup failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] font-sans text-[#20262E] flex flex-col justify-between selection:bg-[#EBF5FB] selection:text-[#0E2F44]">
      
      {/* Top Navbar */}
      <header className="h-20 px-6 sm:px-12 flex items-center justify-between border-b border-[#E2E7EC] bg-white sticky top-0 z-30 shadow-xs">
        <Link href="/" className="flex items-center gap-2 group">
          <RcrdLogo className="h-16 sm:h-18 md:h-20 w-auto scale-130 sm:scale-145 origin-left transition-transform group-hover:scale-155" />
        </Link>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-[#57636E]">Already have an account?</span>
          <Link
            href="/login"
            className="font-bold text-[#154360] hover:text-[#0E2F44] px-3 py-1.5 rounded-lg border border-[#154360]/30 hover:bg-[#EBF5FB] transition-all"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[460px] bg-white border border-[#E2E7EC] rounded-3xl p-8 sm:p-10 shadow-sm shadow-slate-200/50">
          
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-[#EBF5FB] border border-[#154360]/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#154360]">
              <ShieldCheck size={24} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#20262E] tracking-tight">
              Create your account
            </h1>
            <p className="text-xs text-[#57636E] mt-1.5 font-normal">
              Get started with high-quality async video, meetings, and drive sync
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
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#57636E]" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Hari Kishore Reddy"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-[#F5F6F8] hover:bg-slate-50 focus:bg-white border border-[#E2E7EC] focus:border-[#154360] focus:ring-2 focus:ring-[#154360]/15 rounded-xl text-xs text-[#20262E] outline-none transition-all font-medium placeholder:text-[#57636E]"
                />
              </div>
            </div>

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
              <label className="block text-xs font-bold text-[#20262E] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#57636E]" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={3}
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

            {/* Role / Usage option */}
            <div>
              <label className="block text-xs font-bold text-[#20262E] uppercase tracking-wider mb-1.5">
                Account Type
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setRole("MENTOR")}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-semibold ${
                    role === "MENTOR"
                      ? "border-[#154360] bg-[#EBF5FB] text-[#0E2F44] ring-2 ring-[#154360]/10 font-bold"
                      : "border-[#E2E7EC] bg-white text-[#57636E] hover:bg-[#F5F6F8]"
                  }`}
                >
                  Mentor / Host
                </button>
                <button
                  type="button"
                  onClick={() => setRole("STUDENT")}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-semibold ${
                    role === "STUDENT"
                      ? "border-[#154360] bg-[#EBF5FB] text-[#0E2F44] ring-2 ring-[#154360]/10 font-bold"
                      : "border-[#E2E7EC] bg-white text-[#57636E] hover:bg-[#F5F6F8]"
                  }`}
                >
                  Member / Student
                </button>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#57636E]">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-[#E2E7EC] text-[#154360] focus:ring-[#154360] cursor-pointer shrink-0"
                />
                <span>
                  I agree to the <a href="#" className="text-[#154360] font-semibold hover:underline">Terms of Service</a> and <a href="#" className="text-[#154360] font-semibold hover:underline">Privacy Policy</a>.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 py-3 bg-[#154360] hover:bg-[#0E2F44] disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              {isLoading ? (
                <span>Creating account...</span>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 text-center text-xs text-[#57636E] border-t border-[#E2E7EC] bg-white">
        © 2026 RCRD Technologies. All rights reserved · Built with Glassdoor Prism theme.
      </footer>
    </div>
  );
}
