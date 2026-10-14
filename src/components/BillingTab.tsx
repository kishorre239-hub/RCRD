"use client";

import React, { useState, useEffect } from "react";
import { 
  Check, Sparkles, RefreshCw, AlertCircle, 
  HardDrive, Info, ShieldCheck 
} from "lucide-react";
import { PlanDefinition } from "@/lib/plans";
import { 
  getBillingSubscription, 
  createBillingOrder, 
  verifyBillingPayment 
} from "@/lib/api";

interface BillingStorageInfo {
  usedBytes: number;
  limitBytes: number;
  usedFormatted: string;
  limitFormatted: string;
  percentUsed: number;
  isOverLimit: boolean;
}

interface BillingSubscriptionInfo {
  status: string;
  expiresAt: number | null;
  orderId: string | null;
  paymentId: string | null;
}

interface BillingResponse {
  plan: PlanDefinition;
  planId: string;
  storage: BillingStorageInfo;
  subscription: BillingSubscriptionInfo;
  allPlans: PlanDefinition[];
}

export default function BillingTab() {
  const [billingData, setBillingData] = useState<BillingResponse | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);
  const [billingMessage, setBillingMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchBilling = async () => {
    setBillingLoading(true);
    try {
      const data = await getBillingSubscription();
      setBillingData(data);
    } catch (err) {
      console.error("Failed to load billing subscription:", err);
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBilling();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined") return resolve(false);
      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleUpgradePlan = async (planId: string) => {
    if (planId === "free") return;
    setUpgradingPlanId(planId);
    setBillingMessage(null);

    try {
      const orderRes = await createBillingOrder(planId);

      // If keys are pending, simulated test mode enables smooth testing
      if (orderRes.testMode) {
        const verifyRes = await verifyBillingPayment({
          planId,
          razorpay_order_id: orderRes.orderId,
          testMode: true,
        });

        setBillingMessage({
          type: "success",
          text: `🎉 Upgraded to ${verifyRes.plan?.name || planId}! (Test Mode: live Razorpay keys can be plugged into .env anytime)`
        });
        await fetchBilling();
        return;
      }

      // Live Razorpay popup flow
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load Razorpay payment gateway. Please check your internet connection.");
      }

      const options = {
        key: orderRes.keyId,
        amount: orderRes.amount,
        currency: orderRes.currency,
        name: "Geonixa Loom SaaS",
        description: `Upgrade to ${orderRes.planName}`,
        order_id: orderRes.orderId,
        handler: async function (response: any) {
          try {
            const verifyRes = await verifyBillingPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planId,
            });

            setBillingMessage({
              type: "success",
              text: `🎉 Payment successful! You are now subscribed to ${verifyRes.plan.name}.`
            });
            await fetchBilling();
          } catch (err: any) {
            setBillingMessage({
              type: "error",
              text: err.message || "Payment verification failed"
            });
          }
        },
        prefill: {
          name: "Workspace Administrator",
          email: "admin@geonixa.com",
        },
        theme: {
          color: "#2563EB",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (resp: any) {
        setBillingMessage({
          type: "error",
          text: resp.error?.description || "Payment was cancelled or failed"
        });
      });
      rzp.open();
    } catch (err: any) {
      console.error("Upgrade plan error:", err);
      setBillingMessage({
        type: "error",
        text: err.message || "Failed to initialize payment"
      });
    } finally {
      setUpgradingPlanId(null);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Billing Notification */}
      {billingMessage && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-sm font-medium shadow-sm border ${
          billingMessage.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
            : "bg-red-50 text-red-800 border-red-200"
        }`}>
          <div className="flex items-center gap-3">
            {billingMessage.type === "success" ? (
              <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <span>{billingMessage.text}</span>
          </div>
          <button 
            onClick={() => setBillingMessage(null)}
            className="text-xs font-bold underline ml-4 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Storage & Plan Overview Card */}
      <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase tracking-wider font-bold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
                {billingData?.plan?.name || "Free Trial"}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {billingData?.subscription?.status || "TRIAL"}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Workspace Subscription & Storage</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {(!billingData?.plan || billingData?.plan?.id === "free")
                ? "You are currently testing on the 100 MB Free Trial. Upgrade anytime to scale your video library." 
                : `Active subscription on the ${billingData?.plan?.name || "Active Plan"}. Renewing according to your interval.`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchBilling}
              disabled={billingLoading}
              className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              title="Refresh storage quota"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${billingLoading ? "animate-spin" : ""}`} />
              Sync Quota
            </button>
          </div>
        </div>

        {/* Storage Quota Progress Bar */}
        <div className="pt-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold text-slate-700 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-600" /> Cloud Storage Used
            </span>
            <span className="font-bold text-slate-900">
              {billingData?.plan?.id !== "free" && billingData?.plan ? (
                <>
                  {billingData?.storage?.usedFormatted || "0 MB"} used
                  <span className="text-xs font-semibold text-emerald-600 ml-2 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Unlimited Cloud Hosting
                  </span>
                </>
              ) : (
                <>
                  {billingData?.storage?.usedFormatted || "0 MB"} / {billingData?.storage?.limitFormatted || "100 MB"}
                  <span className="text-xs font-medium text-slate-500 ml-1.5">
                    ({billingData?.storage?.percentUsed || 0}% utilized)
                  </span>
                </>
              )}
            </span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                billingData?.plan?.id !== "free" && billingData?.plan
                  ? "bg-emerald-500"
                  : (billingData?.storage?.percentUsed || 0) >= 90 
                  ? "bg-red-500" 
                  : (billingData?.storage?.percentUsed || 0) >= 70 
                  ? "bg-amber-500" 
                  : "bg-blue-600"
              }`}
              style={{ 
                width: billingData?.plan?.id !== "free" && billingData?.plan 
                  ? "100%" 
                  : `${Math.min(100, Math.max(2, billingData?.storage?.percentUsed || 2))}%` 
              }}
            ></div>
          </div>

          {(!billingData?.plan || billingData?.plan?.id === "free") && (
            <div className="mt-3 text-xs text-slate-500 flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>
                <strong>Free Trial Limit:</strong> 100 MB maximum cloud storage limit. Once reached, video recording requires upgrading to an active SaaS subscription.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Pricing Plans Section Header */}
      <div className="text-center max-w-2xl mx-auto pt-4">
        <h3 className="text-2xl font-bold text-slate-900">Choose the Right Plan for Your Organization</h3>
        <p className="text-sm text-slate-500 mt-2">
          Transparent monthly rent and yearly packages for teams, companies, and content creators.
        </p>
      </div>

      {/* 4 Pricing Tiers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Plan 1: Free Trial */}
        <div className={`rounded-2xl p-6 flex flex-col justify-between transition-all border ${
          (!billingData?.plan || billingData?.plan?.id === "free")
            ? "border-blue-600 shadow-md ring-2 ring-blue-600/10 bg-white" 
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
        }`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                Free Trial
              </span>
              {(!billingData?.plan || billingData?.plan?.id === "free") && (
                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  Current
                </span>
              )}
            </div>
            <h4 className="text-lg font-bold text-slate-900">Free Trial</h4>
            <p className="text-xs text-slate-500 mt-1">Get started & test recording capabilities</p>

            <div className="mt-4 mb-6">
              <span className="text-3xl font-extrabold text-slate-900">₹0</span>
              <span className="text-xs text-slate-500 ml-1">/ forever</span>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100 text-xs text-slate-700">
              <div className="flex items-center gap-2 font-semibold text-blue-700">
                <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>100 MB Cloud Storage</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Screen, Tab & Mic recording</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Basic cuts & trim editor</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Instant shareable links</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>1 Member / creator seat</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <button
              disabled
              className="w-full py-2.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed border border-slate-200"
            >
              {(!billingData?.plan || billingData?.plan?.id === "free") ? "Active Plan" : "Free Included"}
            </button>
          </div>
        </div>

        {/* Plan 2: Pro Individual */}
        <div className={`rounded-2xl p-6 flex flex-col justify-between transition-all border ${
          billingData?.plan?.id === "pro" 
            ? "border-blue-600 shadow-md ring-2 ring-blue-600/10 bg-white" 
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
        }`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                Pro Monthly
              </span>
              {billingData?.plan?.id === "pro" && (
                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  Current
                </span>
              )}
            </div>
            <h4 className="text-lg font-bold text-slate-900">Pro Individual</h4>
            <p className="text-xs text-slate-500 mt-1">For solo professionals & power creators</p>

            <div className="mt-4 mb-6">
              <span className="text-3xl font-extrabold text-slate-900">₹1,500</span>
              <span className="text-xs text-slate-500 ml-1">/ month</span>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100 text-xs text-slate-700">
              <div className="flex items-center gap-2 font-bold text-blue-700">
                <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>Unlimited Cloud Video Recording</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Unlimited recording duration</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>1080p & 4K Ultra-HD capture</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>AI Transcriptions & Summaries</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Password protected share links</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={() => handleUpgradePlan("pro")}
              disabled={billingData?.plan?.id === "pro" || upgradingPlanId === "pro"}
              className={`w-full py-2.5 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${
                billingData?.plan?.id === "pro"
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                  : "bg-slate-900 hover:bg-black text-white hover:shadow-md"
              }`}
            >
              {upgradingPlanId === "pro" ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : billingData?.plan?.id === "pro" ? (
                "Current Plan"
              ) : (
                "Upgrade to Pro"
              )}
            </button>
          </div>
        </div>

        {/* Plan 3: Team Workspace */}
        <div className={`rounded-2xl p-6 flex flex-col justify-between transition-all border ${
          billingData?.plan?.id === "team" 
            ? "border-blue-600 shadow-md ring-2 ring-blue-600/10 bg-white" 
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
        }`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                Team Monthly
              </span>
              {billingData?.plan?.id === "team" && (
                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  Current
                </span>
              )}
            </div>
            <h4 className="text-lg font-bold text-slate-900">Team Workspace</h4>
            <p className="text-xs text-slate-500 mt-1">For companies renting monthly with team spaces</p>

            <div className="mt-4 mb-6">
              <span className="text-3xl font-extrabold text-slate-900">₹3,000</span>
              <span className="text-xs text-slate-500 ml-1">/ month per team</span>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100 text-xs text-slate-700">
              <div className="flex items-center gap-2 font-bold text-indigo-700">
                <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <span>Shared Team Video Library</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Up to 15 Team Members / Seats</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Shared company video spaces</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>WebRTC meeting rooms & recap</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Team engagement & view analytics</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={() => handleUpgradePlan("team")}
              disabled={billingData?.plan?.id === "team" || upgradingPlanId === "team"}
              className={`w-full py-2.5 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${
                billingData?.plan?.id === "team"
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md"
              }`}
            >
              {upgradingPlanId === "team" ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : billingData?.plan?.id === "team" ? (
                "Current Plan"
              ) : (
                "Upgrade Team Plan"
              )}
            </button>
          </div>
        </div>

        {/* Plan 4: Yearly Enterprise (RECOMMENDED) */}
        <div className={`relative rounded-2xl p-6 flex flex-col justify-between transition-all border-2 bg-gradient-to-b from-blue-50/60 to-white ${
          billingData?.plan?.id === "yearly" 
            ? "border-blue-600 shadow-xl ring-2 ring-blue-600/20" 
            : "border-blue-600 shadow-lg hover:shadow-xl"
        }`}>
          {/* Recommended Tag */}
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-[10px] tracking-wider uppercase px-3 py-1 rounded-full shadow-md flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Recommended (Save 44%)
          </div>

          <div>
            <div className="flex items-center justify-between mb-4 pt-1">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-100/80 px-2.5 py-1 rounded-md">
                Enterprise Annual
              </span>
              {billingData?.plan?.id === "yearly" && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                  Active Plan
                </span>
              )}
            </div>
            <h4 className="text-lg font-bold text-slate-900">Yearly Enterprise</h4>
            <p className="text-xs text-slate-500 mt-1">All-inclusive annual rent for organizations</p>

            <div className="mt-4 mb-6">
              <span className="text-3xl font-extrabold text-blue-700">₹20,000</span>
              <span className="text-xs text-slate-500 ml-1">/ year</span>
              <div className="text-[11px] font-bold text-emerald-600 mt-0.5">
                Save ₹16,000 vs. monthly billing!
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-blue-100 text-xs text-slate-700">
              <div className="flex items-center gap-2 font-bold text-blue-800">
                <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>Dedicated Organization Video Hosting</span>
              </div>
              <div className="flex items-center gap-2 font-semibold">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Up to 50 Team Member Seats</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>All Pro & Team features included</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Priority 24/7 VIP SLA Support</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Custom branding & vanity domain</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={() => handleUpgradePlan("yearly")}
              disabled={billingData?.plan?.id === "yearly" || upgradingPlanId === "yearly"}
              className={`w-full py-3 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                billingData?.plan?.id === "yearly"
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white hover:shadow-lg transform hover:-translate-y-0.5"
              }`}
            >
              {upgradingPlanId === "yearly" ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : billingData?.plan?.id === "yearly" ? (
                "Active Yearly Plan"
              ) : (
                "Get Recommended Yearly Plan"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Gateway & Security Guarantee Footer */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="font-bold text-slate-800">Razorpay Payment Gateway Ready</p>
            <p className="text-slate-500">
              Supports UPI, Net Banking, Credit/Debit Cards & Auto-Debit Recurring Subscriptions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-slate-500 font-medium">
          <span>⚡ Instant Activation</span>
          <span>•</span>
          <span>🔒 256-bit SSL Encrypted</span>
          <span>•</span>
          <span>📑 Tax Invoices</span>
        </div>
      </div>
    </div>
  );
}
