"use client";

import { followUser } from "@/action";
import { socket } from "@/socket";
import { useUser } from "@clerk/nextjs";
import { useOptimistic, useState } from "react";

const FollowButton = ({
  userId,
  isFollowed,
  username,
}: {
  userId: string;
  isFollowed: boolean;
  username: string;
}) => {
  const [state, setState] = useState(isFollowed);

  const { user } = useUser();

  const [optimisticFollow, switchOptimisticFollow] = useOptimistic(
    state,
    (prev) => !prev
  );

  if (!user) return;

  const followAction = async () => {
    switchOptimisticFollow("");
    await followUser(userId);
    setState((prev) => !prev);
    // SEND NOTIFICATION
    socket.emit("sendNotification", {
      receiverUsername: username,
      data: {
        senderUsername: user.username,
        type: "follow",
        link: `/${user.username}`,
      },
    });
  };

  return (
    <form action={followAction}>
      <button
        className={`py-2 px-4 font-bold rounded-full transition-colors duration-200 ease-in-out ${
          optimisticFollow
            ? "bg-red-600 text-white hover:bg-red-700" // Red style for "Unfollow"
            : "bg-white text-black hover:bg-gray-200" // Original style for "Follow"
        }`}
      >
        {optimisticFollow ? "Unfollow" : "Follow"}
      </button>
    </form>
  );
};

export default FollowButton;