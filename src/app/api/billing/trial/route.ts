import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { User, Workspace } from '@/lib/server/types';
import { ObjectId } from 'mongodb';

const PRIMARY_OWNER_EMAIL = "harikishorereddy9908@gmail.com";

export async function POST(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const currentUser = authResult.user;
    const cleanEmail = (currentUser.email || '').toLowerCase().trim();
    const isAdmin = cleanEmail === PRIMARY_OWNER_EMAIL || (currentUser.role || '').toLowerCase() === 'admin';

    // Strictly enforce: No one can grant/revoke free trials except the Admin!
    if (!isAdmin) {
      return NextResponse.json({ 
        error: 'Access denied: Only workspace administrators have the privilege to grant or revoke free trials.' 
      }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { action = 'grant', targetEmail, days = 14 } = body;
    const effectiveEmail = (targetEmail || cleanEmail).toLowerCase().trim();

    const usersCol = await getCollection<User>('users');
    const workspacesCol = await getCollection<Workspace>('workspaces');

    const durationMs = (days || 14) * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const trialExpiresAt = now + durationMs;

    if (action === 'revoke') {
      await usersCol.updateOne(
        { email: effectiveEmail },
        {
          $set: {
            trialGranted: false,
            subscriptionStatus: 'EXPIRED',
            updatedAt: now,
          }
        }
      );

      return NextResponse.json({
        success: true,
        trialGranted: false,
        message: `Free trial has been revoked for ${effectiveEmail}.`,
      });
    }

    // Grant Free Trial
    await usersCol.updateOne(
      { email: effectiveEmail },
      {
        $set: {
          trialGranted: true,
          trialGrantedAt: now,
          trialExpiresAt: trialExpiresAt,
          trialGrantedBy: currentUser.email,
          subscriptionStatus: 'TRIAL',
          plan: 'free',
          updatedAt: now,
        }
      },
      { upsert: false }
    );

    // Also update workspace if applicable
    if (currentUser.workspaceId && currentUser.workspaceId !== 'default') {
      try {
        await workspacesCol.updateOne(
          { _id: new ObjectId(currentUser.workspaceId) },
          {
            $set: {
              trialGranted: true,
              trialExpiresAt: trialExpiresAt,
              subscriptionStatus: 'TRIAL',
              plan: 'free',
              updatedAt: now,
            }
          }
        );
      } catch {}
    }

    return NextResponse.json({
      success: true,
      trialGranted: true,
      trialExpiresAt,
      message: `Admin authorization successful: ${days}-day Free Trial granted to ${effectiveEmail}.`,
    });
  } catch (error: unknown) {
    console.error('Error in trial management endpoint:', (error as Error)?.message || error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
