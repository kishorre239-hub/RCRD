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

    const user = authResult.user;
    if (!user.workspaceId) {
      return NextResponse.json({ error: 'User is not in a workspace' }, { status: 403 });
    }

    const usersCol = await getCollection<User>('users');
    const users = await usersCol.find({ workspaceId: user.workspaceId }).toArray();

    // Sanitize passwords
    const sanitized = users.map((u) => {
      const copy = { ...u, id: u.id || u._id?.toString() };
      delete copy.passwordHash;
      return copy;
    });

    return NextResponse.json(sanitized);
  } catch (error: any) {
    console.error('Error fetching workspace users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
