import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma'; // Use named import for prisma client

export async function GET() {
  try {
    const authResult = await auth(); // Await the auth() promise
    const userId = authResult.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        points: true,
        lastHourlyClaim: true,
        lastDailyClaim: true,
      },
    });

    if (!user) {
      // This case should ideally not happen if the user is authenticated
      // but handle it defensively.
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return the relevant mission status data
    return NextResponse.json({
      points: user.points,
      lastHourlyClaim: user.lastHourlyClaim?.toISOString() ?? null,
      lastDailyClaim: user.lastDailyClaim?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('Error fetching mission status:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}