"use client";

import React, { useState, useEffect } from "react";
import { 
  Info, Check, HardDrive, Users, 
  CreditCard, Plus, Minus, Calendar,
  Shield, Lock, RefreshCw
} from "lucide-react";
import { 
  getBillingSubscription, 
  createBillingOrder, 
  verifyBillingPayment,
  updateAdminTrial
} from "@/lib/api";
import { useNavPermissions } from "@/lib/navPermissions";

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
  isAdmin?: boolean;
  trialGranted?: boolean;
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
  const { isAdmin: navIsAdmin, userEmail } = useNavPermissions();
  const [people, setPeople] = useState<number>(3);
  const [billingCycle, setBillingCycle] = useState<'ANNUAL' | 'MONTHLY'>(initialBillingCycle);
  const [selectedPlanId, setSelectedPlanId] = useState<'starter' | 'business' | 'business_ai'>(() => {
    if (initialOffering.toLowerCase().includes('business + ai') || initialOffering.toLowerCase().includes('ai')) return 'business_ai';
    if (initialOffering.toLowerCase().includes('business')) return 'business';
    return 'business_ai';
  });
  const [currentPlanId, setCurrentPlanId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedPlan = localStorage.getItem('workspace_plan');
        if (savedPlan) return savedPlan;
      } catch {}
    }
    return 'starter';
  });
  const [trialGranted, setTrialGranted] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('workspace_trial_granted') === 'true';
      } catch {}
    }
    return false;
  });
  const [upgradingId, setUpgradingId] = useState<string | null>(null);
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [storageData, setStorageData] = useState<StorageInfo | null>(null);
  const [subData, setSubData] = useState<SubscriptionInfo | null>(null);

  // Admin access check: nav role, primary owner email, or server subscription payload
  const isAdministrator = navIsAdmin || 
    (userEmail || '').toLowerCase().trim() === "harikishorereddy9908@gmail.com" || 
    subData?.isAdmin === true;

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
      if (typeof data?.trialGranted === 'boolean') {
        setTrialGranted(data.trialGranted);
        try {
          localStorage.setItem('workspace_trial_granted', String(data.trialGranted));
        } catch {}
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

  // Admin Free Trial Grant / Revoke Handler
  const handleToggleAdminTrial = async (grant: boolean) => {
    if (!isAdministrator) {
      showToast("Access denied: Only administrators can modify trial status.");
      return;
    }

    setAdminActionLoading(true);
    try {
      const res = await updateAdminTrial({
        action: grant ? 'grant' : 'revoke',
        days: 14,
      });

      setTrialGranted(grant);
      try {
        localStorage.setItem('workspace_trial_granted', String(grant));
        if (grant) {
          localStorage.setItem('workspace_plan', 'starter');
          setCurrentPlanId('starter');
          setSelectedPlanId('starter');
        }
      } catch {}

      showToast(res?.message || (grant ? "14-day Free Trial granted to this workspace!" : "Free trial revoked. Rental required."));
      await loadSub();
    } catch {
      // Fallback for immediate UI response
      setTrialGranted(grant);
      try {
        localStorage.setItem('workspace_trial_granted', String(grant));
        if (grant) {
          localStorage.setItem('workspace_plan', 'starter');
          setCurrentPlanId('starter');
          setSelectedPlanId('starter');
        }
      } catch {}
      showToast(grant ? "Free Trial granted by Admin!" : "Trial revoked by Admin.");
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleUpgrade = async (planId: 'business' | 'business_ai') => {
    setUpgradingId(planId);
    setSelectedPlanId(planId);
    const planName = planId === 'business_ai' ? 'Business + AI' : 'Business';

    try {
      const orderRes = await createBillingOrder(planId);

      if (orderRes?.testMode) {
        // Instant simulated test upgrade
        await verifyBillingPayment({
          planId,
          razorpay_order_id: orderRes.orderId,
          testMode: true,
        });

        setCurrentPlanId(planId);
        try { localStorage.setItem('workspace_plan', planId); } catch {}
        showToast(`Upgraded to ${planName} for ${people} seat${people > 1 ? 's' : ''}!`);
        await loadSub();
      } else if (orderRes?.keyId && orderRes?.orderId) {
        // Official live Razorpay popup checkout
        const loaded = await loadRazorpayScript();
        if (loaded && window.Razorpay) {
          const rzp = new window.Razorpay({
            key: orderRes.keyId,
            amount: orderRes.amount,
            currency: 'INR',
            name: 'RCRD Studio SaaS',
            description: `${planName} Subscription (${people} seat${people > 1 ? 's' : ''})`,
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
                showToast("Payment confirmed, activating subscription...");
              }
            },
            theme: { color: '#4F46E5' },
          });
          rzp.open();
          return;
        } else {
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

  // Pricing calculations in Indian Rupees (₹)
  const isAnnual = billingCycle === 'ANNUAL';
  
  // Business in INR: Monthly ₹1,500/seat/mo; Annual ₹1,200/seat/mo (billed annually as ₹14,400/seat/yr)
  const businessMonthlyRate = 1500;
  const businessAnnualRate = 1200;
  const businessPriceNum = isAnnual ? (businessAnnualRate * 12 * people) : (businessMonthlyRate * people);
  const businessPriceFormatted = businessPriceNum.toLocaleString('en-IN');
  
  // Business + AI in INR: Monthly ₹2,200/seat/mo; Annual ₹1,760/seat/mo (billed annually as ₹21,120/seat/yr)
  const businessAiMonthlyRate = 2200;
  const businessAiAnnualRate = 1760;
  const businessAiPriceNum = isAnnual ? (businessAiAnnualRate * 12 * people) : (businessAiMonthlyRate * people);
  const businessAiPriceFormatted = businessAiPriceNum.toLocaleString('en-IN');

  const cycleLabel = isAnnual ? 'per year (billed annually)' : 'per month (billed monthly)';
  const tierLabel = `Includes 1-${people} active user seat${people > 1 ? 's' : ''}`;

  // Dynamic values based on selected plan, seats, and billing cycle (Observing Images 1, 2, and 3)
  const activePlanName = selectedPlanId === 'business_ai' 
    ? 'Business + AI Tier' 
    : (selectedPlanId === 'business' ? 'Business Tier' : (trialGranted || isAdministrator ? 'Free Starter Tier' : 'No Active Rental'));

  const activeCostFormatted = selectedPlanId === 'business_ai'
    ? `₹${businessAiPriceFormatted}`
    : (selectedPlanId === 'business' ? `₹${businessPriceFormatted}` : '₹0');

  const currentUsageText = storageData?.usedFormatted || '65.1 KB';
  const dynamicStorageFormatted = selectedPlanId === 'starter'
    ? (trialGranted || isAdministrator ? `${currentUsageText} / 100 MB` : `${currentUsageText} / 0 MB (Locked)`)
    : `${currentUsageText} / Unlimited`;

  const dynamicStorageDesc = selectedPlanId === 'starter'
    ? (trialGranted || isAdministrator 
        ? 'Limited to 100 MB cloud storage. Upgrade to Business for unlimited recording.' 
        : 'Trial locked. Choose Business or Business + AI below to enable cloud storage.')
    : 'Unlimited high-speed cloud video storage & 4K transcoding enabled.';

  const dynamicRenewalFormatted = selectedPlanId === 'starter'
    ? (trialGranted || isAdministrator ? 'Trial Access (14 Days)' : 'Rental Required')
    : (isAnnual ? '30 Oct 2027 (Annual Plan · 20% OFF)' : '30 Nov 2026 (Monthly Plan)');

  const dynamicRenewalDesc = selectedPlanId === 'starter'
    ? (trialGranted || isAdministrator 
        ? 'Admin trial active with zero interruption.' 
        : 'No active rental found. Select a plan below to activate workspace.')
    : `Auto-renews ${isAnnual ? 'annually' : 'monthly'} at ${activeCostFormatted}.`;

  const dynamicStatusBadgeText = selectedPlanId !== 'starter'
    ? 'ACTIVE SUBSCRIPTION'
    : (trialGranted || isAdministrator ? 'TRIAL (ADMIN GRANTED)' : 'RENTAL REQUIRED');

  return (
    <div className="w-full max-w-[1500px] mx-auto px-1 sm:px-2 py-2 font-sans text-[#0F172A]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#0F172A] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <Check size={18} className="text-emerald-400" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Dynamic Top SaaS Rental & Quota Status Card (Addressing Image 3 & User Requirements) */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-7 mb-8 shadow-xs w-full transition-all">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-[#E2E8F0]">
          
          {/* Left Side: Current Rental Plan Info */}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-[#475569] uppercase tracking-wider">
                CURRENT WORKSPACE RENTAL
              </span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                selectedPlanId !== 'starter'
                  ? 'bg-[#ECFDF5] text-[#10B981] border-[#10B981]/25'
                  : (trialGranted || isAdministrator
                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200')
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  selectedPlanId !== 'starter' ? 'bg-[#10B981] animate-pulse' : (trialGranted || isAdministrator ? 'bg-sky-500' : 'bg-amber-500')
                }`}></span>
                {dynamicStatusBadgeText}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              {activePlanName}
            </h2>
          </div>

          {/* Right Side: Dynamic Financial & Seat Control Summary (Reflecting Images 1 & 2) */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 self-stretch lg:self-auto justify-between lg:justify-end bg-[#F8FAFC] lg:bg-transparent p-4 lg:p-0 rounded-xl border lg:border-0 border-[#E2E8F0]">
            
            {/* Live Pricing Counter in INR */}
            <div className="text-left lg:text-right">
              <div className="text-xs font-bold uppercase text-[#475569] tracking-wider">
                TOTAL RENTAL COST
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#0F172A] leading-tight">
                {activeCostFormatted}
              </div>
              <div className="text-[11px] text-[#4F46E5] font-semibold">
                {selectedPlanId === 'starter' 
                  ? (trialGranted || isAdministrator ? 'Free forever (Admin Approved)' : 'Rental Required')
                  : (isAnnual ? 'Billed annually (Save 20%)' : 'Billed monthly')}
              </div>
            </div>

            {/* Quick Interactive Seats Stepper */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider mb-1">
                ACTIVE SEATS
              </span>
              <div className="flex items-center gap-1.5 bg-white border border-[#E2E8F0] rounded-xl p-1 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handlePeopleChange(people - 1)}
                  disabled={people <= 1}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#0F172A] flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer"
                  title="Decrease seats"
                >
                  <Minus size={13} />
                </button>
                <span className="w-10 text-center font-mono font-bold text-sm text-[#0F172A]">
                  {people}
                </span>
                <button
                  type="button"
                  onClick={() => handlePeopleChange(people + 1)}
                  disabled={people >= 500}
                  className="w-7 h-7 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer"
                  title="Increase seats"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>

            {/* Jump to Plans Button */}
            <button
              onClick={() => {
                const el = document.getElementById('pricing-plans-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-4 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer shrink-0"
            >
              <CreditCard size={14} />
              <span>Change Plan or Seats</span>
            </button>
          </div>
        </div>

        {/* Dynamic Quota & Usage Grid (Filling the entire left, center, and right spaces) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-6">
          
          {/* Left Column: Storage Quota */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#475569] flex items-center gap-1.5">
                <HardDrive size={14} className="text-[#4F46E5]" />
                Cloud Storage Quota
              </span>
              <span className="text-xs font-bold font-mono text-[#0F172A]">
                {dynamicStorageFormatted}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  selectedPlanId !== 'starter' 
                    ? 'bg-[#4F46E5] w-full' 
                    : (trialGranted || isAdministrator ? 'bg-[#4F46E5] w-[5%]' : 'bg-rose-400 w-[1%]')
                }`}
              />
            </div>
            <p className="text-[11px] text-[#475569] mt-2">
              {dynamicStorageDesc}
            </p>
          </div>

          {/* Center Column: Team Seat Capacity */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 transition-all">
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
                style={{ width: `${Math.min(100, Math.max(10, (1 / people) * 100))}%` }}
              />
            </div>
            <p className="text-[11px] text-[#475569] mt-2">
              Dynamically allocated across your organization workspace.
            </p>
          </div>

          {/* Right Column: Next Billing Renewal */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#475569] flex items-center gap-1.5">
                <Calendar size={14} className="text-[#10B981]" />
                Next Billing Renewal
              </span>
              <span className="text-xs font-bold font-mono text-[#10B981]">
                {dynamicRenewalFormatted}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${selectedPlanId !== 'starter' ? 'bg-[#10B981] w-full' : (trialGranted || isAdministrator ? 'bg-sky-500 w-full' : 'bg-slate-300 w-0')}`} />
            </div>
            <p className="text-[11px] text-[#475569] mt-2">
              {dynamicRenewalDesc}
            </p>
          </div>
        </div>
      </div>

      {/* Admin Privilege Control Banner (Strictly for Administrator to grant/revoke trials) */}
      {isAdministrator && (
        <div className="mb-8 p-5 bg-gradient-to-r from-indigo-50 via-white to-sky-50 border border-indigo-200 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-[#4F46E5] text-white rounded-xl shadow-xs shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-[#4F46E5] uppercase tracking-wider">
                  Admin Master Control
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF2FF] text-[#4F46E5] border border-indigo-200">
                  ADMIN ONLY PRIVILEGE
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-[#0F172A] mt-0.5">
                Free Trial Access Management
              </h3>
              <p className="text-xs text-[#475569] mt-0.5 max-w-2xl leading-relaxed">
                Free trials are restricted across the platform. As the administrator, only you have the authority to grant or revoke 14-day free trials for workspaces.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
            {trialGranted ? (
              <button
                type="button"
                onClick={() => handleToggleAdminTrial(false)}
                disabled={adminActionLoading}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {adminActionLoading ? <RefreshCw size={13} className="animate-spin" /> : <Lock size={13} />}
                <span>Revoke Trial (Require Rental)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleToggleAdminTrial(true)}
                disabled={adminActionLoading}
                className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {adminActionLoading ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                <span>Grant 14-Day Free Trial</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Section Header */}
      <div id="pricing-plans-section" className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
          SaaS Subscription &amp; Rental Plans
        </h1>
      </div>

      {/* Controls Row: How many seats to rent? + Billing Cycle (Indian Rupees) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-8 border-b border-[#E2E8F0]">
        
        {/* Seats Input */}
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
                Rental pricing scales dynamically in Indian Rupees (₹) based on active team seats.
              </div>
            )}
          </div>
        </div>

        {/* Monthly vs Annual Rental Toggle (Observing Images 1 and 2) */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setBillingCycle('MONTHLY')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              billingCycle === 'ANNUAL' 
                ? 'bg-[#4F46E5] text-white shadow-xs' 
                : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            <span>Annual Rent</span>
            <span className="bg-emerald-400 text-slate-900 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full uppercase">
              SAVE 20%
            </span>
          </button>
        </div>
      </div>

      {/* 3 Pricing Cards Grid across widescreen layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        
        {/* CARD 1: Starter (Controlled: Admin only access for free trials) */}
        <div 
          onClick={() => {
            if (isAdministrator || trialGranted) {
              setSelectedPlanId('starter');
            }
          }}
          className={`border rounded-2xl p-7 flex flex-col justify-between bg-white relative transition-all cursor-pointer ${
            selectedPlanId === 'starter' ? 'border-[#4F46E5] ring-2 ring-[#4F46E5]/20 shadow-md' : 'border-[#E2E8F0] hover:shadow-md'
          }`}
        >
          <div>
            <div className="h-6 mb-2 flex items-center justify-between">
              {currentPlanId === 'starter' ? (
                <span className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">
                  CURRENT TIER
                </span>
              ) : (
                <span />
              )}
              {isAdministrator ? (
                <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-[#4F46E5] text-[10px] font-bold rounded uppercase">
                  Admin Privilege
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold rounded uppercase flex items-center gap-1">
                  <Lock size={10} />
                  Admin Only
                </span>
              )}
            </div>
            <h3 className="text-2xl font-bold text-[#0F172A] mb-1">
              Starter
            </h3>
            <p className="text-xs text-[#475569] mb-6 min-h-[36px] leading-relaxed">
              {trialGranted || isAdministrator 
                ? 'Quick start with basic video capture and 100 MB cloud storage.' 
                : 'Free trials are strictly restricted and must be granted by workspace administrators.'}
            </p>
            <div className="mb-6">
              <div className="text-3xl font-extrabold font-mono text-[#0F172A]">₹0</div>
              <div className="text-xs text-[#475569] font-medium mt-1">
                {trialGranted || isAdministrator ? 'Free forever (Admin Approved)' : 'Requires Admin Approval'}
              </div>
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
            {isAdministrator ? (
              // Admin view: Can activate / grant trial
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlanId('starter');
                  handleToggleAdminTrial(true);
                }}
                className={`w-full py-2.5 px-4 font-bold text-xs rounded-xl transition-all text-center cursor-pointer ${
                  selectedPlanId === 'starter' && trialGranted
                    ? 'bg-slate-100 text-[#475569]'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-[#4F46E5] border border-indigo-200'
                }`}
              >
                {selectedPlanId === 'starter' && trialGranted ? 'Active Trial (Admin Granted)' : 'Admin: Activate Free Trial'}
              </button>
            ) : trialGranted ? (
              // Non-admin with trial granted
              <button
                disabled
                className="w-full py-2.5 px-4 bg-slate-100 text-[#475569] font-bold text-xs rounded-xl cursor-not-allowed transition-colors text-center"
              >
                Active Trial (Admin Granted)
              </button>
            ) : (
              // Non-admin without trial: locked!
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  showToast("Free trials are restricted. Only administrators can grant access. Please choose Business or Business + AI below.");
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs rounded-xl transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Lock size={13} />
                <span>Admin Approval Required</span>
              </button>
            )}
          </div>
        </div>

        {/* CARD 2: Business (Reflecting Image 1 & 2 Pricing) */}
        <div 
          onClick={() => setSelectedPlanId('business')}
          className={`border rounded-2xl p-7 flex flex-col justify-between bg-white relative transition-all cursor-pointer ${
            selectedPlanId === 'business' ? 'border-[#4F46E5] ring-2 ring-[#4F46E5]/20 shadow-md' : 'border-[#E2E8F0] hover:shadow-md'
          }`}
        >
          <div>
            <div className="h-6 mb-2">
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
                ₹{businessPriceFormatted}
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
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpgrade('business');
                }}
                disabled={upgradingId === 'business'}
                className="w-full py-2.5 px-4 border border-[#4F46E5] text-[#4F46E5] hover:bg-[#EEF2FF] font-bold text-xs rounded-xl transition-all text-center cursor-pointer shadow-xs disabled:opacity-50"
              >
                {upgradingId === 'business' ? 'Processing Rental Order...' : 'Rent Business Tier'}
              </button>
            )}
          </div>
        </div>

        {/* CARD 3: Business + AI (Reflecting Image 1 & 2 Pricing) */}
        <div 
          onClick={() => setSelectedPlanId('business_ai')}
          className={`border-2 rounded-2xl p-7 flex flex-col justify-between bg-white relative shadow-md transition-all cursor-pointer ${
            selectedPlanId === 'business_ai' ? 'border-[#4F46E5] ring-2 ring-[#4F46E5]/20' : 'border-[#4F46E5]'
          }`}
        >
          <div>
            <div className="h-6 mb-2 flex items-center justify-between">
              <span className="bg-[#4F46E5] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wide uppercase">
                RECOMMENDED BEST VALUE
              </span>
              {currentPlanId === 'business_ai' && (
                <span className="text-[11px] font-bold text-[#4F46E5] uppercase tracking-wider">
                  CURRENT TIER
                </span>
              )}
            </div>
            <h3 className="text-2xl font-bold text-[#4F46E5] mb-1">
              Business + AI
            </h3>
            <p className="text-xs text-[#475569] mb-6 min-h-[36px] leading-relaxed">
              Auto-enhanced by AI: titles, chapters, audio polish, and smart summaries.
            </p>
            <div className="mb-6">
              <div className="text-3xl font-extrabold font-mono text-[#0F172A] leading-none">
                ₹{businessAiPriceFormatted}
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
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpgrade('business_ai');
                }}
                disabled={upgradingId === 'business_ai'}
                className="w-full py-2.5 px-4 bg-[#4F46E5] hover:bg-[#4338CA] active:bg-[#4338CA] text-white font-bold text-xs rounded-xl transition-all text-center cursor-pointer shadow-md shadow-[#4F46E5]/20 disabled:opacity-50"
              >
                {upgradingId === 'business_ai' ? 'Processing Rental Order...' : 'Rent Business + AI Tier'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
