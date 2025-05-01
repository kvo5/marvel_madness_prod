// src/components/TeamWidget.tsx

"use client";

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import CustomImage from './Image'; // Assuming this is the correct path for the Image component

// Re-using types defined in TeamsClientPage - consider moving to a shared types file later
interface TeamMember {
    id: string;
    username: string;
    img?: string | null;
    displayName?: string | null;
    // Add other fields if needed from the API response (e.g., user object within member)
    user?: { // Assuming the API includes the user object within members
        id: string;
        username: string;
        img?: string | null;
        displayName?: string | null;
    }
    // Add userId if it's directly on the member object from the API
    userId?: string;
}

interface Team {
    id: string;
    name: string;
    leaderId: string; // Need leaderId to identify leader in members array
    leader: TeamMember; // Assuming leader includes necessary fields like img
    members: TeamMember[]; // Assuming members array includes user details
    _count?: { members: number };
}

interface UserTeamStatus {
    team: Team | null;
    isLeader: boolean;
}

interface TeamWidgetProps {
    team: Team;
    currentUserTeamStatus: UserTeamStatus | null; // Pass the fetched status from the parent
    currentUsername: string | undefined | null; // Pass the current user's username
    onEdit: (team: Team) => void; // Callback to open the edit modal in parent
    hasPendingInvitation: boolean; // Flag indicating if the current user is invited to THIS team
}

const MAX_DISPLAY_MEMBERS = 6;

