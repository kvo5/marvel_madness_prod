import { NextResponse, NextRequest } from 'next/server'; // Added NextRequest
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma';
import { Prisma } from '@prisma/client'; // Import Prisma namespace

// DELETE /api/teams/[teamId] - Delete a team
export async function DELETE(
    request: NextRequest, // Corrected back to NextRequest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: any
) {
    try {
        const authResult = await auth();
        const userId = authResult?.userId;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { teamId } = context.params; // Changed params to context.params

        if (!teamId) {
            return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
        }

        // Find the team first to check ownership
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { leaderId: true }, // Only need leaderId for the check
        });

        if (!team) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        // Check if the authenticated user is the leader
        if (team.leaderId !== userId) {
            return NextResponse.json({ error: 'Forbidden: Only the team leader can delete the team' }, { status: 403 });
        }

        // Delete the team (related TeamMember records should cascade delete due to schema definition)
        await prisma.team.delete({
            where: { id: teamId },
        });

        return new NextResponse(null, { status: 204 }); // No Content

    } catch (error) {
        console.error(`Error deleting team ${context.params.teamId}:`, error); // Changed params.teamId to context.params.teamId
        // Handle potential Prisma errors, e.g., record not found if deleted between check and delete
        if (error instanceof Error && 'code' in error && error.code === 'P2025') {
             return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
// PUT /api/teams/[teamId] - Update a team (e.g., name)
export async function PUT(
    request: NextRequest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: any
) {
    try {
        const authResult = await auth();
        const userId = authResult?.userId;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { teamId } = context.params;
        if (!teamId) {
            return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
        }

        // Parse request body
        let body;
        try {
            body = await request.json();
        } catch (e) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { name, invitedUsernames } = body;

        // --- Input Validation ---
        // Validate name
        if (typeof name !== 'string' || !name.trim()) {
            return NextResponse.json({ error: 'Team name is required and must be a string' }, { status: 400 });
        }
        const trimmedName = name.trim();
        if (trimmedName.length > 50) {
            return NextResponse.json({ error: 'Team name cannot exceed 50 characters' }, { status: 400 });
        }
        if (trimmedName.length < 3) {
             return NextResponse.json({ error: 'Team name must be at least 3 characters long' }, { status: 400 });
        }

        // Validate invitedUsernames
        if (!Array.isArray(invitedUsernames)) {
            return NextResponse.json({ error: 'invitedUsernames must be an array' }, { status: 400 });
        }
        if (invitedUsernames.length > 5) {
            return NextResponse.json({ error: 'You can invite a maximum of 5 users' }, { status: 400 });
        }
        const validUsernames = invitedUsernames
            .map(u => typeof u === 'string' ? u.trim() : '')
            .filter(u => u.length > 0); // Filter out empty strings after trimming

        if (validUsernames.some(u => typeof u !== 'string' || u.length === 0)) {
             return NextResponse.json({ error: 'All invited usernames must be non-empty strings' }, { status: 400 });
        }
        const uniqueInvitedUsernames = [...new Set(validUsernames)];


        // --- Authorization & Team/User Data Fetching ---
        // Use transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => { // Let TypeScript infer tx type
            // 1. Find the team and verify leader
            const team = await tx.team.findUnique({
                where: { id: teamId },
                select: { leaderId: true }, // Only fetch leaderId for validation
            });

            if (!team) {
                // Throw an error to rollback transaction
                throw new Error('Team not found');
            }

            if (team.leaderId !== userId) {
                // Throw an error to rollback transaction
                throw new Error('Forbidden');
            }

            // Fetch members and pending invitations separately within the transaction
            const members = await tx.teamMember.findMany({
                where: { teamId: teamId },
                select: { userId: true } // Select only the userId
            });

            const pendingInvitations = await tx.teamInvitation.findMany({
                where: { teamId: teamId, status: 'PENDING' },
                select: { id: true, invitedUserId: true } // Select necessary fields
            });

            // 2. Find users for the submitted usernames
            const potentialInvitees = uniqueInvitedUsernames.length > 0 ? await tx.user.findMany({
                where: {
                    username: { in: uniqueInvitedUsernames },
                },
                select: { id: true, username: true },
            }) : [];

            // Map for easy lookup: userId -> username
            const potentialInviteeMap = new Map(potentialInvitees.map(u => [u.id, u.username]));
            // Set of user IDs from the submitted list that correspond to actual users
            const validSubmittedUserIds = new Set(potentialInvitees.map(u => u.id));


            // 3. Identify existing members and pending invitees using separately fetched data
            const existingMemberIds = new Set(members.map(m => m.userId));

            // Map of existing pending invitations: invitedUserId -> invitationId
            // pendingInvitations is already filtered for PENDING status
            const existingPendingInvitationMap = new Map(pendingInvitations.map(inv => [inv.invitedUserId, inv.id]));
            // Set of user IDs with existing pending invitations
            const existingPendingInviteeIds = new Set(existingPendingInvitationMap.keys());


            // 4. Determine invitations to create and delete
            const userIdsToInvite: string[] = [];
            const invitationIdsToDelete: string[] = [];

            // Users to potentially invite:
            // - Must be in the submitted list (validSubmittedUserIds)
            // - Must not be the leader
            // - Must not be an existing member
            // - Must not already have a pending invitation
            for (const inviteeId of validSubmittedUserIds) {
                 if (inviteeId !== team.leaderId && !existingMemberIds.has(inviteeId) && !existingPendingInviteeIds.has(inviteeId)) {
                    userIdsToInvite.push(inviteeId);
                }
            }

            // Existing pending invitations to potentially delete:
            // - Iterate through existing pending invitations (existingPendingInvitationMap)
            // - If the invited user's ID is NOT in the set of valid submitted user IDs, mark the invitation for deletion.
            for (const [existingInviteeId, invitationId] of existingPendingInvitationMap.entries()) {
                 // Ensure types are handled correctly
                const inviteeIdStr = String(existingInviteeId); // Cast if necessary, though should be string
                const invitationIdStr = String(invitationId); // Cast if necessary, though should be string

                if (!validSubmittedUserIds.has(inviteeIdStr)) {
                    invitationIdsToDelete.push(invitationIdStr);
                }
            }

            // 5. Perform database operations
            // Update team name
            const updateTeamPromise = tx.team.update({
                where: { id: teamId },
                data: { name: trimmedName },
                 // Select necessary fields for the response
                select: { id: true, name: true, leaderId: true, whitelist: true, _count: { select: { members: true } } }
            });

            // Create new invitations using the transaction client (tx)
            const createInvitesPromise = userIdsToInvite.length > 0 ? tx.teamInvitation.createMany({
                data: userIdsToInvite.map(invitedUserId => ({
                    teamId: teamId,
                    invitedById: userId, // The leader is inviting
                    invitedUserId: invitedUserId,
                    status: 'PENDING',
                })),
                skipDuplicates: true, // Should not happen due to checks, but good safety
            }) : Promise.resolve(); // No-op if no new invites

            // Delete stale invitations using the transaction client (tx)
            const deleteInvitesPromise = invitationIdsToDelete.length > 0 ? tx.teamInvitation.deleteMany({
                where: {
                    id: { in: invitationIdsToDelete },
                    teamId: teamId, // Ensure we only delete from the correct team
                    status: 'PENDING', // Ensure we only delete pending ones
                },
            }) : Promise.resolve(); // No-op if no deletes

            // Execute all promises concurrently within the transaction
            const [updatedTeam] = await Promise.all([
                updateTeamPromise,
                createInvitesPromise,
                deleteInvitesPromise
            ]);

            return updatedTeam; // Return the updated team data
        }); // End transaction

        // Transaction successful
        return NextResponse.json(result, { status: 200 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error(`Error updating team ${context.params.teamId}:`, error);

        // Handle specific errors thrown from the transaction
        if (error.message === 'Team not found') {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }
        if (error.message === 'Forbidden') {
            return NextResponse.json({ error: 'Forbidden: Only the team leader can update the team' }, { status: 403 });
        }

        // Handle Prisma unique constraint violation (e.g., team name already exists)
        // This might occur if the name update conflicts, even within a transaction if checked outside implicitly
        if (error?.code === 'P2002' && error?.meta?.target?.includes('name')) {
             return NextResponse.json({ error: 'A team with this name already exists' }, { status: 409 });
        }

        // Handle other potential Prisma errors (less likely for not found due to initial check)
        if (error?.code === 'P2025') {
             return NextResponse.json({ error: 'An error occurred during the update process.' }, { status: 404 }); // More generic as it could be invite deletion etc.
        }

        // Generic error
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
