import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { Workspace, User } from '@/lib/server/types';

export async function GET(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const workspacesCol = await getCollection<Workspace>('workspaces');
    const workspaces = await workspacesCol.find({}).toArray();

    return NextResponse.json(workspaces);
  } catch (error: any) {
    console.error('Error fetching workspaces:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
    }

    const user = authResult.user;
    const usersCol = await getCollection<User>('users');
    const workspacesCol = await getCollection<Workspace>('workspaces');

    const ownerId = user.id || user._id?.toString() || '';
    const newWorkspace: Workspace = {
      name: name.trim(),
      ownerId,
      members: [ownerId],
      createdAt: Date.now(),
    };

    const res = await workspacesCol.insertOne(newWorkspace);
    const workspaceId = res.insertedId.toString();
    newWorkspace.id = workspaceId;

    const userFilter = user._id ? { _id: user._id } : { email: user.email };
    await usersCol.updateOne(userFilter, {
      $set: { workspaceId, role: 'ADMIN', updatedAt: Date.now() },
    });

    return NextResponse.json(newWorkspace);
  } catch (error: any) {
    console.error('Error creating workspace:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
