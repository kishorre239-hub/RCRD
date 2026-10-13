import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { Video } from '@/lib/server/types';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const videosCol = await getCollection<Video>('videos');
    const video = await videosCol.findOne({
      shareToken: token,
      isPublic: true,
    });

    if (!video) {
      return NextResponse.json({ error: 'Shared video not found' }, { status: 404 });
    }

    if (video.driveFileId) {
      const streamUrl = `https://drive.google.com/uc?id=${video.driveFileId}&export=download`;
      return NextResponse.redirect(streamUrl, 307);
    }

    if (video.webViewLink) {
      return NextResponse.redirect(video.webViewLink, 307);
    }

    return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
  } catch (error: any) {
    console.error('Error streaming shared video:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
