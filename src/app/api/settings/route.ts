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

    return NextResponse.json(
      settings || {
        driveRootFolderId: process.env.DRIVE_DEFAULT_FOLDER_ID || '',
        maxVideoSizeMb: 500,
        allowPublicSharing: true,
        platformName: 'RCRD',
      }
    );
  } catch (error: unknown) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return handleUpdate(req);
}

export async function PUT(req: Request) {
  return handleUpdate(req);
}

async function handleUpdate(req: Request) {
  try {
    const authResult = await authenticateRequest(req, ['ROLE_ADMIN', 'ADMIN']);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const settingsCol = await getCollection<SystemSettings>('system_settings');

    const updateData: Partial<SystemSettings> & { _id?: unknown } = {
      ...body,
      updatedAt: Date.now(),
    };
    delete updateData._id;

    await settingsCol.updateOne(
      {},
      { $set: updateData },
      { upsert: true }
    );

    const updated = await settingsCol.findOne({});
    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
