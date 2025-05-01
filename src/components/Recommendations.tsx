import Link from "next/link";
import NextImage from "next/image"; // Import standard next/image
import { prisma } from "@/prisma";
import { auth } from "@clerk/nextjs/server";

// Define type for the result of the followingIds query
type FollowId = {
  followingId: string;
};

// Define type for the result of the recommendations query
type RecommendedUser = {
  id: string;
  displayName: string | null;
  username: string;
  img: string | null;
};

const Recommendations = async () => {
  const { userId } = await auth();

  if (!userId) return;

  const followingIds = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });

  // Add explicit type for 'f'
  const followedUserIds = followingIds.map((f: FollowId) => f.followingId);

  // Simplified recommendation: Find any user the current user doesn't follow
  const recommendations = await prisma.user.findMany({
    where: {
      id: {
        not: userId, // Exclude the current user
        notIn: followedUserIds, // Exclude users already followed
      },
    },
    take: 3, // Limit to 3 recommendations
    select: { id: true, displayName: true, username: true, img: true },
  });

  return (
    <div className="p-4 rounded-2xl border-[1px] border-borderYellow flex flex-col gap-4">
      {/* Add explicit type for 'person' */}
<h1 className="text-xl font-bold text-white text-center mb-2">Who to follow</h1>
      {recommendations.map((person: RecommendedUser) => (
        <div className="flex items-center justify-between" key={person.id}>
          {/* IMAGE AND USER INFO - Wrapped in Link */}
          <Link href={`/${person.username}`} className="flex items-center gap-2 flex-grow min-w-0 mr-2">
            <div className="relative rounded-full overflow-hidden w-10 h-10 flex-shrink-0">
              <NextImage
                src={person.img || "/general/noAvatar.png"} // Use src and standard fallback
                alt={person.username}
                fill // Use fill to cover container
                className="object-cover" // Ensure image covers the area
              />

            </div>
            <div className="flex flex-col overflow-hidden"> {/* Added overflow-hidden */}
              <h1 className="text-md font-bold truncate">{person.displayName || person.username}</h1> {/* Added truncate */}
              <span className="text-textGray text-sm truncate">@{person.username}</span> {/* Added truncate */}
            </div>
          </Link>
          {/* BUTTON - Changed to a Link styled as a button */}
          <Link
            href={`/${person.username}`}
            className="py-1 px-4 font-semibold bg-white text-black rounded-full hover:bg-gray-200 transition-colors duration-200 ease-in-out flex-shrink-0" // Added flex-shrink-0
          >
            View
          </Link>
        </div>
      ))}

      <Link href="/" className="text-iconBlue">
        Show More
      </Link>
    </div>
  );
};

export default Recommendations;