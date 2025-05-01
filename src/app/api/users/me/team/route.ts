import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma';

// GET /api/users/me/team - Get the current user's team status and details
export async function GET(request: Request) {
    try {
        const authResult = await auth();
        const userId = authResult?.userId;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch user with their potential team leadership, membership, and invitations
        const userWithTeam = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                // Select the team the user leads (if any)
                ledTeam: {
                    include: { // Include necessary details for the team object
                        leader: { select: { id: true, username: true, img: true, displayName: true } },
                        members: {
                            include: { user: { select: { id: true, username: true, img: true, displayName: true } } },
                            orderBy: { createdAt: 'asc' }
                        },
                        _count: { select: { members: true } } // Include member count if needed
                    },
                },
                // Select the user's membership record (if any)
                membership: {
                    select: {
                        // Include the actual team details through the membership relation
                        team: {
                            include: {
                                leader: { select: { id: true, username: true, img: true, displayName: true } },
                                members: {
                                    include: { user: { select: { id: true, username: true, img: true, displayName: true } } },
                                    orderBy: { createdAt: 'asc' }
                                },
                                _count: { select: { members: true } } // Include member count if needed
                            },
                        },
                    },
                },
                // Select the user's pending invitations
                invitations: {
                    where: { status: 'PENDING' }, // Filter for only PENDING invitations
                    select: {
                        id: true,       // Select invitation ID
                        teamId: true,   // Select the ID of the team the invitation is for
                        // Add other fields from TeamInvitation if needed by the frontend later
                    },
                },
            },
        });

        if (!userWithTeam) {
            // This case should ideally not happen if the user is authenticated
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Determine the team to return: the one they lead or the one they are a member of
        // Access the team through membership.team if it exists
        const team = userWithTeam.ledTeam ?? userWithTeam.membership?.team ?? null;
        const isLeader = !!userWithTeam.ledTeam; // User is leader if ledTeam is not null

        // Construct the response object expected by the frontend
        const responsePayload = {
            team: team,
            isLeader: isLeader,
            // Use the correctly fetched 'invitations' field
            pendingInvitations: userWithTeam.invitations ?? [],
        };

        // Return the team details, leadership status, and pending invitations
        return NextResponse.json(responsePayload);

    } catch (error) {
        console.error("Error fetching user's team:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}