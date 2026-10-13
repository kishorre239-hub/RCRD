import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { Workspace, User } from '@/lib/server/types';
import { ObjectId } from 'mongodb';

export async function POST(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { workspaceId } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    const user = authResult.user;
    if (user.workspaceId) {
      return NextResponse.json({ error: 'You are already in a workspace' }, { status: 400 });
    }

    const workspacesCol = await getCollection<Workspace>('workspaces');
    let workspace: Workspace | null = null;
    try {
      workspace = await workspacesCol.findOne({ _id: new ObjectId(workspaceId) });
    } catch {
      workspace = await workspacesCol.findOne({ id: workspaceId });
    }

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const usersCol = await getCollection<User>('users');
    const userFilter = user._id ? { _id: user._id } : { email: user.email };
    await usersCol.updateOne(userFilter, {
      $set: { workspaceId, role: 'USER', updatedAt: Date.now() },
    });

    return NextResponse.json(workspace);
  } catch (error: any) {
    console.error('Error joining workspace:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
