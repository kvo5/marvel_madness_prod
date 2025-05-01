import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/prisma';
import { Prisma } from '@prisma/client'; // Import Prisma for transaction type

const MAX_TEAM_MEMBERS = 6;

// POST /api/teams/[teamId]/join - Join a team via invitation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function POST(request: NextRequest, context: any) { // Changed PUT to POST
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = context.params;

    if (!teamId || typeof teamId !== 'string') {
        return NextResponse.json({ error: 'Invalid Team ID' }, { status: 400 });
    }

    try {
        // --- Pre-transaction checks ---
        // 1. Check if team exists and get member count
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: { _count: { select: { members: true } } },
        });

        if (!team) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        // 2. Check if user is already in any team (using findFirst for broader compatibility)
        const existingMembership = await prisma.teamMember.findFirst({
            where: { userId: userId }, // findFirst accepts userId directly
        });

        if (existingMembership) {
            if (existingMembership.teamId === teamId) {
                 return NextResponse.json({ error: 'User already in this team' }, { status: 400 });
            } else {
                 return NextResponse.json({ error: 'User already in another team' }, { status: 400 });
            }
        }

        // 3. Check if team is full
        if (team._count.members >= MAX_TEAM_MEMBERS) {
            return NextResponse.json({ error: 'Team is full' }, { status: 400 });
        }

        // --- Transactional Logic ---
        const result = await prisma.$transaction(async (tx) => {
            // 4. Check for a PENDING invitation specifically for this user and team
            // Use the compound unique key defined in the schema: @@unique([teamId, invitedUserId])
            const invitation = await tx.teamInvitation.findUnique({
                where: {
                    teamId_invitedUserId: { // Corrected identifier
                        teamId: teamId,
                        invitedUserId: userId,
                    }
                },
            });

            // If no invitation or invitation is not PENDING, reject
            if (!invitation || invitation.status !== 'PENDING') {
                // Throw an error to abort the transaction
                throw new Error('No pending invitation found or invitation already used.');
            }

            // 5. Add user to the team by creating a TeamMember record
            const newMembership = await tx.teamMember.create({
                data: {
                    userId: userId,
                    teamId: teamId,
                },
            });

            // 6. Update the invitation status to ACCEPTED
            await tx.teamInvitation.update({
                where: {
                    // Use the compound unique key defined in the schema
                    teamId_invitedUserId: { // Corrected identifier
                        teamId: teamId,
                        invitedUserId: userId,
                    }
                    // Alternatively, could use the primary key: id: invitation.id
                },
                data: {
                    status: 'ACCEPTED',
                },
            });

            return newMembership; // Return the result from the transaction
        });

        // Return confirmation including the new membership details
        return NextResponse.json({ message: 'Successfully joined team via invitation', membership: result });

    } catch (error) {
        console.error('Error joining team:', error);
        // Handle specific transaction error for missing/invalid invitation
        if (error instanceof Error && error.message.includes('No pending invitation found')) {
             return NextResponse.json({ error: 'No pending invitation found for this team.' }, { status: 403 }); // Forbidden
        }
        // Handle potential Prisma errors or other exceptions
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            // Log specific Prisma error code
            console.error('Prisma Error Code:', error.code);
        }
        // General error
        return NextResponse.json({ error: 'Failed to join team due to server error' }, { status: 500 });
    }
}