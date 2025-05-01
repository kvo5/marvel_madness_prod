import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma';
import { addDays, isBefore, startOfDay } from 'date-fns'; // Using date-fns for time comparison

// Constants for daily claim
const DAILY_COOLDOWN_DAYS = 1; // Cooldown is 1 full day
const DAILY_POINTS_REWARD = 50; // Corrected reward to 50 points

export async function POST() {
  try {
    const authResult = await auth();
    const userId = authResult.userId;

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date(); // Use UTC by default
    const todayStart = startOfDay(now); // Get the beginning of the current day in UTC

    // Fetch user's last daily claim timestamp
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        points: true,
        lastDailyClaim: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const lastClaim = user.lastDailyClaim;
    // Cooldown ends at the start of the next day after the last claim
    const cooldownEndTime = lastClaim ? startOfDay(addDays(lastClaim, DAILY_COOLDOWN_DAYS)) : null;

    // Check eligibility: No previous claim OR the start of today is at or after the cooldown end time
    const isEligible = !cooldownEndTime || !isBefore(todayStart, cooldownEndTime);

    if (!isEligible) {
      return NextResponse.json(
        { success: false, message: 'Daily claim cooldown active. Try again tomorrow.' },
        { status: 429 } // Use 429 Too Many Requests
      );
    }

    // Eligible: Perform the claim within a transaction
    const updatedUser = await prisma.$transaction(async (tx) => {
       // 1. Update the last claim time
       const updated = await tx.user.update({
        where: { id: userId },
        data: {
          lastDailyClaim: now, // Record the exact time of claim
        },
        select: { lastDailyClaim: true } // Select only needed field
      });

      // 2. Increment points
      const finalUser = await tx.user.update({
          where: { id: userId },
          data: {
              points: {
                  increment: DAILY_POINTS_REWARD,
              },
          },
          select: { points: true, lastDailyClaim: true } // Select updated points and claim time
      });
      return finalUser;
    });

    return NextResponse.json({
      success: true,
      message: `Successfully claimed ${DAILY_POINTS_REWARD} points!`,
      updatedPoints: updatedUser.points,
      newClaimTimestamp: updatedUser.lastDailyClaim?.toISOString() ?? null, // Ensure ISO string format
    });

  } catch (error) {
    console.error('Error processing daily claim:', error);
    return NextResponse.json(
      { success: false, message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}