const TeamWidget: React.FC<TeamWidgetProps> = ({ team, currentUserTeamStatus, currentUsername, onEdit, hasPendingInvitation }) => {
    const queryClient = useQueryClient();

    // --- Join Team Mutation ---
    const joinMutation = useMutation({
        mutationFn: (teamId: string) => axios.post(`/api/teams/${teamId}/join`), // Use POST
        onSuccess: () => {
            // Invalidate queries to refetch data after joining
            queryClient.invalidateQueries({ queryKey: ['userTeamStatus'] });
            queryClient.invalidateQueries({ queryKey: ['teams'] }); // Refetch team list/search
            queryClient.invalidateQueries({ queryKey: ['teams', team.id] }); // Refetch specific team details if needed elsewhere
            // Optionally: Show success message
            alert('Successfully joined team!');
        },
        onError: (error: AxiosError<{ error?: string }>) => { // Use AxiosError type
            console.error("Error joining team:", error);
            // Optionally: Show error message based on response
            const errorMessage = error.response?.data?.error || error.message || 'Failed to join team.';
            alert(`Error: ${errorMessage}`);
        },
    });

    const handleJoinTeam = () => {
        joinMutation.mutate(team.id);
    };

    // --- Determine Join Button Visibility ---
    const memberCount = team._count?.members ?? team.members?.length ?? 0;
    const userIsOnThisTeam = currentUserTeamStatus?.team?.id === team.id;
    const userIsOnAnyTeam = !!currentUserTeamStatus?.team; // Keep this check

    // User can join IF they have a pending invitation for THIS team AND they are not already on THIS team
    // Note: The API already prevents joining if on *any* team, but this check prevents showing the button unnecessarily.
    const canJoin = hasPendingInvitation && !userIsOnThisTeam;

    // --- Determine Edit Button Visibility ---
    const isCurrentUserLeaderOfThisTeam = currentUserTeamStatus?.isLeader === true && currentUserTeamStatus?.team?.id === team.id;


    // --- Prepare Member List for Display ---
    // Ensure leader is first if possible, then fill remaining slots
    const displayMembers: TeamMember[] = [];
    if (team.leader) {
        // Find the full member object corresponding to the leader ID, or use the leader object directly
        // Ensure the API provides userId on the member object or adapt this logic
        const leaderMember = team.members.find(m => (m.user?.id || m.userId) === team.leaderId) ?? team.leader;
         // Ensure the leader object has the necessary fields (like 'user' or 'img')
        const leaderUser = leaderMember.user ?? leaderMember; // Use nested user or direct fields
        if (leaderUser) {
             // Ensure ID is present, prioritize user.id, fallback to member.userId, then leaderId
             const memberId = leaderUser.id || leaderMember.userId || team.leaderId;
             displayMembers.push({ ...leaderUser, id: memberId });
        }
    }
    team.members.forEach(member => {
        const memberUserId = member.user?.id || member.userId;
        // Add member if not already added (as leader) and within limit
        if (memberUserId !== team.leaderId && displayMembers.length < MAX_DISPLAY_MEMBERS) {
             const memberUser = member.user ?? member; // Use nested user or direct fields
             if (memberUser && memberUserId) { // Ensure user data and ID exist
                displayMembers.push({ ...memberUser, id: memberUserId }); // Ensure ID is present
             }
        }
    });


    return (
        <div className="border border-border rounded-lg p-4 bg-secondary shadow-md flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 sm:space-x-4">
            {/* Team Info & Members */}
            <div className="flex-grow flex items-center space-x-4">
                 {/* Member Avatars */}
                 <div className="flex -space-x-2">
                    {displayMembers.slice(0, MAX_DISPLAY_MEMBERS).map((member, index) => (
                        <div key={member.id || index} className="relative group" title={member.username || 'Unknown User'}>
                            <CustomImage
                                path={member.img || "/general/avatar.png"} // Use member's image or fallback
                                alt={member.username || 'Member Avatar'}
                                w={40} // Tailwind size w-10
                                h={40} // Tailwind size h-10
                                className="rounded-full border-2 border-secondary object-cover" // Use secondary for border to blend
                            />
                            {/* Tooltip (using title attribute for simplicity) */}
                        </div>
                    ))}
                    {/* Placeholder circles if fewer than 6 members */}
                    {Array.from({ length: Math.max(0, MAX_DISPLAY_MEMBERS - displayMembers.length) }).map((_, index) => (
                         <div key={`placeholder-${index}`} className="w-10 h-10 rounded-full bg-gray-700 border-2 border-secondary flex items-center justify-center text-gray-400 text-xs">
                            {/* Optional: Placeholder icon or text */}
                         </div>
                    ))}
                </div>
                {/* Team Name */}
                <h3 className="text-lg font-semibold text-textPrimary">{team.name}</h3>
            </div>

            {/* Action Button */}
            <div className="flex-shrink-0">
                {/* Edit Button for Leader */}
                {isCurrentUserLeaderOfThisTeam && (
                     <button
                       onClick={() => onEdit(team)} // Call parent handler
                       className="px-4 py-2 rounded font-semibold bg-blue-500 hover:bg-blue-600 text-white"
                   >
                        Edit Team
                    </button>
                )}
                {/* Join Button for invited users not already on the team */}
                {canJoin && ( // Simplified condition based on new `canJoin` logic
                    <button
                        onClick={handleJoinTeam}
                        disabled={joinMutation.isPending}
                        className="px-4 py-2 rounded font-semibold bg-green-500 hover:bg-green-600 text-white disabled:bg-gray-400"
                    >
                        {joinMutation.isPending ? 'Joining...' : 'Join'}
                    </button>
                )}
                {/* Optionally show 'Full' or 'Not Whitelisted' status if needed */}
                 {/* Show "Team Full" only if user CANNOT join AND the reason is capacity */}
                 {!canJoin && !userIsOnThisTeam && !hasPendingInvitation && memberCount >= MAX_DISPLAY_MEMBERS && (
                     <span className="text-sm text-gray-500 px-4 py-2">Team Full</span>
                 )}
                 {/* Removed "Not Whitelisted" span */}
                 {/* If user is already on this team, no button/message needed */}
            </div>

            {/* Removed Edit Team Modal - handled by parent */}
        </div>
    );
};

export default TeamWidget;