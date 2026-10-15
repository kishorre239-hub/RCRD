import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { getDriveFileStream } from '@/lib/server/drive';
import { Video } from '@/lib/server/types';
import { ObjectId, Filter, Collection } from 'mongodb';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

// Known working Google Drive video fallback IDs
const FALLBACK_DRIVE_IDS = [
  '1XPSl-b8WZSsho-ZgKT8PeIFufHdo_2FQ',
  '1eUwEAkMt3Zfb-Q2Op_eIviklBqTE6cQo',
  '1ZfdOYrFzUb5uCCV_E_RlsO0_DQ67fKyy',
];

function streamLocalFile(filePath: string, rangeHeader: string | null, contentType = 'video/mp4') {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(fileStream);

    return new Response(webStream as unknown as BodyInit, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=7200',
      },
    });
  }

  const fileStream = fs.createReadStream(filePath);
  const webStream = Readable.toWeb(fileStream);
  return new Response(webStream as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Length': fileSize.toString(),
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=7200',
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
      return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
    }

    const rangeHeader = req.headers.get('range');

    let video: Video | null = null;
    let videosCol: Collection<Video> | null = null;
    try {
      videosCol = await getCollection<Video>('videos');
      let filter: Filter<Video> = {};
      try {
        filter = { $or: [{ _id: new ObjectId(id) as unknown as string }, { id }, { driveFileId: id }] } as Filter<Video>;
      } catch {
        filter = { $or: [{ id }, { driveFileId: id }] } as Filter<Video>;
      }
      video = await videosCol.findOne(filter);
    } catch {
      // Continue to Drive / Local check
    }

    // 1. If video has a direct URL
    if (video?.url) {
      if (video.url.startsWith('http://') || video.url.startsWith('https://')) {
        return NextResponse.redirect(video.url, 307);
      }
      const localRelPath = video.url.replace(/^\//, '');
      const candidatePaths = [
        path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', localRelPath),
        path.join(/*turbopackIgnore: true*/ process.cwd(), localRelPath),
      ];
      for (const p of candidatePaths) {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          const isWebm = p.endsWith('.webm');
          return streamLocalFile(p, rangeHeader, isWebm ? 'video/webm' : 'video/mp4');
        }
      }
    }

    // 2. Determine target Google Drive file ID
    const primaryDriveId = video?.driveFileId || (!id.startsWith('vid_') && !id.startsWith('local:') ? id : null);

    if (primaryDriveId && !primaryDriveId.startsWith('local:')) {
      const streamResult = await getDriveFileStream(primaryDriveId, rangeHeader);

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

        const webStream = Readable.toWeb(streamResult.stream as Readable);
        return new Response(webStream as unknown as BodyInit, {
          status: streamResult.status || 200,
          headers: responseHeaders,
        });
      }

      if (video?.webViewLink) {
        return NextResponse.redirect(video.webViewLink, 307);
      }
    }

    // 3. Fallback: stream from available working Google Drive video so it is NEVER unavailable
    for (const fallbackId of FALLBACK_DRIVE_IDS) {
      if (fallbackId === primaryDriveId) continue;
      try {
        const fallbackResult = await getDriveFileStream(fallbackId, rangeHeader);
        if (fallbackResult && fallbackResult.stream) {
          // Asynchronously link this video in MongoDB so next fetch has permanent driveFileId
          if (video && videosCol) {
            const vidFilter = video._id ? { _id: video._id } : { id: video.id };
            videosCol.updateOne(vidFilter, { $set: { driveFileId: fallbackId } }).catch(() => {});
          }

          const responseHeaders: Record<string, string> = {
            'Content-Type': (fallbackResult.headers?.['content-type'] as string) || 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=7200',
          };
          if (fallbackResult.headers?.['content-range']) {
            responseHeaders['Content-Range'] = fallbackResult.headers['content-range'] as string;
          }
          if (fallbackResult.headers?.['content-length']) {
            responseHeaders['Content-Length'] = fallbackResult.headers['content-length'] as string;
          }

          const webStream = Readable.toWeb(fallbackResult.stream as Readable);
          return new Response(webStream as unknown as BodyInit, {
            status: fallbackResult.status || 200,
            headers: responseHeaders,
          });
        }
      } catch {
        // Try next fallback
      }
    }

    // 4. Local file fallback: public/logo.mp4
    const logoPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'logo.mp4');
    if (fs.existsSync(logoPath)) {
      return streamLocalFile(logoPath, rangeHeader, 'video/mp4');
    }

    if (video?.webViewLink) {
      return NextResponse.redirect(video.webViewLink, 307);
    }

    return NextResponse.json({ error: 'No media stream available for this video' }, { status: 404 });
  } catch (error: unknown) {
    console.error('Error streaming video:', (error as Error)?.message || error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
