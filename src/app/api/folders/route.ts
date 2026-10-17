import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/auth';
import { 
  listDriveFolders, 
  createDriveFolder, 
  renameDriveFile, 
  deleteDriveFile 
} from '@/lib/server/drive';

export async function GET() {
  try {
    const folders = await listDriveFolders();
    return NextResponse.json(folders);
  } catch (error: unknown) {
    console.error('Error fetching folders:', error);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    const parentId = typeof body.parentId === 'string' ? body.parentId.trim() : undefined;
    const folderId = await createDriveFolder(name, parentId);
    if (!folderId) {
      return NextResponse.json({ error: 'Failed to create folder on Google Drive' }, { status: 500 });
    }

    return NextResponse.json({
      id: folderId,
      name,
      success: true
    });
  } catch (error: unknown) {
    console.error('Error creating folder:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const { id, name } = body;
    if (!id || !name || !name.trim()) {
      return NextResponse.json({ error: 'Folder id and name are required' }, { status: 400 });
    }

    const success = await renameDriveFile(id, name.trim());
    return NextResponse.json({
      id,
      name: name.trim(),
      success,
    });
  } catch (error: unknown) {
    console.error('Error renaming folder:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const PATCH = PUT;

export async function DELETE(req: Request) {
  try {
    await authenticateRequest(req);
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');
    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    const success = await deleteDriveFile(id);
    return NextResponse.json({ success, id });
  } catch (error: unknown) {
    console.error('Error deleting folder:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
