import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/auth';
import { SAAS_PLANS, getPlan } from '@/lib/plans';

export async function POST(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const user = authResult.user;
    const body = await req.json().catch(() => ({}));
    const { planId } = body;

    if (!planId || !SAAS_PLANS[planId] || planId === 'free') {
      return NextResponse.json({ error: 'Valid paid planId (pro, team, yearly) is required' }, { status: 400 });
    }

    const selectedPlan = getPlan(planId);
    const amountInPaise = selectedPlan.price * 100; // Razorpay expects amount in paise (₹1 = 100 paise)

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // If Razorpay keys are not provided yet (as user indicated they will provide keys later),
    // provide a seamless Test / Demo order mode so testing is 100% error-free!
    if (!keyId || !keySecret) {
      const mockOrderId = `order_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return NextResponse.json({
        orderId: mockOrderId,
        amount: amountInPaise,
        currency: 'INR',
        keyId: 'rzp_test_simulated',
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        testMode: true,
        message: 'Razorpay keys pending: running in simulated test mode. Upgrade can proceed immediately.',
      });
    }

    // Call official Razorpay REST API
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_${user.id || 'u'}_${Date.now()}`,
        notes: {
          userId: user.id || user._id?.toString() || '',
          userEmail: user.email,
          workspaceId: user.workspaceId || 'default',
          planId: selectedPlan.id,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Razorpay order creation failed:', errorData);
      return NextResponse.json({ 
        error: errorData.error?.description || 'Failed to create Razorpay order',
        details: errorData 
      }, { status: 500 });
    }

    const orderData = await response.json();

    return NextResponse.json({
      orderId: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId: keyId,
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      testMode: false,
    });
  } catch (error: unknown) {
    console.error('Billing order error:', (error as Error)?.message || error);
    return NextResponse.json({ error: (error as Error)?.message || 'Internal Server Error' }, { status: 500 });
  }
}
