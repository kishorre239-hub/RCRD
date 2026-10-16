import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const redirectTarget = searchParams.get('redirect') || '/library';

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/auth/google/callback`;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    state: redirectTarget,
  });

  return NextResponse.redirect(authUrl);
}
