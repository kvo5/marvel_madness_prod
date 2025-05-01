// src/app/(board)/teams/CreateEditTeamModal.tsx
"use client";

import React, { useState, useEffect } from 'react';

interface TeamData {
    id: string;
    name: string;
    // In a real scenario, you might receive existing pending invitations here
    // pendingInvitations?: string[];
}

interface CreateEditTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { teamName: string; invitedUsernames: string[]; teamId?: string }) => void;
    initialTeamData?: TeamData | null; // Use null or undefined to indicate create mode
    isSaving?: boolean; // Optional prop to indicate save operation is in progress
}

const CreateEditTeamModal: React.FC<CreateEditTeamModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialTeamData = null, // Default to null for create mode
    isSaving = false,
}) => {
    const [teamName, setTeamName] = useState('');
    const [invite1, setInvite1] = useState('');
    const [invite2, setInvite2] = useState('');
    const [invite3, setInvite3] = useState('');
    const [invite4, setInvite4] = useState('');
    const [invite5, setInvite5] = useState('');
    const [error, setError] = useState<string | null>(null);

    const isEditMode = !!initialTeamData;

    // Reset state when modal opens or initial data changes
    useEffect(() => {
        if (isOpen) {
            setTeamName(initialTeamData?.name || '');
            // Reset invites - could pre-fill based on initialTeamData.pendingInvitations if needed
            setInvite1('');
            setInvite2('');
            setInvite3('');
            setInvite4('');
            setInvite5('');
            setError(null);
        } else {
            // Clear state when modal is closed
            setTeamName('');
            setInvite1('');
            setInvite2('');
            setInvite3('');
            setInvite4('');
            setInvite5('');
            setError(null);
        }
    }, [isOpen, initialTeamData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null); // Clear previous errors

        const trimmedName = teamName.trim();
        if (!trimmedName) {
            setError('Team name cannot be empty.');
            return;
        }
        if (trimmedName.length < 3 || trimmedName.length > 30) {
             setError('Team name must be between 3 and 30 characters.');
             return;
        }

        const invitedUsernames = [invite1, invite2, invite3, invite4, invite5]
            .map(invite => invite.trim())
            .filter(username => username !== ''); // Collect non-empty usernames

        // Basic validation for invited usernames (e.g., prevent self-invite, check format) could be added here

        onSave({
            teamName: trimmedName,
            invitedUsernames,
            teamId: initialTeamData?.id, // Include teamId if in edit mode
        });

        // Note: Closing the modal and resetting state is now handled by the parent
        // via the `onSave` callback success logic and controlling the `isOpen` prop.
    };

    if (!isOpen) return null;

    const inviteFields = [
        { id: 'invite1', label: 'Invite Teammate 1', value: invite1, setter: setInvite1 },
        { id: 'invite2', label: 'Invite Teammate 2', value: invite2, setter: setInvite2 },
        { id: 'invite3', label: 'Invite Teammate 3', value: invite3, setter: setInvite3 },
        { id: 'invite4', label: 'Invite Teammate 4', value: invite4, setter: setInvite4 },
        { id: 'invite5', label: 'Invite Teammate 5', value: invite5, setter: setInvite5 },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-borderYellow rounded-lg shadow-xl p-6 w-full max-w-lg"> {/* Increased max-w */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-black">
                        {isEditMode ? 'Edit Team' : 'Create New Team'}
                    </h2>
                    <button onClick={onClose} disabled={isSaving} className="text-black hover:text-black disabled:opacity-50">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Team Name Input */}
                    <div>
                        <label htmlFor="teamName" className="block text-sm font-medium text-black mb-1">
                            Team Name
                        </label>
                        <input
                            type="text"
                            id="teamName"
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            required
                            minLength={3}
                            maxLength={30}
                            className="w-full p-2 border border-black rounded bg-input text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter team name (3-30 characters)"
                            disabled={isSaving}
                        />
                    </div>

                    {/* Invitation Inputs */}
                    <fieldset className="border border-black rounded p-3 mt-4">
                        <legend className="text-sm font-medium text-black px-1">Invite Teammates (Optional)</legend>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                            {inviteFields.map(field => (
                                <div key={field.id}>
                                    <label htmlFor={field.id} className="block text-xs font-medium text-black mb-1">
                                        {field.label}
                                    </label>
                                    <input
                                        type="text"
                                        id={field.id}
                                        value={field.value}
                                        onChange={(e) => field.setter(e.target.value)}
                                        className="w-full p-2 border border-border-black rounded bg-input text-black text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="Enter username"
                                        disabled={isSaving}
                                        maxLength={50} // Example constraint
                                    />
                                </div>
                            ))}
                        </div>
                    </fieldset>


                    {error && <p className="text-red-500 text-sm">{error}</p>}

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-4 py-2 rounded border border-red-500 bg-red-500 text-black hover:bg-border disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || !teamName.trim()}
                            className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {isSaving ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Team')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateEditTeamModal;