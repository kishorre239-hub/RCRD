import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { User, Workspace, SubscriptionRecord } from '@/lib/server/types';
import { SAAS_PLANS, getPlan } from '@/lib/plans';
import { ObjectId } from 'mongodb';

export async function POST(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const user = authResult.user;
    const body = await req.json().catch(() => ({}));
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      planId,
      testMode
    } = body;

    if (!planId || !SAAS_PLANS[planId]) {
      return NextResponse.json({ error: 'Valid planId is required' }, { status: 400 });
    }

    const plan = getPlan(planId);
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Verify signature if live credentials exist and it's not a simulated test mode
    if (keySecret && !testMode && razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      const hmac = crypto.createHmac('sha256', keySecret);
      hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
      const generatedSignature = hmac.digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return NextResponse.json({ error: 'Payment signature verification failed' }, { status: 400 });
      }
    }

    const now = Date.now();
    // Calculate expiration based on interval (30 days for monthly, 365 days for yearly)
    const durationDays = plan.interval === 'year' ? 365 : 30;
    const expiresAt = now + durationDays * 24 * 60 * 60 * 1000;

    const usersCol = await getCollection<User>('users');
    const workspacesCol = await getCollection<Workspace>('workspaces');
    const subsCol = await getCollection<SubscriptionRecord>('subscriptions');

    const paymentId = razorpay_payment_id || `pay_sim_${Date.now()}`;
    const orderId = razorpay_order_id || `order_sim_${Date.now()}`;

    // 1. Save subscription transaction record
    const subRecord: SubscriptionRecord = {
      userId: user.id || user._id?.toString() || '',
      userEmail: user.email,
      workspaceId: user.workspaceId || 'default',
      planId: plan.id,
      amount: plan.price,
      currency: 'INR',
      paymentId: paymentId,
      orderId: orderId,
      signature: razorpay_signature || 'simulated',
      status: 'ACTIVE',
      interval: plan.interval,
      createdAt: now,
      expiresAt: expiresAt,
    };
    await subsCol.insertOne(subRecord);

    // 2. Update User plan & subscription status
    const userFilter = user._id ? { _id: typeof user._id === 'string' ? new ObjectId(user._id) : user._id } : { email: user.email };
    await usersCol.updateOne(userFilter, {
      $set: {
        plan: plan.id,
        subscriptionStatus: 'ACTIVE',
        subscriptionId: paymentId,
        subscriptionExpiresAt: expiresAt,
        updatedAt: now,
      }
    });

    // 3. Update Workspace plan if user has one
    if (user.workspaceId && user.workspaceId !== 'default') {
      try {
        await workspacesCol.updateOne(
          { _id: new ObjectId(user.workspaceId) },
          {
            $set: {
              plan: plan.id,
              subscriptionStatus: 'ACTIVE',
              subscriptionId: paymentId,
              subscriptionExpiresAt: expiresAt,
            }
          }
        );
      } catch {
        // Workspace ID may be string-based or not found
      }
    }

    return NextResponse.json({
      success: true,
      plan: plan,
      message: `Successfully upgraded to ${plan.name}! Storage and features have been applied.`,
      expiresAt,
    });
  } catch (error: unknown) {
    console.error('Billing verification error:', (error as Error)?.message || error);
    return NextResponse.json({ error: (error as Error)?.message || 'Internal Server Error' }, { status: 500 });
  }
}
