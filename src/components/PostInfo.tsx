"use client";

import Image from "./Image";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { deletePost } from "@/action";
import { useQueryClient } from "@tanstack/react-query";

const PostInfo = ({ postId, postUserId }: { postId: number; postUserId: string }) => {
  const [open, setOpen] = useState(false);
  const { user } = useUser();
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    if (!user || user.id !== postUserId) return; // Extra check

    setOpen(false); // Close menu

    try {
      const result = await deletePost(postId);
      if (result.success) {
        console.log("Post deleted successfully");
        // Invalidate the posts query to refetch the feed
        queryClient.invalidateQueries({ queryKey: ["posts"] });
      } else {
        console.error("Failed to delete post:", result.error);
        // Optionally show an error message to the user
      }
    } catch (error) {
      console.error("Error calling deletePost action:", error);
      // Optionally show an error message to the user
    }
  };

  return (
    <div className="relative">
      <div
        className="cursor-pointer w-4 h-4"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Image path="icons/infoMore.svg" alt="More options" w={16} h={16} />
      </div>
      {open && (
        <div className="absolute top-5 right-0 bg-black border border-borderYellow rounded-md shadow-lg z-10 p-2 w-max">
          {user?.id === postUserId && ( // Only show delete if the user owns the post
            <button
              onClick={handleDelete}
              className="text-red-500 hover:bg-red-900/50 w-full text-left px-3 py-1 rounded text-sm"
            >
              Delete
            </button>
          )}
          {/* Add other options like 'Report' or 'Block' here if needed */}
           <button
              onClick={() => setOpen(false)} // Close button for clicking outside or other actions
              className="text-textGray hover:bg-gray-700 w-full text-left px-3 py-1 rounded text-sm mt-1"
            >
              Cancel
            </button>
        </div>
      )}
    </div>
  );
};

export default PostInfo;
