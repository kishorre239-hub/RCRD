import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { User } from '@/lib/server/types';
import { ObjectId } from 'mongodb';
import { hashPassword } from '@/lib/server/password';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const authResult = await authenticateRequest(req);
    const currentUser = authResult.user;

    const usersCol = await getCollection<User>('users');
    let targetUser: User | null = null;
    try {
      targetUser = await usersCol.findOne({ _id: new ObjectId(userId) });
    } catch {
      targetUser = await usersCol.findOne({ id: userId });
    }

    if (!targetUser) {
      // Also try finding by email if userId was an email
      if (userId.includes('@')) {
        targetUser = await usersCol.findOne({ email: userId.toLowerCase().trim() });
      }
    }

    if (!targetUser) {
      return NextResponse.json({ success: true, message: 'User not found or already removed' });
    }

    // Protect primary workspace owner
    if (targetUser.email === 'harikishorereddy9908@gmail.com') {
      return NextResponse.json({ error: 'Cannot remove the primary workspace owner' }, { status: 400 });
    }

    if (currentUser && (currentUser.id === targetUser.id || currentUser._id?.toString() === targetUser._id?.toString())) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
    }

    const filter = targetUser._id ? { _id: targetUser._id } : { email: targetUser.email };
    await usersCol.deleteOne(filter);

    return NextResponse.json({ success: true, removedId: userId });
  } catch (error: any) {
    console.error('Error removing workspace user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const body = await req.json().catch(() => ({}));
    const { role, status, name, password, hasAccess, allowedNavItems } = body;

    const usersCol = await getCollection<User>('users');
    let targetUser: User | null = null;
    try {
      targetUser = await usersCol.findOne({ _id: new ObjectId(userId) });
    } catch {
      targetUser = await usersCol.findOne({ id: userId });
    }

    if (!targetUser && userId.includes('@')) {
      targetUser = await usersCol.findOne({ email: userId.toLowerCase().trim() });
    }

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updateFields: Partial<User> = { updatedAt: Date.now() };
    if (role) {
      const raw = String(role).toLowerCase();
      updateFields.role = raw === 'admin' ? 'Admin' : (raw === 'mentor' ? 'Mentor' : 'Creator');
    }
    if (status) {
      updateFields.status = status;
    }
    if (hasAccess !== undefined) {
      updateFields.status = hasAccess ? 'Active' : 'Access Revoked';
    }
    if (Array.isArray(allowedNavItems)) {
      updateFields.allowedNavItems = allowedNavItems;
    }
    if (name) {
      updateFields.name = name.trim();
    }
    if (password) {
      updateFields.passwordHash = await hashPassword(password);
    }

    const filter = targetUser._id ? { _id: targetUser._id } : { email: targetUser.email };
    await usersCol.updateOne(filter, { $set: updateFields });

    const updated = await usersCol.findOne(filter);
    return NextResponse.json({
      success: true,
      user: {
        id: updated?.id || updated?._id?.toString() || userId,
        name: updated?.name,
        email: updated?.email,
        role: updated?.role,
        status: updated?.status || 'Active',
        hasAccess: (updated?.status || 'Active').toLowerCase() === 'active',
        allowedNavItems: updated?.allowedNavItems || ['for-you', 'library', 'meetings'],
      },
    });
  } catch (error: any) {
    console.error('Error updating workspace user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
