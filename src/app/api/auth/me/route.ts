import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/auth';

export async function GET(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      );
    }

    const user = { ...authResult.user };
    delete user.passwordHash;

    return NextResponse.json(user);
  } catch (error: any) {
    console.error('Error fetching current user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
