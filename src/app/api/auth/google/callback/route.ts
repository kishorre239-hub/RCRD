import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { saveOAuthTokens } from '@/lib/server/drive';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state') || '/library';
  const error = searchParams.get('error');

  const origin = new URL(req.url).origin;
  if (error || !code) {
    return NextResponse.redirect(`${origin}${state}?google_error=${encodeURIComponent(error || 'cancelled')}`);
  }

  try {
    const redirectUri = `${origin}/api/auth/google/callback`;
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    await saveOAuthTokens(tokens);

    return NextResponse.redirect(`${origin}${state}?google_connected=true`);
  } catch (err: any) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(`${origin}${state}?google_error=${encodeURIComponent(err.message || 'token_exchange_failed')}`);
  }
}
