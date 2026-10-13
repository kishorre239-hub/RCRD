import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { Video } from '@/lib/server/types';

export async function GET(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const user = authResult.user;
    const workspaceId = user.workspaceId || 'default';

    const videosCol = await getCollection<Video>('videos');
    const videos = await videosCol
      .find({
        workspaceId,
        isCompanyShared: true,
      })
      .sort({ createdAt: -1 })
      .toArray();

    const normalized = videos.map((v) => ({
      ...v,
      id: v.id || v._id?.toString(),
    }));

    return NextResponse.json(normalized);
  } catch (error: any) {
    console.error('Error fetching company videos:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
