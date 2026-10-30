import { getCollection } from '@/lib/server/db';
import { getFileMetadata } from '@/lib/server/drive';
import { Video } from '@/lib/server/types';
import { ObjectId } from 'mongodb';

function getPlaceholderThumbnail(title?: string) {
  const safeTitle = (title || 'Video Recording').replace(/[<>&"']/g, '').slice(0, 40);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#20262E" />
        <stop offset="50%" stop-color="#0E2F44" />
        <stop offset="100%" stop-color="#20262E" />
      </linearGradient>
    </defs>
    <rect width="640" height="360" fill="url(#bg)" rx="8" />
    <circle cx="320" cy="165" r="40" fill="#154360" fill-opacity="0.25" stroke="#154360" stroke-width="2.5" />
    <polygon points="312,150 336,165 312,180" fill="#154360" />
    <text x="320" y="240" fill="#E2E7EC" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="15" font-weight="600" text-anchor="middle">
      ${safeTitle}
    </text>
  </svg>`;
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return getPlaceholderThumbnail('Recording');
    }

    let video: Video | null = null;
    try {
      const videosCol = await getCollection<Video>('videos');
      let filter: Record<string, unknown> = {};
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
    let cdnThumbnailUrl = (video as unknown as { directThumbnailUrl?: string })?.directThumbnailUrl || '';
    if (!cdnThumbnailUrl && video?.thumbnailLink && !video.thumbnailLink.startsWith('/api/videos/')) {
      cdnThumbnailUrl = video.thumbnailLink;
    }

    if (!cdnThumbnailUrl && driveFileId && !driveFileId.startsWith('local:')) {
      try {
        const driveMeta = await getFileMetadata(driveFileId);
        if (driveMeta && driveMeta.thumbnailUrl) {
          cdnThumbnailUrl = driveMeta.thumbnailUrl;
        }
      } catch {}
    }

    if (!cdnThumbnailUrl) {
      return getPlaceholderThumbnail(video?.title);
    }

    // Fetch from Google Drive CDN without Referer to bypass Google's 429/403 referer check
    try {
      const imgRes = await fetch(cdnThumbnailUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      });

      if (imgRes.ok && imgRes.body) {
        return new Response(imgRes.body, {
          status: 200,
          headers: {
            'Content-Type': imgRes.headers.get('content-type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          },
        });
      }

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
    } catch {}

    return getPlaceholderThumbnail(video?.title);
  } catch {
    return getPlaceholderThumbnail('Recording');
  }
}
