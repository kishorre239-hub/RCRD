import { NextResponse } from 'next/server';
import { getOAuthTokens } from '@/lib/server/drive';

export async function GET() {
  const tokens = await getOAuthTokens();
  return NextResponse.json({
    connected: Boolean(tokens && (tokens.access_token || tokens.refresh_token)),
    hasRefreshToken: Boolean(tokens?.refresh_token),
  });
}
