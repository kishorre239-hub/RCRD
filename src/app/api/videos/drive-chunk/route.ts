import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { Video } from '@/lib/server/types';
import { ObjectId } from 'mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: Request) {
  try {
    const uploadUrl = req.headers.get('x-upload-url') || '';
    const contentRange = req.headers.get('x-content-range') || req.headers.get('content-range') || '';
    const videoId = req.headers.get('x-video-id') || '';
    const mimeType = req.headers.get('content-type') || 'video/webm';

    if (!uploadUrl || !uploadUrl.startsWith('https://www.googleapis.com')) {
      return NextResponse.json({ error: 'Valid Google Drive upload URL is required' }, { status: 400 });
    }

    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Stream chunk server-to-server to Google Drive (Zero browser CORS!)
    const driveHeaders: Record<string, string> = {
      'Content-Length': buffer.length.toString(),
      'Content-Type': mimeType,
    };
    if (contentRange) {
      driveHeaders['Content-Range'] = contentRange;
    }

    const driveRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: driveHeaders,
      body: buffer,
    });

    // 308 Resume Incomplete indicates chunk was received and Drive is waiting for more
    if (driveRes.status === 308) {
      return NextResponse.json({
        status: 308,
        range: driveRes.headers.get('range'),
      });
    }

    // 200/201 indicates upload is completely finished!
    if (driveRes.ok) {
      let driveData: Record<string, unknown> = {};
      try {
        driveData = await driveRes.json();
      } catch {}

      const driveFileId = String(driveData.id || '');

      if (videoId) {
        try {
          const videosCol = await getCollection<Video>('videos');
          let filter: Record<string, unknown> = {};
          try {
            filter = { _id: new ObjectId(videoId) };
          } catch {
            filter = { id: videoId };
          }

          await videosCol.updateOne(filter, {
            $set: {
              driveFileId: driveFileId || undefined,
              status: 'READY',
              webViewLink: (driveData.webViewLink as string) || (driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : undefined),
              updatedAt: Date.now(),
            },
          });
        } catch (dbErr) {
          console.error('Error updating video status in MongoDB:', dbErr);
        }
      }

      return NextResponse.json({
        status: 200,
        driveFileId,
        driveData,
      });
    }

    const errText = await driveRes.text();
    console.error(`Google Drive chunk error ${driveRes.status}:`, errText);
    return NextResponse.json({ error: 'Drive upload error', details: errText }, { status: driveRes.status });
  } catch (error: unknown) {
    console.error('Error in drive-chunk proxy:', (error as Error)?.message || error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
