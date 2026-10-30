import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { User, Video, SubscriptionRecord } from '@/lib/server/types';
import { SAAS_PLANS, getPlan, formatBytes } from '@/lib/plans';
import { ObjectId } from 'mongodb';

export async function GET(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const user = authResult.user;
    const userId = user.id || user._id?.toString() || '';
    const workspaceId = user.workspaceId || 'default';

    // Fetch user from DB to get the latest plan info
    const usersCol = await getCollection<User>('users');
    let dbUser: User | null = null;
    if (user._id) {
      dbUser = await usersCol.findOne({ _id: typeof user._id === 'string' ? new ObjectId(user._id) : user._id });
    }
    if (!dbUser && user.email) {
      dbUser = await usersCol.findOne({ email: user.email.toLowerCase() });
    }

    const PRIMARY_OWNER_EMAIL = "harikishorereddy9908@gmail.com";
    const userEmail = (user.email || '').toLowerCase().trim();
    const isAdmin = userEmail === PRIMARY_OWNER_EMAIL || (user.role || '').toLowerCase() === 'admin';
    const trialGranted = dbUser?.trialGranted === true || isAdmin;

    const currentPlanId = dbUser?.plan || user.plan || (trialGranted ? 'free' : 'none');
    const isPaidPlan = ['pro', 'team', 'business', 'business_ai', 'yearly'].includes(currentPlanId);
    const plan = isPaidPlan ? getPlan(currentPlanId) : (trialGranted ? getPlan('free') : {
      ...getPlan('free'),
      name: 'No Active Subscription',
      description: 'Rental payment or Admin trial approval required to unlock workspace features.',
      storageLimitBytes: 0,
      storageLimitMb: 0,
    });

    // Calculate storage used by this workspace or user
    const videosCol = await getCollection<Video>('videos');
    const videos = await videosCol.find({
      $or: [
        { workspaceId: workspaceId },
        { ownerId: userId }
      ]
    }).project({ size: 1 }).toArray();

    const usedBytes = videos.reduce((acc: number, v: { size?: number }) => acc + (v.size || 0), 0);
    const limitBytes = plan.storageLimitBytes;
    const isUnlimited = limitBytes < 0;
    const percentUsed = isUnlimited ? 0 : (limitBytes === 0 ? 100 : Math.min(100, Math.round((usedBytes / limitBytes) * 100)));

    // Fetch latest active subscription record if any
    const subsCol = await getCollection<SubscriptionRecord>('subscriptions');
    const latestSub = await subsCol.findOne(
      { $or: [{ userId }, { workspaceId }] },
      { sort: { createdAt: -1 } }
    );

    const subscriptionStatus = isPaidPlan 
      ? (dbUser?.subscriptionStatus || 'ACTIVE')
      : (trialGranted ? 'TRIAL (ADMIN GRANTED)' : 'RENTAL REQUIRED');

    return NextResponse.json({
      plan: plan,
      planId: currentPlanId,
      isAdmin,
      trialGranted,
      canAccessFreeTrial: isAdmin || trialGranted,
      storage: {
        usedBytes,
        limitBytes,
        usedFormatted: formatBytes(usedBytes),
        limitFormatted: isUnlimited ? 'Unlimited' : (limitBytes === 0 ? '0 MB (Locked)' : formatBytes(limitBytes)),
        percentUsed,
        isOverLimit: !isUnlimited && usedBytes >= limitBytes,
      },
      subscription: {
        status: subscriptionStatus,
        expiresAt: dbUser?.subscriptionExpiresAt || latestSub?.expiresAt || dbUser?.trialExpiresAt || null,
        orderId: latestSub?.orderId || null,
        paymentId: latestSub?.paymentId || null,
      },
      allPlans: Object.values(SAAS_PLANS),
    });
  } catch (error: unknown) {
    console.error('Error fetching billing subscription:', (error as Error)?.message || error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
