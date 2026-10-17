import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/password';
import { generateToken } from '@/lib/server/auth';
import { User } from '@/lib/server/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, role = 'USER' } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 3) {
      return NextResponse.json(
        { error: 'Password must be at least 3 characters long' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanRole = (role || 'USER').toUpperCase();

    try {
      const usersCol = await getCollection<User>('users');
      const existing = await usersCol.findOne({ email: cleanEmail });
      if (existing) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        );
      }

      const passwordHash = await hashPassword(password);
      const newUser: User = {
        name: cleanName,
        email: cleanEmail,
        passwordHash,
        role: cleanRole,
        plan: 'pro',
        status: 'Active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = await usersCol.insertOne(newUser);
      const userId = result.insertedId.toString();

      const token = generateToken({
        id: userId,
        email: cleanEmail,
        role: cleanRole,
        name: cleanName,
      });

      return NextResponse.json({
        token,
        id: userId,
        name: cleanName,
        email: cleanEmail,
        role: cleanRole,
      });
    } catch (dbErr: unknown) {
      console.warn('MongoDB unavailable during registration, creating local session:', (dbErr as Error)?.message);
      
      const fallbackId = `user-${Date.now()}`;
      const token = generateToken({
        id: fallbackId,
        email: cleanEmail,
        role: cleanRole,
        name: cleanName,
      });

      return NextResponse.json({
        token,
        id: fallbackId,
        name: cleanName,
        email: cleanEmail,
        role: cleanRole,
      });
    }
  } catch (error: unknown) {
    console.error('Registration error:', (error as Error)?.message || error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
