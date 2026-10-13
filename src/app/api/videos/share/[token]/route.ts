import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { Video } from '@/lib/server/types';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const videosCol = await getCollection<Video>('videos');
    const video = await videosCol.findOne({
      shareToken: token,
      isPublic: true,
    });

    if (!video) {
      return NextResponse.json({ error: 'Shared video not found or private' }, { status: 404 });
    }

    return NextResponse.json({
      id: video.id || video._id?.toString(),
      title: video.title,
      duration: video.duration,
      size: video.size,
      status: video.status,
      webViewLink: video.webViewLink,
      thumbnailLink: video.thumbnailLink,
      comments: video.comments || [],
      createdAt: video.createdAt,
    });
  } catch (error: any) {
    console.error('Error fetching shared video:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
