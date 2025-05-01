import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { prisma } from '@/prisma';
import { Prisma } from '@prisma/client'; // Import Prisma namespace for TransactionClient type

// Schema for validating the POST request body
const createTeamSchema = z.object({
  name: z.string().min(3, 'Team name must be at least 3 characters long').max(30, 'Team name must be 30 characters or less'),
  invitedUsernames: z.array(z.string().min(1)).max(5, 'You can invite up to 5 users').optional().default([]), // Added invitedUsernames
});

// POST /api/teams - Create a new team and send invitations
export async function POST(request: Request) {
  try {
    const authResult = await auth(); // Await the auth() call
    const userId = authResult?.userId; // Get userId from the result
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const json = await request.json();
    const parsed = createTeamSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.errors }, { status: 400 });
    }

    const { name, invitedUsernames } = parsed.data; // Destructure invitedUsernames

    // Check if user is already in a team or leads one
    const existingUserTeam = await prisma.user.findUnique({
      where: { id: userId },
      select: { ledTeam: true, membership: true },
    });

    if (existingUserTeam?.ledTeam || existingUserTeam?.membership) {
      return NextResponse.json({ error: 'User is already part of a team' }, { status: 400 });
    }

    // Check if team name already exists
    const existingTeamName = await prisma.team.findUnique({
        where: { name },
        select: { id: true },
    });

    if (existingTeamName) {
        return NextResponse.json({ error: 'Team name already taken' }, { status: 400 });
    }

    // Create team, initial member (leader), and invitations in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the Team
      const team = await tx.team.create({
        data: {
          name,
          leaderId: userId,
          // Initialize whitelist as empty array
          whitelist: JSON.stringify([]),
        },
      });

      // 2. Create the TeamMember record for the leader
      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: userId,
        },
      });

      // 3. Process Invitations
      // Explicitly type invitationResults arrays
      const invitationResults: { successful: string[]; failed: string[] } = { successful: [], failed: [] };
      if (invitedUsernames && invitedUsernames.length > 0) {
        for (const username of invitedUsernames) {
          const invitedUser = await tx.user.findUnique({
            where: { username },
            select: { id: true },
          });

          // Skip if user not found or if it's the leader inviting themselves
          if (!invitedUser || invitedUser.id === userId) {
            if (!invitedUser) invitationResults.failed.push(username); // Record failed username
            continue;
          }

          // Check if an invitation already exists (optional, prevents duplicates if needed)
          const existingInvitation = await tx.teamInvitation.findUnique({
            where: {
              teamId_invitedUserId: { // Correct composite key name
                teamId: team.id,
                invitedUserId: invitedUser.id, // Correct field name
              },
            },
          });

          if (!existingInvitation) {
            await tx.teamInvitation.create({
              data: {
                teamId: team.id,
                invitedUserId: invitedUser.id, // Correct field name
              },
            });
            invitationResults.successful.push(username); // Record successful username
          } else {
             // Optionally handle case where invitation already exists (e.g., add to failed/skipped)
             // invitationResults.failed.push(username); // Example: treat existing as failed/skipped
          }
        }
      }

      return { team, invitationResults }; // Return both team and invitation results
    });

    // Return the created team data (and optionally invitation results)
    // You might want to adjust the response structure based on frontend needs
    return NextResponse.json(result.team, { status: 201 }); // Returning only team for now

  } catch (error) {
    console.error("Error creating team:", error);
    // Distinguish between known errors (like unique constraint) and unexpected errors
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    // Add check for Prisma unique constraint violation if needed, though explicit check is better
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


// GET /api/teams - Get a list of teams with pagination
export async function GET(request: Request) {
    try {
        const authResult = await auth(); // Await the auth() call
        const userId = authResult?.userId; // Get userId from the result
        if (!userId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit');
        const cursor = searchParams.get('cursor');

        const limit = limitParam ? parseInt(limitParam, 10) : 10; // Default limit: 10

        if (isNaN(limit) || limit <= 0) {
            return NextResponse.json({ error: 'Invalid limit parameter' }, { status: 400 });
        }

        const teams = await prisma.team.findMany({
            take: limit + 1, // Fetch one extra to determine if there's a next page
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: {
                createdAt: 'desc', // Or order by name, etc.
            },
            // Select scalar fields directly
            select: {
                id: true,
                name: true,
                leaderId: true, // Include leaderId scalar
                whitelist: true,
                createdAt: true,
                updatedAt: true,
                // Include relations and count via 'include' nested within 'select'
                leader: {
                    select: { id: true, username: true, img: true, displayName: true },
                },
                members: {
                    include: {
                        user: {
                            select: { id: true, username: true, img: true, displayName: true },
                        },
                    },
                    orderBy: {
                        createdAt: 'asc',
                    }
                },
                _count: { // Include member count
                    select: { members: true }
                }
            },
        });

        let nextCursor: string | null = null;
        if (teams.length > limit) {
            const nextItem = teams.pop();
            nextCursor = nextItem!.id; // Use its ID as the next cursor
        }

        return NextResponse.json({ teams, nextCursor });

    } catch (error) {
        console.error("Error fetching teams:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}