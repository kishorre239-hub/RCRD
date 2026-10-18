import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { User } from '@/lib/server/types';
import { ObjectId, WithId } from 'mongodb';
import { hashPassword } from '@/lib/server/password';

const PRIMARY_ADMIN: WithId<User> = {
  _id: new ObjectId('660000000000000000000001'),
  id: 'usr-admin-1',
  name: 'Hari Kishore Reddy',
  email: 'harikishorereddy9908@gmail.com',
  role: 'Admin',
  status: 'Active',
  createdAt: 1777000000000,
};

export async function GET(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    const workspaceId = authResult.user?.workspaceId || 'default';

    const usersCol = await getCollection<User>('users');
    let users = await usersCol.find({
      $or: [
        { workspaceId },
        { workspaceId: 'default' },
        { workspaceId: 'ws-default' },
        { workspaceId: { $exists: false } },
      ]
    }).toArray();

    // If no users match workspace, query all users
    if (!users || users.length === 0) {
      users = await usersCol.find({}).limit(50).toArray();
    }

    // Exclude legacy dummy or test accounts
    users = users.filter((u) => {
      const email = (u.email || '').toLowerCase().trim();
      if (email === 'harikishorereddy9908@gmail.com') return true;
      const isDummy =
        email.includes('geonixa.com') ||
        email.includes('@example.com') ||
        email.includes('@meet.com') ||
        /^(sarah|student_|mentor_|newadmin|sec_admin|reuse|test)/i.test(email);
      return !isDummy;
    });

    // Ensure the primary admin is always in the list
    const hasPrimaryAdmin = users.some(u => u.email === PRIMARY_ADMIN.email);
    if (!hasPrimaryAdmin) {
      try {
        await usersCol.insertOne({
          id: PRIMARY_ADMIN.id,
          name: PRIMARY_ADMIN.name,
          email: PRIMARY_ADMIN.email,
          role: PRIMARY_ADMIN.role,
          status: PRIMARY_ADMIN.status,
          workspaceId: 'default',
          createdAt: PRIMARY_ADMIN.createdAt,
          updatedAt: Date.now(),
        });
      } catch {}
      users.unshift(PRIMARY_ADMIN);
    }

    // Sanitize passwords and assign role and allowedNavItems
    const sanitized = users.map((u) => {
      const rawRole = String(u.role || 'Mentor').toUpperCase();
      let roleFormatted = 'Mentor';
      if (rawRole === 'ADMIN') roleFormatted = 'Admin';

      const defaultNavForRole = roleFormatted === 'Admin'
        ? ['for-you', 'library', 'meetings', 'settings', 'manage-users', 'workspace-info']
        : ['for-you', 'library', 'meetings'];

      const allowedNavItems = Array.isArray(u.allowedNavItems) && u.allowedNavItems.length > 0
        ? u.allowedNavItems
        : defaultNavForRole;

      const copy: Record<string, unknown> = {
        ...u,
        id: u.id || u._id?.toString(),
        role: roleFormatted,
        status: u.status || 'Active',
        hasAccess: (u.status || 'Active').toLowerCase() === 'active',
        allowedNavItems,
      };
      delete copy.passwordHash;
      return copy;
    });

    return NextResponse.json(sanitized);
  } catch (error: unknown) {
    console.error('Error fetching workspace users:', error);
    return NextResponse.json([PRIMARY_ADMIN]);
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const { name, email, role = 'Mentor', password, status = 'Active', allowedNavItems } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();
    const rawRole = String(role || 'Mentor').toLowerCase();
    const cleanRole = rawRole === 'admin' ? 'Admin' : 'Mentor';
    const cleanStatus = status === 'Access Revoked' ? 'Access Revoked' : 'Active';
    const workspaceId = authResult.user?.workspaceId || 'default';

    const defaultNav = cleanRole === 'Admin'
      ? ['for-you', 'library', 'meetings', 'settings', 'manage-users', 'workspace-info']
      : ['for-you', 'library', 'meetings'];

    const cleanNavItems = Array.isArray(allowedNavItems) && allowedNavItems.length > 0
      ? allowedNavItems
      : defaultNav;

    const usersCol = await getCollection<User>('users');
    const existing = await usersCol.findOne({ email: cleanEmail });

    const passwordHash = password ? await hashPassword(password) : undefined;

    if (existing) {
      const updateDoc: Record<string, unknown> = {
        name: cleanName,
        role: cleanRole,
        workspaceId,
        status: cleanStatus,
        hasAccess: cleanStatus === 'Active',
        allowedNavItems: cleanNavItems,
        updatedAt: Date.now(),
      };
      if (passwordHash) {
        updateDoc.passwordHash = passwordHash;
      }

      await usersCol.updateOne(
        { email: cleanEmail },
        { $set: updateDoc }
      );
      return NextResponse.json({
        id: existing.id || existing._id?.toString(),
        name: cleanName,
        email: cleanEmail,
        role: cleanRole,
        status: cleanStatus,
        hasAccess: cleanStatus === 'Active',
        allowedNavItems: cleanNavItems,
        createdAt: existing.createdAt || Date.now(),
      });
    }

    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      role: cleanRole,
      workspaceId,
      status: cleanStatus,
      allowedNavItems: cleanNavItems,
      passwordHash: passwordHash || (await hashPassword('rcrd2026')),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const insertRes = await usersCol.insertOne(newUser);
    return NextResponse.json({
      ...newUser,
      id: newUser.id,
      _id: insertRes.insertedId.toString(),
      hasAccess: cleanStatus === 'Active',
    });
  } catch (error: unknown) {
    console.error('Error adding workspace user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const userIds: string[] = Array.isArray(body.userIds) ? body.userIds : [];

    if (userIds.length === 0) {
      return NextResponse.json({ error: 'No user IDs provided for deletion' }, { status: 400 });
    }

    const usersCol = await getCollection<User>('users');

    const objectIds: ObjectId[] = [];
    const stringIds: string[] = [];
    const emails: string[] = [];

    userIds.forEach(id => {
      if (id.includes('@')) {
        emails.push(id.toLowerCase().trim());
      } else {
        stringIds.push(id);
        try {
          objectIds.push(new ObjectId(id));
        } catch {}
      }
    });

    const filter = {
      $and: [
        { email: { $ne: PRIMARY_ADMIN.email } },
        {
          $or: [
            ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
            ...(stringIds.length > 0 ? [{ id: { $in: stringIds } }] : []),
            ...(emails.length > 0 ? [{ email: { $in: emails } }] : []),
          ],
        },
      ],
    };

    const res = await usersCol.deleteMany(filter);
    return NextResponse.json({
      success: true,
      deletedCount: res.deletedCount,
      removedIds: userIds,
    });
  } catch (error: unknown) {
    console.error('Error deleting workspace users in bulk:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
