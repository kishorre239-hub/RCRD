import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { getFileMetadata } from '@/lib/server/drive';
import { Video } from '@/lib/server/types';
import { ObjectId } from 'mongodb';

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
      // Continue to Google Drive check
    }

    const driveFileId = video?.driveFileId || id;

    // Resolve the actual Google Drive CDN thumbnail URL
    let cdnThumbnailUrl = (video as any)?.directThumbnailUrl || '';
    if (!cdnThumbnailUrl && video?.thumbnailLink && !video.thumbnailLink.startsWith('/api/videos/')) {
      cdnThumbnailUrl = video.thumbnailLink;
    }

    if (!cdnThumbnailUrl && driveFileId && !driveFileId.startsWith('local:')) {
      const driveMeta = await getFileMetadata(driveFileId);
      if (driveMeta && driveMeta.thumbnailUrl) {
        cdnThumbnailUrl = driveMeta.thumbnailUrl;
      }
    }

    if (!cdnThumbnailUrl) {
      return NextResponse.json({ error: 'Thumbnail not available' }, { status: 404 });
    }

    // Fetch from Google Drive CDN without Referer to bypass Google's 429/403 referer check
    const imgRes = await fetch(cdnThumbnailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });

    if (!imgRes.ok) {
      // Fallback with lower resolution if s640 is throttled
      const fallbackUrl = cdnThumbnailUrl.replace(/=s\d+/, '=s320');
      const fallbackRes = await fetch(fallbackUrl);
      if (fallbackRes.ok && fallbackRes.body) {
        return new Response(fallbackRes.body, {
          status: 200,
          headers: {
            'Content-Type': fallbackRes.headers.get('content-type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          },
        });
      }
      return NextResponse.json({ error: 'Failed to fetch thumbnail image' }, { status: 502 });
    }

    return new Response(imgRes.body, {
      status: 200,
      headers: {
        'Content-Type': imgRes.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error: any) {
    console.error('Error proxying thumbnail:', error?.message || error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
