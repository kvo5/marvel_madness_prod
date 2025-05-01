import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { prisma } from '@/prisma';

// Schema for validating the PUT request body
const updateWhitelistSchema = z.object({
  // Expect an array of strings (usernames)
  whitelist: z.array(z.string().min(1, 'Username cannot be empty')),
});

// PUT /api/teams/[teamId]/whitelist - Update a team's whitelist
export async function PUT(
    request: Request,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: any
) {
    try {
        const authResult = await auth();
        const userId = authResult?.userId;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const teamId = context.params.teamId;
        if (!teamId) {
            return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
        }

        // Validate request body
        const json = await request.json();
        const parsed = updateWhitelistSchema.safeParse(json);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsed.error.errors }, { status: 400 });
        }

        const { whitelist } = parsed.data;

        // Fetch the team to check ownership
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { leaderId: true }, // Only need leaderId for the check
        });

        if (!team) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        // Check if the authenticated user is the leader
        if (team.leaderId !== userId) {
            return NextResponse.json({ error: 'Forbidden: Only the team leader can update the whitelist' }, { status: 403 });
        }

        // Update the team's whitelist
        // Prisma expects JSON fields to be updated with strings or Prisma.JsonNull
        const updatedTeam = await prisma.team.update({
            where: { id: teamId },
            data: {
                whitelist: JSON.stringify(whitelist), // Store the array as a JSON string
            },
            // Optionally select fields to return
            // select: { id: true, name: true, whitelist: true }
        });

        // Return success or the updated team data
        return NextResponse.json({ message: 'Whitelist updated successfully', team: updatedTeam });

    } catch (error) {
        // Use params.teamId here as teamId from try block is not in scope
        console.error(`Error updating whitelist for team ${context.params.teamId}:`, error);
         if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
        }
        // Handle potential Prisma errors (e.g., team not found if deleted concurrently)
        if (error instanceof Error && 'code' in error && error.code === 'P2025') {
             return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}