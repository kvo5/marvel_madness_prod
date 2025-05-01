import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma';
import { addHours, isBefore } from 'date-fns'; // Using date-fns for time comparison

// Constants for hourly claim
const HOURLY_COOLDOWN_HOURS = 1;
const HOURLY_POINTS_REWARD = 5; // Adjusted reward as per implicit request (was 10 for daily)

export async function POST() {
  try {
    const authResult = await auth();
    const userId = authResult.userId;

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date(); // Use UTC by default with Date object

    // Fetch user's last hourly claim timestamp
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        points: true,
        lastHourlyClaim: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const lastClaim = user.lastHourlyClaim;
    const cooldownEndTime = lastClaim ? addHours(lastClaim, HOURLY_COOLDOWN_HOURS) : null;

    // Check eligibility: No previous claim OR current time is after cooldown end time
    const isEligible = !cooldownEndTime || isBefore(cooldownEndTime, now);

    if (!isEligible) {
      return NextResponse.json(
        { success: false, message: 'Hourly claim cooldown active.' },
        { status: 429 } // Use 429 Too Many Requests for rate limiting/cooldown
      );
    }

    // Eligible: Perform the claim within a transaction
    const updatedUser = await prisma.$transaction(async (tx) => {
      // 1. Update the last claim time
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          lastHourlyClaim: now,
        },
        select: { lastHourlyClaim: true } // Select only needed field
      });

      // 2. Increment points
      const finalUser = await tx.user.update({
          where: { id: userId },
          data: {
              points: {
                  increment: HOURLY_POINTS_REWARD,
              },
          },
          select: { points: true, lastHourlyClaim: true } // Select updated points and claim time
      });
      return finalUser;
    });


    return NextResponse.json({
      success: true,
      message: `Successfully claimed ${HOURLY_POINTS_REWARD} points!`,
      updatedPoints: updatedUser.points,
      newClaimTimestamp: updatedUser.lastHourlyClaim?.toISOString() ?? null, // Ensure ISO string format
    });

  } catch (error) {
    console.error('Error processing hourly claim:', error);
    return NextResponse.json(
      { success: false, message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}