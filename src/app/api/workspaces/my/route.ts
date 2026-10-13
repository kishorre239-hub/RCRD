import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { Workspace } from '@/lib/server/types';
import { ObjectId } from 'mongodb';

export async function GET(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const user = authResult.user;
    const workspacesCol = await getCollection<Workspace>('workspaces');

    let workspace: Workspace | null = null;
    if (user.workspaceId) {
      try {
        workspace = await workspacesCol.findOne({ _id: new ObjectId(user.workspaceId) });
      } catch {
        workspace = await workspacesCol.findOne({ id: user.workspaceId });
      }
    }

    if (!workspace) {
      workspace = await workspacesCol.findOne({ ownerId: user.id || user._id?.toString() });
    }

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    return NextResponse.json(workspace);
  } catch (error: any) {
    console.error('Error fetching my workspace:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
