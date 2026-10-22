import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/auth';

export async function GET(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      );
    }

    const user = { ...authResult.user };
    delete user.passwordHash;

    return NextResponse.json(user);
  } catch (error: unknown) {
    console.error('Error fetching current user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { name, avatarUrl } = body;
    const cleanEmail = (authResult.user.email || '').toLowerCase().trim();

    const updateFields: Record<string, unknown> = { updatedAt: Date.now() };
    if (name) updateFields.name = name.trim();
    if (avatarUrl !== undefined) updateFields.avatarUrl = avatarUrl;

    try {
      const { getCollection } = await import('@/lib/server/db');
      const usersCol = await getCollection('users');
      await usersCol.updateOne({ email: cleanEmail }, { $set: updateFields });
    } catch (e) {
      console.warn('MongoDB update me note:', e);
    }

    return NextResponse.json({ success: true, ...updateFields });
  } catch (error: unknown) {
    console.error('Error updating current user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
