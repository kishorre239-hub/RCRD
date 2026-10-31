import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { User } from '@/lib/server/types';

export async function GET(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const cleanEmail = (authResult.user.email || '').toLowerCase().trim();
    const usersCol = await getCollection<User>('users');
    const user = await usersCol.findOne({ email: cleanEmail });

    if (!user) {
      return NextResponse.json({
        id: authResult.user.id,
        email: cleanEmail,
        name: authResult.user.name,
        role: authResult.user.role,
        avatarUrl: authResult.user.avatarUrl || null,
      });
    }

    const sanitized = { ...user };
    delete sanitized.passwordHash;
    return NextResponse.json(sanitized);
  } catch (error: unknown) {
    console.error('Error fetching profile:', (error as Error)?.message || error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const { avatarUrl, name, role, email } = body;

    const targetEmail = (authResult.user?.email || email || '').toLowerCase().trim();
    if (!targetEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    const updateFields: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (avatarUrl !== undefined) updateFields.avatarUrl = avatarUrl;
    if (name) updateFields.name = name.trim();
    if (role && authResult.user?.role?.toUpperCase() === 'ADMIN') updateFields.role = role.trim();

    try {
      const usersCol = await getCollection<User>('users');
      await usersCol.updateOne(
        { email: targetEmail },
        { $set: updateFields },
        { upsert: false }
      );
    } catch (dbErr) {
      console.warn('MongoDB profile update note:', (dbErr as Error)?.message);
    }

    return NextResponse.json({
      success: true,
      email: targetEmail,
      ...updateFields,
    });
  } catch (error: unknown) {
    console.error('Error updating profile:', (error as Error)?.message || error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const POST = PATCH;
export const PUT = PATCH;
