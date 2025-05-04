"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "@/components/Image";
import FollowButton from "@/components/FollowButton";

// Use the updated type that includes isFollowed status
type FollowingUserWithStatus = {
  id: string;
  username: string;
  displayName: string | null;
  img: string | null;
  isFollowed: boolean; // Added isFollowed
};

interface FollowingClientPageProps {
  initialFollowingUsers: FollowingUserWithStatus[]; // Use updated type
  _currentUserId: string; // Keep currentUserId if needed elsewhere, though FollowButton doesn't need it directly
}

const FollowingClientPage: React.FC<FollowingClientPageProps> = ({ initialFollowingUsers, _currentUserId }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUsers = useMemo(() => {
    if (!searchTerm) {
      return initialFollowingUsers;
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return initialFollowingUsers.filter(user =>
      user.username.toLowerCase().includes(lowerCaseSearchTerm) ||
      (user.displayName && user.displayName.toLowerCase().includes(lowerCaseSearchTerm))
    );
  }, [searchTerm, initialFollowingUsers]);

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Search Bar */}
      <div className='bg-periwinkleGrey py-2 px-4 flex items-center gap-4 rounded-full sticky top-0 z-10'> {/* Added sticky top-0 z-10 */}
        <Image path="/icons/explore.svg" alt="search" w={16} h={16}/> {/* Ensure correct path */}
        <input
          type="text"
          placeholder="Search following..."
          className="bg-transparent outline-none placeholder:text-textGray w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Following List */}
      {filteredUsers.length > 0 ? (
        filteredUsers.map((user) => (
          <div className="flex items-center justify-between" key={user.id}>
            <Link href={`/${user.username}`} className="flex items-center gap-3 flex-grow min-w-0 mr-2">
              <div className="relative rounded-full overflow-hidden w-12 h-12 flex-shrink-0"> {/* Slightly larger avatar */}
                <Image
                  path={user.img || "/general/post.jpeg"} // Use placeholder for now
                  alt={user.username}
                  w={48}
                  h={48}
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="font-semibold text-textPrimary truncate">{user.displayName || user.username}</span>
                <span className="text-sm text-textGray truncate">@{user.username}</span>
              </div>
            </Link>
            {/* Follow/Unfollow Button - Pass correct props */}
            <FollowButton
              userId={user.id} // Pass the ID of the user being displayed
              isFollowed={user.isFollowed} // Pass the follow status
              username={user.username} // Pass the username for notifications
            />
          </div>
        ))
      ) : (
        <div className="text-center text-textGray mt-4">
          {searchTerm ? "No users found matching your search." : "You are not following anyone yet."}
        </div>
      )}
    </div>
  );
};

export default FollowingClientPage;