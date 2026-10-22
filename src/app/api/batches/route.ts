import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import {
  getAllBackupBatches,
  getBackupBatch,
  saveBackupBatch,
  deleteBackupBatch,
  StoredBatch,
} from '@/lib/server/localBackup';

function cleanEmails(input: unknown): string[] {
  let list: string[] = [];
  if (Array.isArray(input)) {
    list = input.map(item => String(item || ''));
  } else if (typeof input === 'string') {
    list = input.split(/[\r\n,;]+/);
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const set = new Set<string>();
  for (const item of list) {
    const trimmed = item.trim().toLowerCase();
    if (trimmed && emailRegex.test(trimmed)) {
      set.add(trimmed);
    }
  }
  return Array.from(set);
}

export async function GET(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    const authUser = authResult.authenticated && authResult.user ? authResult.user : null;

    const { searchParams } = new URL(req.url);
    const queryEmail = (searchParams.get('email') || searchParams.get('userEmail') || '').toLowerCase().trim();
    const queryRole = (searchParams.get('role') || '').toUpperCase().replace(/^ROLE_/, '');

    const effectiveEmail = (authUser?.email || queryEmail || '').toLowerCase().trim();
    const effectiveRole = (authUser?.role || queryRole || '').toUpperCase().replace(/^ROLE_/, '');
    const isAdmin = effectiveRole === 'ADMIN' || effectiveEmail === 'harikishorereddy9908@gmail.com' || effectiveEmail.includes('admin@');

    const filter: Record<string, unknown> = {};
    if (!isAdmin && effectiveEmail) {
      filter.$or = [
        { mentorEmail: effectiveEmail },
        { createdBy: effectiveEmail },
      ];
    }

    let batches: StoredBatch[] = [];
    try {
      const batchesCol = await getCollection<StoredBatch>('batches');
      batches = await batchesCol.find(filter).sort({ createdAt: -1 }).toArray();
    } catch (dbErr) {
      console.warn('MongoDB get batches note:', (dbErr as Error)?.message);
    }

    if (!batches || batches.length === 0) {
      const backups = getAllBackupBatches();
      batches = isAdmin
        ? backups
        : backups.filter(b => !b.mentorEmail || b.mentorEmail === effectiveEmail || b.createdBy === effectiveEmail);
    }

    return NextResponse.json({ success: true, batches });
  } catch (error) {
    console.error('Error in GET /api/batches:', error);
    return NextResponse.json({ error: 'Failed to retrieve batches' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    const authUser = authResult.authenticated && authResult.user ? authResult.user : null;

    const body = await req.json();
    const { name, topic, description, studentEmails } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Batch name is required' }, { status: 400 });
    }

    const cleanedEmails = cleanEmails(studentEmails);
    const now = Date.now();
    const creatorEmail = (body.mentorEmail || authUser?.email || '').toLowerCase().trim() || 'harikishorereddy9908@gmail.com';
    const batchId = body.id || `batch-${now}-${Math.random().toString(36).substring(2, 7)}`;

    const newBatch: StoredBatch = {
      id: batchId,
      name: name.trim(),
      topic: (topic || '').trim(),
      description: (description || '').trim(),
      studentEmails: cleanedEmails,
      mentorEmail: creatorEmail,
      createdBy: creatorEmail,
      createdAt: now,
      updatedAt: now,
    };

    saveBackupBatch(newBatch);

    try {
      const batchesCol = await getCollection<StoredBatch>('batches');
      await batchesCol.updateOne(
        { id: batchId },
        { $set: newBatch },
        { upsert: true }
      );
    } catch (dbErr) {
      console.warn('MongoDB save batch note:', (dbErr as Error)?.message);
    }

    return NextResponse.json({ success: true, batch: newBatch });
  } catch (error) {
    console.error('Error in POST /api/batches:', error);
    return NextResponse.json({ error: 'Failed to create batch' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, topic, description, studentEmails } = body;

    if (!id) {
      return NextResponse.json({ error: 'Batch ID is required' }, { status: 400 });
    }

    const existing = getBackupBatch(id);
    const cleanedEmails = studentEmails !== undefined ? cleanEmails(studentEmails) : (existing?.studentEmails || []);

    const updatedBatch: StoredBatch = {
      ...(existing || {}),
      id,
      name: name ? name.trim() : (existing?.name || 'Untitled Batch'),
      topic: topic !== undefined ? topic.trim() : existing?.topic,
      description: description !== undefined ? description.trim() : existing?.description,
      studentEmails: cleanedEmails,
      updatedAt: Date.now(),
      createdAt: existing?.createdAt || Date.now(),
    };

    saveBackupBatch(updatedBatch);

    try {
      const batchesCol = await getCollection<StoredBatch>('batches');
      await batchesCol.updateOne(
        { id },
        { $set: updatedBatch },
        { upsert: true }
      );
    } catch (dbErr) {
      console.warn('MongoDB update batch note:', (dbErr as Error)?.message);
    }

    return NextResponse.json({ success: true, batch: updatedBatch });
  } catch (error) {
    console.error('Error in PUT /api/batches:', error);
    return NextResponse.json({ error: 'Failed to update batch' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Batch ID is required' }, { status: 400 });
    }

    deleteBackupBatch(id);

    try {
      const batchesCol = await getCollection<StoredBatch>('batches');
      await batchesCol.deleteOne({ id });
    } catch (dbErr) {
      console.warn('MongoDB delete batch note:', (dbErr as Error)?.message);
    }

    return NextResponse.json({ success: true, message: 'Batch deleted' });
  } catch (error) {
    console.error('Error in DELETE /api/batches:', error);
    return NextResponse.json({ error: 'Failed to delete batch' }, { status: 500 });
  }
}
