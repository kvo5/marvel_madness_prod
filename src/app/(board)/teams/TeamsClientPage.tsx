// src/app/(board)/teams/TeamsClientPage.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios'; // Or use fetch
import InfiniteScroll from 'react-infinite-scroll-component';
import { useUser } from '@clerk/nextjs'; // Import useUser hook
// import { useDebounce } from 'use-debounce'; // Or implement manually

// Placeholders for components we will create
import TeamWidget from '@/components/TeamWidget'; // Import TeamWidget
import CreateEditTeamModal from './CreateEditTeamModal'; // Import unified modal

// Define types for API responses (adjust based on actual API structure)
interface TeamMember {
    id: string;
    username: string;
    img?: string | null; // Assuming img is the profile image field
    displayName?: string | null;
}

interface Team {
    id: string;
    name: string;
    leaderId: string; // Add leaderId
    leader: TeamMember; // Assuming leader is included
    members: TeamMember[];
    _count?: { members: number }; // If count is included
    // Add other relevant fields
}

interface TeamInvitation {
    id: string;
    teamId: string;
    // Add other relevant invitation fields if needed
}

interface UserTeamStatus {
    team: Team | null; // The team the user is on (or null)
    isLeader: boolean; // Whether the user leads this team
    pendingInvitations: TeamInvitation[]; // Add pending invitations
}

const fetchUserTeamStatus = async (): Promise<UserTeamStatus | null> => {
    try {
        // Assuming the endpoint now returns invitations as well
        const { data } = await axios.get<UserTeamStatus>('/api/users/me/team');
        return data;
    } catch (error) {
        // Handle cases where the user might not be logged in or other errors
        console.error("Error fetching user team status:", error);
        // Return null or a specific error state if needed
        if (axios.isAxiosError(error) && error.response?.status === 404) {
             // API returns 404 if user has no team, treat as valid null state
            return null;
        }
        // Re-throw other errors or handle them
        // For now, returning null simplifies initial logic
        return null;
    }
};

const fetchTeams = async ({ pageParam }: { pageParam: string | undefined }) => {
    const url = pageParam ? `/api/teams?cursor=${pageParam}` : '/api/teams';
    const { data } = await axios.get<{ teams: Team[], nextCursor: string | null }>(url);
    return data;
};

const searchTeams = async (query: string): Promise<Team[]> => {
    if (!query.trim()) return [];
    const { data } = await axios.get<{ teams: Team[] }>(`/api/teams/search?q=${encodeURIComponent(query)}`);
    return data.teams ?? []; // Ensure returning an array
};


