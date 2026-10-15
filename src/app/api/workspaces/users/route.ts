import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { User } from '@/lib/server/types';

const PRIMARY_ADMIN = {
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
      users.unshift(PRIMARY_ADMIN as any);
    }

    // Sanitize passwords
    const sanitized = users.map((u) => {
      const copy: Record<string, unknown> = {
        ...u,
        id: u.id || u._id?.toString(),
        role: String(u.role || 'Creator').toUpperCase() === 'ADMIN' ? 'Admin' : 'Creator',
        status: u.status || 'Active',
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
    const { name, email, role = 'Creator' } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();
    const cleanRole = role.toLowerCase() === 'admin' ? 'Admin' : 'Creator';
    const workspaceId = authResult.user?.workspaceId || 'default';

    const usersCol = await getCollection<User>('users');
    const existing = await usersCol.findOne({ email: cleanEmail });

    if (existing) {
      await usersCol.updateOne(
        { email: cleanEmail },
        {
          $set: {
            name: cleanName,
            role: cleanRole,
            workspaceId,
            status: 'Active',
            updatedAt: Date.now(),
          }
        }
      );
      return NextResponse.json({
        id: existing.id || existing._id?.toString(),
        name: cleanName,
        email: cleanEmail,
        role: cleanRole,
        status: 'Active',
        createdAt: existing.createdAt || Date.now(),
      });
    }

    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      role: cleanRole,
      workspaceId,
      status: 'Active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const insertRes = await usersCol.insertOne(newUser);
    return NextResponse.json({
      ...newUser,
      id: newUser.id,
      _id: insertRes.insertedId.toString(),
    });
  } catch (error: unknown) {
    console.error('Error adding workspace user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
