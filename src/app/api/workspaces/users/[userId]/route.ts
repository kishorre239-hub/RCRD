import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { User } from '@/lib/server/types';
import { ObjectId } from 'mongodb';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const admin = authResult.user;
    if (!admin.workspaceId || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (admin.id === userId || admin._id?.toString() === userId) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
    }

    const usersCol = await getCollection<User>('users');
    let targetUser: User | null = null;
    try {
      targetUser = await usersCol.findOne({ _id: new ObjectId(userId) });
    } catch {
      targetUser = await usersCol.findOne({ id: userId });
    }

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.workspaceId !== admin.workspaceId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const filter = targetUser._id ? { _id: targetUser._id } : { email: targetUser.email };
    await usersCol.updateOne(filter, {
      $set: { workspaceId: undefined, role: 'USER', updatedAt: Date.now() },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing workspace user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