const TeamsClientPage = () => {
    const queryClient = useQueryClient();
    const { user } = useUser(); // Get current user from Clerk
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    // State for the unified Create/Edit modal
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        mode: 'create' | 'edit';
        initialData?: Team | null; // For pre-filling edit form
    }>({ isOpen: false, mode: 'create', initialData: null });

    // --- Debounce Search Term ---
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500); // 500ms debounce delay

        return () => {
            clearTimeout(handler);
        };
    }, [searchTerm]);

    // --- Fetch User's Team Status ---
    const { data: userTeamStatus, isLoading: isLoadingUserStatus, error: userStatusError } = useQuery<UserTeamStatus | null>({
        queryKey: ['userTeamStatus'],
        queryFn: fetchUserTeamStatus,
        // staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const _userIsOnTeam = !!userTeamStatus?.team;
    const userIsLeader = userTeamStatus?.isLeader ?? false;
    const userTeamId = userTeamStatus?.team?.id;

    // --- Fetch Teams (Infinite Scroll) ---
    const {
        data: infiniteTeamsData,
        fetchNextPage,
        hasNextPage,
        isLoading: isLoadingInfiniteTeams,
        isFetchingNextPage,
        error: infiniteTeamsError,
    } = useInfiniteQuery({
        queryKey: ['teams'],
        queryFn: fetchTeams,
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: !debouncedSearchTerm, // Only run infinite query when not searching
    });

    const allTeams = infiniteTeamsData?.pages?.flatMap(page => page.teams) ?? [];

    // --- Search Teams ---
    const { data: searchResults, isLoading: isLoadingSearch, error: searchError } = useQuery({
        queryKey: ['teamsSearch', debouncedSearchTerm],
        queryFn: () => searchTeams(debouncedSearchTerm),
        enabled: !!debouncedSearchTerm, // Only run query when debounced term exists
    });

    // --- Mutations ---
    const createTeamMutation = useMutation({
        mutationFn: (data: { teamName: string; invitedUsernames: string[] }) =>
            axios.post('/api/teams', { name: data.teamName, invitedUsernames: data.invitedUsernames }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userTeamStatus'] });
            queryClient.invalidateQueries({ queryKey: ['teams'] });
            setModalState({ isOpen: false, mode: 'create', initialData: null }); // Close modal on success
            // Optionally: Show success message
        },
        onError: (error: AxiosError<{ message?: string }>) => { // Use AxiosError
            console.error("Error creating team:", error);
            // Optionally: Show error message to the user within the modal or via toast
            alert(`Failed to create team: ${error.response?.data?.message || error.message}`);
        },
    });

    const editTeamMutation = useMutation({
         mutationFn: (data: { teamId: string; teamName: string; invitedUsernames: string[] }) =>
            axios.put(`/api/teams/${data.teamId}`, { name: data.teamName, invitedUsernames: data.invitedUsernames }),
        onSuccess: (_variables) => {
            queryClient.invalidateQueries({ queryKey: ['userTeamStatus'] });
            // Invalidate specific team data if cached individually, or just the list
            queryClient.invalidateQueries({ queryKey: ['teams'] });
            // Optionally update the specific team in the cache directly for faster UI update
            // queryClient.setQueryData(['teams', variables.teamId], updatedTeamData);
            setModalState({ isOpen: false, mode: 'create', initialData: null }); // Close modal
        },
        onError: (error: AxiosError<{ message?: string }>, variables) => { // Use AxiosError
            console.error(`Error updating team ${variables.teamId}:`, error);
            alert(`Failed to update team: ${error.response?.data?.message || error.message}`);
        },
    });


    const deleteMutation = useMutation({
        mutationFn: (teamId: string) => axios.delete(`/api/teams/${teamId}`),
        onSuccess: () => {
            // Invalidate user status and teams list
            queryClient.invalidateQueries({ queryKey: ['userTeamStatus'] });
            queryClient.invalidateQueries({ queryKey: ['teams'] });
            // Optionally: Show success message
        },
        onError: (error) => {
            console.error("Error deleting team:", error);
            // Optionally: Show error message
            alert(`Failed to delete team: ${error.message}`);
        },
    });

    const handleDeleteTeam = () => {
        if (!userIsLeader || !userTeamId) return;
        if (window.confirm('Are you sure you want to delete your team? This action cannot be undone.')) {
            deleteMutation.mutate(userTeamId);
        }
    };

    // --- Modal Handlers ---
    const handleOpenEditModal = (team: Team) => {
        // Fetch current invitations for the team if needed, or just pass team data
        // For simplicity, we'll just pass the team name for now.
        // The modal itself handles fetching/displaying invite slots.
        setModalState({ isOpen: true, mode: 'edit', initialData: team });
    };

    const handleSaveTeam = (data: { teamName: string; invitedUsernames: string[]; teamId?: string }) => {
        if (modalState.mode === 'edit' && data.teamId) {
            editTeamMutation.mutate({
                teamId: data.teamId,
                teamName: data.teamName,
                invitedUsernames: data.invitedUsernames,
            });
        } else {
            createTeamMutation.mutate({
                teamName: data.teamName,
                invitedUsernames: data.invitedUsernames,
            });
        }
    };


    // --- Render Logic ---
    const isLoading = debouncedSearchTerm ? isLoadingSearch : (isLoadingInfiniteTeams || isFetchingNextPage);

    return (
        <div className="p-4 space-y-4">
            {/* Header & Actions */}
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Teams</h1>
                <div className="flex gap-2">
                    {/* Conditional Button Rendering */}
                    {isLoadingUserStatus ? (
                        <button
                            disabled
                            className="px-4 py-2 rounded font-semibold bg-gray-400 text-gray-700 cursor-not-allowed"
                        >
                            Loading...
                        </button>
                    ) : userIsLeader ? ( // Check only if user is leader
                        // Show Delete button if user is the leader
                        <button
                            onClick={handleDeleteTeam}
                            disabled={deleteMutation.isPending || !userTeamId} // Also disable if teamId is somehow missing
                            className="px-4 py-2 rounded font-semibold bg-red-500 hover:bg-red-600 text-white disabled:bg-gray-400"
                        >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete My Team'}
                        </button>
                    ) : (
                         // Show Create button if user is NOT the leader (covers no team AND member cases)
                        <button
                            onClick={() => setModalState({ isOpen: true, mode: 'create', initialData: null })}
                            className="px-4 py-2 rounded font-semibold bg-blue-500 hover:bg-blue-600 text-white"
                        >
                            Create Team
                        </button>
                    )}
                 </div>
            </div>

            {/* Search Bar */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search for teams..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded bg-input text-textPrimary focus:outline-none focus:ring-2 focus:ring-blue-500" // Added theme colors
                />
            </div>

            {/* Loading/Error States */}
            {isLoadingUserStatus && <p>Loading user status...</p>}
            {userStatusError && <p className="text-red-500">Error loading your team status.</p>}
            {/* Don't show infinite loading if search is active */}
            {isLoading && !isFetchingNextPage && <p>Loading teams...</p>}
            {infiniteTeamsError && !debouncedSearchTerm && <p className="text-red-500">Error loading teams list.</p>}
            {searchError && debouncedSearchTerm && <p className="text-red-500">Error searching teams.</p>}


            {/* Team List / Search Results */}
            {!isLoadingUserStatus && !userStatusError && (
                 debouncedSearchTerm ? (
                    // Search Results
                    <div className="space-y-4">
                        {isLoadingSearch && <p>Searching...</p>}
                        {!isLoadingSearch && searchResults && searchResults.length === 0 && <p>No teams found matching &quot;{debouncedSearchTerm}&quot;.</p>}
                        {!isLoadingSearch && searchResults && searchResults.map(team => {
                            // Determine if the current user has a pending invitation for this team
                            const hasPendingInvitation = !!userTeamStatus?.pendingInvitations?.some(inv => inv.teamId === team.id);
                            return (
                                <TeamWidget
                                    key={team.id}
                                    team={team}
                                    currentUserTeamStatus={userTeamStatus ?? null}
                                    currentUsername={user?.username}
                                    onEdit={handleOpenEditModal}
                                    hasPendingInvitation={hasPendingInvitation} // Pass invitation status
                                />
                            );
                        })}
                    </div>
                ) : (
                    // Infinite Scroll List
                    <InfiniteScroll
                        dataLength={allTeams.length}
                        next={fetchNextPage}
                        hasMore={!!hasNextPage}
                        loader={<p className="text-center py-4">Loading more teams...</p>}
                        endMessage={<p className="text-center py-4">No more teams to load.</p>}
                        className="space-y-4" // Add spacing between items
                    >
                        {allTeams.map(team => {
                             // Determine if the current user has a pending invitation for this team
                            const hasPendingInvitation = !!userTeamStatus?.pendingInvitations?.some(inv => inv.teamId === team.id);
                            return (
                                <TeamWidget
                                    key={team.id}
                                    team={team}
                                    currentUserTeamStatus={userTeamStatus ?? null}
                                    currentUsername={user?.username}
                                    onEdit={handleOpenEditModal}
                                    hasPendingInvitation={hasPendingInvitation} // Pass invitation status
                                />
                            );
                        })}
                    </InfiniteScroll>
                )
            )}

            {/* Create/Edit Team Modal */}
            {modalState.isOpen && (
                <CreateEditTeamModal
                    isOpen={modalState.isOpen}
                    initialTeamData={modalState.initialData} // Pass initial data for editing
                    onClose={() => setModalState({ isOpen: false, mode: 'create', initialData: null })}
                    onSave={handleSaveTeam}
                    isSaving={createTeamMutation.isPending || editTeamMutation.isPending} // Pass saving state
                />
            )}
        </div>
    );
};

export default TeamsClientPage;