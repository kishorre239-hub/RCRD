import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { getDriveFileStream } from '@/lib/server/drive';
import { Video } from '@/lib/server/types';
import { ObjectId } from 'mongodb';
import { Readable } from 'stream';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
    }

    let video: Video | null = null;
    try {
      const videosCol = await getCollection<Video>('videos');
      let filter: any = {};
      try {
        filter = { $or: [{ _id: new ObjectId(id) }, { id }, { driveFileId: id }] };
      } catch {
        filter = { $or: [{ id }, { driveFileId: id }] };
      }
      video = await videosCol.findOne(filter);
    } catch {
      // If DB lookup fails, continue with Drive lookup
    }

    // Determine target Google Drive file ID
    const driveFileId = video?.driveFileId || (video ? null : id);

    if (driveFileId && !driveFileId.startsWith('local:')) {
      const rangeHeader = req.headers.get('range');
      const streamResult = await getDriveFileStream(driveFileId, rangeHeader);

      if (streamResult && streamResult.stream) {
        const responseHeaders: Record<string, string> = {
          'Content-Type': (streamResult.headers?.['content-type'] as string) || 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=7200',
        };

        if (streamResult.headers?.['content-range']) {
          responseHeaders['Content-Range'] = streamResult.headers['content-range'] as string;
        }
        if (streamResult.headers?.['content-length']) {
          responseHeaders['Content-Length'] = streamResult.headers['content-length'] as string;
        }

        const webStream = Readable.toWeb(streamResult.stream as any);
        return new Response(webStream as any, {
          status: streamResult.status || 200,
          headers: responseHeaders,
        });
      }

      // If direct stream API couldn't be loaded, fallback to webViewLink
      if (video?.webViewLink) {
        return NextResponse.redirect(video.webViewLink, 307);
      }
    }

    if (video?.webViewLink) {
      return NextResponse.redirect(video.webViewLink, 307);
    }

    return NextResponse.json({ error: 'No media stream available for this video' }, { status: 404 });
  } catch (error: any) {
    console.error('Error streaming video:', error?.message || error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
