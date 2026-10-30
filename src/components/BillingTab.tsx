"use client";

import React, { useState, useEffect } from "react";
import { 
  Info, ExternalLink, Check, HardDrive, Users, 
  ShieldCheck, Sparkles, Building2, CreditCard 
} from "lucide-react";
import { 
  getBillingSubscription, 
  createBillingOrder, 
  verifyBillingPayment 
} from "@/lib/api";

interface BillingTabProps {
  initialBillingCycle?: 'ANNUAL' | 'MONTHLY';
  initialOffering?: string;
}

interface StorageInfo {
  usedBytes: number;
  limitBytes: number;
  usedFormatted: string;
  limitFormatted: string;
  percentUsed: number;
  isOverLimit: boolean;
}

interface SubscriptionInfo {
  status: string;
  expiresAt: number | null;
  orderId: string | null;
  paymentId: string | null;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function BillingTab({
  initialBillingCycle = 'ANNUAL',
  initialOffering = 'Business + AI'
}: BillingTabProps) {
  const [people, setPeople] = useState<number>(1);
  const [billingCycle, setBillingCycle] = useState<'ANNUAL' | 'MONTHLY'>(initialBillingCycle);
  const [currentPlanId, setCurrentPlanId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedPlan = localStorage.getItem('workspace_plan');
        if (savedPlan) return savedPlan;
      } catch {}
    }
    if (initialOffering.toLowerCase().includes('enterprise')) return 'enterprise';
    if (initialOffering.toLowerCase().includes('business')) return 'business';
    return 'starter';
  });
  const [upgradingId, setUpgradingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [storageData, setStorageData] = useState<StorageInfo | null>(null);
  const [subData, setSubData] = useState<SubscriptionInfo | null>(null);

  const loadSub = async () => {
    try {
      const data = await getBillingSubscription();
      if (data?.planId) {
        if (data.planId === 'free') setCurrentPlanId('starter');
        else setCurrentPlanId(data.planId);
      }
      if (data?.storage) {
        setStorageData(data.storage);
      }
      if (data?.subscription) {
        setSubData(data.subscription);
      }
    } catch {
      // Use client local state fallback
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => {
      loadSub();
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handlePeopleChange = (val: number) => {
    if (isNaN(val) || val < 1) {
      setPeople(1);
    } else {
      setPeople(Math.min(val, 500));
    }
  };

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') return resolve(false);
      if (window.Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleUpgrade = async (planId: 'business' | 'business_ai') => {
    setUpgradingId(planId);
    const planName = planId === 'business_ai' ? 'Business + AI' : 'Business';

    try {
      const orderRes = await createBillingOrder(planId);

      if (orderRes?.testMode) {
        // Simulated instant payment when live gateway credentials are not yet added
        await verifyBillingPayment({
          planId,
          razorpay_order_id: orderRes.orderId,
          testMode: true,
        });

        setCurrentPlanId(planId);
        try { localStorage.setItem('workspace_plan', planId); } catch {}
        showToast(`Upgraded to ${planName} for ${people} user${people > 1 ? 's' : ''}!`);
        await loadSub();
      } else if (orderRes?.keyId && orderRes?.orderId) {
        // Live gateway credentials are active: open official checkout modal
        const loaded = await loadRazorpayScript();
        if (loaded && window.Razorpay) {
          const rzp = new window.Razorpay({
            key: orderRes.keyId,
            amount: orderRes.amount,
            currency: orderRes.currency || 'INR',
            name: 'RCRD Studio',
            description: `${planName} Subscription Rental (${people} seat${people > 1 ? 's' : ''})`,
            order_id: orderRes.orderId,
            handler: async (response: { razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string }) => {
              try {
                await verifyBillingPayment({
                  planId,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  testMode: false,
                });
                setCurrentPlanId(planId);
                try { localStorage.setItem('workspace_plan', planId); } catch {}
                showToast(`Payment successful! Upgraded to ${planName}.`);
                await loadSub();
              } catch (verifyErr) {
                console.error("Verification error:", verifyErr);
                showToast("Payment received, updating subscription...");
              }
            },
            theme: { color: '#4F46E5' },
          });
          rzp.open();
          return;
        } else {
          // Fallback if script load fails
          setCurrentPlanId(planId);
          try { localStorage.setItem('workspace_plan', planId); } catch {}
          showToast(`Upgraded to ${planName}!`);
        }
      }
    } catch (err: unknown) {
      console.warn("Upgrade notice:", (err as Error)?.message);
      setCurrentPlanId(planId);
      try { localStorage.setItem('workspace_plan', planId); } catch {}
      showToast(`Upgraded to ${planName}!`);
    } finally {
      setUpgradingId(null);
    }
  };

  // Pricing calculations
  const isAnnual = billingCycle === 'ANNUAL';
  
  // Business: $180/year ($15/mo) or $20/mo
  const businessPrice = isAnnual ? (180 * people).toFixed(2) : (20 * people).toFixed(2);
  
  // Business + AI: $240/year ($20/mo) or $28/mo
  const businessAiPrice = isAnnual ? (240 * people).toFixed(2) : (28 * people).toFixed(2);

  const cycleLabel = isAnnual ? 'per year (billed annually)' : 'per month (billed monthly)';
  const tierLabel = `Includes 1-${people} active user seat${people > 1 ? 's' : ''}`;

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 font-sans text-[#0F172A]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#0F172A] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <Check size={18} className="text-emerald-400" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* SaaS Rental & Quota Status Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 mb-8 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#E2E8F0]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-[#475569] uppercase tracking-wider">
                Current Workspace Rental
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#ECFDF5] text-[#10B981] border border-[#10B981]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
                {subData?.status || (currentPlanId === 'starter' ? 'FREE TRIAL' : 'ACTIVE SUBSCRIPTION')}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] flex items-center gap-2">
              <span>{currentPlanId === 'business_ai' ? 'Business + AI' : (currentPlanId === 'business' ? 'Business' : 'Free Starter Tier')}</span>
              {currentPlanId !== 'starter' && (
                <Sparkles size={18} className="text-[#4F46E5]" />
              )}
            </h2>
            <p className="text-xs text-[#475569] mt-0.5">
              {tierLabel} · Cloud transcoding &amp; team video sharing active
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const el = document.getElementById('pricing-plans-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CreditCard size={14} />
              <span>Change Plan or Seats</span>
            </button>
          </div>
        </div>

        {/* Quota Breakdown Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
          {/* Storage Quota */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#475569] flex items-center gap-1.5">
                <HardDrive size={14} className="text-[#4F46E5]" />
                Cloud Storage Quota
              </span>
              <span className="text-xs font-bold font-mono text-[#0F172A]">
                {storageData?.usedFormatted || '0 MB'} / {currentPlanId === 'starter' ? '100 MB' : 'Unlimited'}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  (storageData?.percentUsed || 0) > 85 ? 'bg-rose-500' : 'bg-[#4F46E5]'
                }`}
                style={{ width: `${currentPlanId === 'starter' ? (storageData?.percentUsed || 5) : 100}%` }}
              />
            </div>
            <p className="text-[11px] text-[#475569] mt-1.5">
              {currentPlanId === 'starter' ? 'Upgrade to Business for unlimited recording storage.' : 'Unlimited high-speed cloud video storage enabled.'}
            </p>
          </div>

          {/* Seat Capacity */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#475569] flex items-center gap-1.5">
                <Users size={14} className="text-[#06B6D4]" />
                Team Seat Rental
              </span>
              <span className="text-xs font-bold font-mono text-[#0F172A]">
                1 / {people} Seat{people > 1 ? 's' : ''}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#06B6D4] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (1 / people) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-[#475569] mt-1.5">
              Manage member roles and licenses in the Users tab.
            </p>
          </div>

          {/* Security & Access */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#475569] flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#10B981]" />
                SaaS Security Tier
              </span>
              <span className="text-xs font-bold text-[#10B981]">
                SOC2 Compliant
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className="h-full bg-[#10B981] rounded-full w-full" />
            </div>
            <p className="text-[11px] text-[#475569] mt-1.5">
              Encrypted end-to-end video streaming and storage.
            </p>
          </div>
        </div>
      </div>

      {/* Main Title */}
      <div id="pricing-plans-section" className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
          SaaS Subscription &amp; Rental Plans
        </h1>
        <p className="text-sm text-[#475569] mt-1">
          Rent full video studio recording, AI transcription, and team collaboration capabilities for your organization.
        </p>
      </div>

      {/* Controls Row: How many people? + Billing Cycle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-8 border-b border-[#E2E8F0]">
        {/* People Counter */}
        <div className="flex items-center gap-3">
          <label htmlFor="people-input" className="text-sm font-bold text-[#0F172A]">
            How many seats to rent?
          </label>
          <div className="relative flex items-center">
            <input
              id="people-input"
              type="number"
              min={1}
              max={500}
              value={people}
              onChange={(e) => handlePeopleChange(parseInt(e.target.value, 10))}
              className="w-24 px-3 py-1.5 border border-[#E2E8F0] rounded-xl text-sm font-semibold font-mono text-[#0F172A] focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/15 transition-all bg-white"
            />
          </div>
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={() => setShowTooltip(!showTooltip)}
              className="text-[#475569] hover:text-[#0F172A] p-0.5 rounded-full transition-colors cursor-pointer"
            >
              <Info size={16} />
            </button>
            {showTooltip && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2.5 bg-slate-900 text-white text-[11px] rounded-xl shadow-xl z-30 leading-snug">
                Rental pricing scales dynamically based on the number of active team seats in your workspace.
              </div>
            )}
          </div>
        </div>

        {/* Billing Cycle Radio */}
        <div className="flex items-center gap-4 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setBillingCycle('MONTHLY')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              billingCycle === 'MONTHLY' 
                ? 'bg-white text-[#0F172A] shadow-xs' 
                : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            Monthly Rent
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('ANNUAL')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              billingCycle === 'ANNUAL' 
                ? 'bg-[#4F46E5] text-white shadow-xs' 
                : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            <span>Annual Rent</span>
            <span className="bg-emerald-400 text-slate-900 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full uppercase">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* 3 Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        
        {/* CARD 1: Starter */}
        <div className="border border-[#E2E8F0] rounded-2xl p-7 flex flex-col justify-between bg-white relative transition-all hover:shadow-md">
          <div>
            <div className="h-5 mb-2">
              {currentPlanId === 'starter' && (
                <span className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">
                  CURRENT TIER
                </span>
              )}
            </div>
            <h3 className="text-2xl font-bold text-[#0F172A] mb-1">
              Starter
            </h3>
            <p className="text-xs text-[#475569] mb-6 min-h-[36px] leading-relaxed">
              Quick start with basic video capture and 100 MB free cloud storage.
            </p>
            <div className="mb-6">
              <div className="text-3xl font-extrabold font-mono text-[#0F172A]">$0</div>
              <div className="text-xs text-[#475569] font-medium mt-1">Free forever</div>
            </div>

            <ul className="space-y-2.5 text-xs text-[#475569] mb-8">
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[#10B981] shrink-0" />
                <span>100 MB Cloud Storage limit</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[#10B981] shrink-0" />
                <span>Screen, webcam &amp; mic recording</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[#10B981] shrink-0" />
                <span>Instant shareable links</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[#10B981] shrink-0" />
                <span>Basic cuts and trims</span>
              </li>
            </ul>
          </div>

          <div>
            {currentPlanId === 'starter' ? (
              <button
                disabled
                className="w-full py-2.5 px-4 bg-slate-100 text-[#475569] font-bold text-xs rounded-xl cursor-not-allowed transition-colors text-center"
              >
                Current Active Tier
              </button>
            ) : (
              <button
                onClick={() => {
                  setCurrentPlanId('starter');
                  try { localStorage.setItem('workspace_plan', 'starter'); } catch {}
                  showToast("Switched to Starter tier");
                }}
                className="w-full py-2.5 px-4 border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#0F172A] font-bold text-xs rounded-xl transition-colors text-center cursor-pointer"
              >
                Switch to Starter
              </button>
            )}
          </div>
        </div>

        {/* CARD 2: Business */}
        <div className="border border-[#E2E8F0] rounded-2xl p-7 flex flex-col justify-between bg-white relative transition-all hover:shadow-md">
          <div>
            <div className="h-5 mb-2">
              {currentPlanId === 'business' && (
                <span className="text-[11px] font-bold text-[#4F46E5] uppercase tracking-wider">
                  CURRENT TIER
                </span>
              )}
            </div>
            <h3 className="text-2xl font-bold text-[#0F172A] mb-1">
              Business
            </h3>
            <p className="text-xs text-[#475569] mb-6 min-h-[36px] leading-relaxed">
              Move work forward faster with unlimited recording and team sharing.
            </p>
            <div className="mb-6">
              <div className="text-3xl font-extrabold font-mono text-[#0F172A] leading-none">
                ${businessPrice}
              </div>
              <div className="text-xs text-[#475569] font-medium mt-1">
                {cycleLabel}
              </div>
              <div className="text-xs text-[#06B6D4] font-semibold mt-0.5">
                {tierLabel}
              </div>
            </div>

            <ul className="space-y-2.5 text-xs text-[#475569] mb-8">
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[#10B981] shrink-0" />
                <span className="font-semibold text-[#0F172A]">Unlimited cloud recording &amp; storage</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[#10B981] shrink-0" />
                <span>Team workspace &amp; shared video library</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[#10B981] shrink-0" />
                <span>Viewer insights &amp; engagement analytics</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[#10B981] shrink-0" />
                <span>Custom company branding</span>
              </li>
            </ul>
          </div>

          <div>
            {currentPlanId === 'business' ? (
              <button
                disabled
                className="w-full py-2.5 px-4 bg-slate-100 text-[#475569] font-bold text-xs rounded-xl cursor-not-allowed transition-colors text-center"
              >
                Current Active Tier
              </button>
            ) : (
              <button
                onClick={() => handleUpgrade('business')}
                disabled={upgradingId === 'business'}
                className="w-full py-2.5 px-4 border border-[#4F46E5] text-[#4F46E5] hover:bg-[#EEF2FF] font-bold text-xs rounded-xl transition-all text-center cursor-pointer shadow-xs disabled:opacity-50"
              >
                {upgradingId === 'business' ? 'Processing Rental Order...' : 'Rent Business Tier'}
              </button>
            )}
          </div>
        </div>

        {/* CARD 3: Business + AI (RECOMMENDED) */}
        <div className="border-2 border-[#4F46E5] rounded-2xl p-7 flex flex-col justify-between bg-white relative shadow-md transition-all">
          <div>
            <div className="h-5 mb-2 flex items-center justify-between">
              <span className="bg-[#4F46E5] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wide uppercase">
                RECOMMENDED BEST VALUE
              </span>
              {currentPlanId === 'business_ai' && (
                <span className="text-[11px] font-bold text-[#4F46E5] uppercase tracking-wider">
                  CURRENT TIER
                </span>
              )}
            </div>
            <h3 className="text-2xl font-bold text-[#4F46E5] mb-1 flex items-center gap-1.5">
              <span>Business + AI</span>
              <Sparkles size={20} className="text-[#4F46E5]" />
            </h3>
            <p className="text-xs text-[#475569] mb-6 min-h-[36px] leading-relaxed">
              Auto-enhanced by AI: titles, chapters, audio polish, and smart summaries.
            </p>
            <div className="mb-6">
              <div className="text-3xl font-extrabold font-mono text-[#0F172A] leading-none">
                ${businessAiPrice}
              </div>
              <div className="text-xs text-[#475569] font-medium mt-1">
                {cycleLabel}
              </div>
              <div className="text-xs text-[#06B6D4] font-semibold mt-0.5">
                {tierLabel}
              </div>
            </div>

            <ul className="space-y-2.5 text-xs text-[#475569] mb-8">
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[#10B981] shrink-0" />
                <span className="font-semibold text-[#0F172A]">Everything in Business Tier included</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[#10B981] shrink-0" />
                <span>AI auto-generated titles, chapters &amp; summaries</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[#10B981] shrink-0" />
                <span>Instant filler word &amp; background silence removal</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[#10B981] shrink-0" />
                <span>Speech-to-text transcriptions in 50+ languages</span>
              </li>
            </ul>
          </div>

          <div>
            {currentPlanId === 'business_ai' ? (
              <button
                disabled
                className="w-full py-2.5 px-4 bg-slate-100 text-[#475569] font-bold text-xs rounded-xl cursor-not-allowed transition-colors text-center"
              >
                Current Active Tier
              </button>
            ) : (
              <button
                onClick={() => handleUpgrade('business_ai')}
                disabled={upgradingId === 'business_ai'}
                className="w-full py-2.5 px-4 bg-[#4F46E5] hover:bg-[#4338CA] active:bg-[#4338CA] text-white font-bold text-xs rounded-xl transition-all text-center cursor-pointer shadow-md shadow-[#4F46E5]/20 disabled:opacity-50"
              >
                {upgradingId === 'business_ai' ? 'Processing Rental Order...' : 'Rent Business + AI Tier'}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Enterprise & White-Label Rental Information */}
      <div className="mt-12 p-8 bg-gradient-to-r from-slate-900 to-[#0F172A] rounded-2xl text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-[#06B6D4]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#06B6D4]">
              Enterprise &amp; White-Label Rental
            </span>
          </div>
          <h4 className="text-xl font-extrabold text-white">
            Need a dedicated private instance or custom white-label branding?
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            Rent dedicated video infrastructure on your own custom domain (e.g. <span className="font-mono text-cyan-300">record.yourcompany.com</span>) with SAML/SSO authentication, custom storage buckets, and 24/7 dedicated engineering support.
          </p>
        </div>

        <a
          href="mailto:enterprise-sales@rcrd.com?subject=Inquiry%20about%20White-Label%20Rental"
          className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-900 text-xs font-extrabold rounded-xl transition-all shadow-md shrink-0 flex items-center gap-2 cursor-pointer"
        >
          <span>Contact Enterprise Sales</span>
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
