import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { SystemSettings } from '@/lib/server/types';

export async function GET(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const settingsCol = await getCollection<SystemSettings>('system_settings');
    const settings = await settingsCol.findOne({});

    return NextResponse.json({
      folderId: settings?.driveRootFolderId || process.env.DRIVE_DEFAULT_FOLDER_ID || '',
    });
  } catch (error: any) {
    console.error('Error fetching drive folder:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await authenticateRequest(req, ['ROLE_ADMIN', 'ADMIN']);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const folderId = body.folderId || body.driveFolderLink || body.link;

    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID or link is required' }, { status: 400 });
    }

    const settingsCol = await getCollection<SystemSettings>('system_settings');
    await settingsCol.updateOne(
      {},
      { $set: { driveRootFolderId: folderId, updatedAt: Date.now() } },
      { upsert: true }
    );

    return NextResponse.json({ success: true, folderId });
  } catch (error: any) {
    console.error('Error saving drive folder:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
