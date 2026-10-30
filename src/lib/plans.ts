/**
 * Geonixa Loom SaaS Platform - Subscription Plans & Quota Configuration
 * 
 * Pricing & Quota Structure:
 * - Free Trial: 100 MB Cloud Storage (₹0)
 * - Pro Individual: ₹1,500 / month (4K, AI Transcription, Unlimited recording)
 * - Team Workspace: ₹3,000 / month per team (Team spaces, Admin tools, 15 seats)
 * - Yearly Enterprise: ₹20,000 / year (Recommended, Save 44%, Priority SLA, 50 seats)
 */

export interface PlanDefinition {
  id: string;
  name: string;
  price: number; // in INR
  interval: 'free' | 'month' | 'year';
  intervalLabel: string;
  displayPrice: string;
  storageLimitMb: number;
  storageLimitBytes: number;
  maxSeats: number;
  recommended?: boolean;
  badge?: string;
  description: string;
  features: string[];
  ctaLabel: string;
}

export const SAAS_PLANS: Record<string, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free Trial',
    price: 0,
    interval: 'free',
    intervalLabel: 'Forever free',
    displayPrice: '₹0',
    storageLimitMb: 100, // 100 MB free trial storage limit
    storageLimitBytes: 100 * 1024 * 1024,
    maxSeats: 1,
    description: 'Quick start with 100 MB free storage to record and share videos.',
    features: [
      '100 MB Cloud Storage limit',
      'Screen, Tab, Webcam & Mic recording',
      'Basic video editor (cuts & trim)',
      'Instant shareable links',
      '1 Workspace seat',
      '720p HD recording output'
    ],
    ctaLabel: 'Current Plan',
  },
  pro: {
    id: 'pro',
    name: 'Pro Individual',
    price: 1500,
    interval: 'month',
    intervalLabel: '/month',
    displayPrice: '₹1,500',
    storageLimitMb: -1, // Unlimited for paid SaaS
    storageLimitBytes: -1,
    maxSeats: 1,
    description: 'For solo professionals and power creators requiring 4K capture and AI tools.',
    features: [
      'Unlimited Cloud Video Recording',
      'Unlimited recording duration',
      '1080p & 4K Ultra-HD capture',
      'Automated AI transcriptions & summaries',
      'Custom branding & thumbnail uploads',
      'Password protection & viewer analytics'
    ],
    ctaLabel: 'Upgrade to Pro',
  },
  team: {
    id: 'team',
    name: 'Team Workspace',
    price: 3000,
    interval: 'month',
    intervalLabel: '/month per team',
    displayPrice: '₹3,000',
    storageLimitMb: -1, // Unlimited for paid SaaS
    storageLimitBytes: -1,
    maxSeats: 15,
    description: 'For companies and teams renting the software monthly with shared collaboration.',
    features: [
      'Shared Team Video Library',
      'Team workspace with up to 15 seats included',
      'Company video spaces & tag folders',
      'WebRTC meeting rooms & live recording',
      'Team engagement & view analytics',
      'Admin role control & teammate invites'
    ],
    ctaLabel: 'Upgrade Team Plan',
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 1500,
    interval: 'month',
    intervalLabel: '/month per seat',
    displayPrice: '₹1,500',
    storageLimitMb: -1,
    storageLimitBytes: -1,
    maxSeats: 100,
    description: 'Move work forward faster with unlimited videos and basic editing',
    features: [
      'Unlimited video recording and storage',
      'Basic video editing & trim',
      'Team workspace & shared library',
      'Viewer insights & analytics',
      'Custom branding'
    ],
    ctaLabel: 'Rent Business Tier',
  },
  business_ai: {
    id: 'business_ai',
    name: 'Business + AI',
    price: 2200,
    interval: 'month',
    intervalLabel: '/month per seat',
    displayPrice: '₹2,200',
    storageLimitMb: -1,
    storageLimitBytes: -1,
    maxSeats: 100,
    recommended: true,
    badge: 'RECOMMENDED BEST VALUE',
    description: 'Communicate your best with videos auto-enhanced by AI and polished with advanced editing tools',
    features: [
      'Everything in Business plan',
      'AI auto-generated titles, summaries & chapters',
      'Instant filler word & silence removal',
      'Auto-enhanced audio & noise reduction',
      'AI composite action items & tasks'
    ],
    ctaLabel: 'Rent Business + AI Tier',
  },
  yearly: {
    id: 'yearly',
    name: 'Enterprise Annual (Best Value)',
    price: 20000,
    interval: 'year',
    intervalLabel: '/year',
    displayPrice: '₹20,000',
    storageLimitMb: -1, // Unlimited for paid SaaS
    storageLimitBytes: -1,
    maxSeats: 50,
    recommended: true, // Marked recommended
    badge: 'RECOMMENDED (SAVE 44%)',
    description: 'Our most recommended plan for businesses. Save ₹16,000 compared to monthly billing.',
    features: [
      'Dedicated Organization Video Hosting',
      'Everything in Team Plan included',
      'Up to 50 team member seats',
      'Priority 24/7 VIP SLA support',
      'Custom company branding & custom domain ready',
      'Advanced compliance, audit logs & bulk export'
    ],
    ctaLabel: 'Get Recommended Yearly Plan',
  },
};

/**
 * Helper to fetch a plan safely, falling back to 'free'
 */
export function getPlan(planId?: string | null): PlanDefinition {
  if (!planId) return SAAS_PLANS.free;
  const cleanId = planId.toLowerCase().trim();
  return SAAS_PLANS[cleanId] || SAAS_PLANS.free;
}

/**
 * Format bytes to readable string (e.g. 14.5 MB / 100 MB, or 'Unlimited')
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes < 0) return 'Unlimited';
  if (bytes === 0) return '0 MB';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0) return `${bytes} Bytes`;
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i] || 'MB'}`;
}
