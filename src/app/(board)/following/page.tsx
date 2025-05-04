import { prisma } from "@/prisma";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import FollowingClientPage from "@/app/(board)/following/FollowingClientPage"; // Use path alias
// Define the type for the user data we expect
type FollowingUser = {
  id: string;
  username: string;
  displayName: string | null;
  img: string | null;
};

// Define the type for the relation data from Prisma including the follow ID if needed later
type FollowingRelation = {
  id: number; // Follow record ID
  following: FollowingUser;
};

// Add isFollowed status to the user type passed to client
type FollowingUserWithStatus = FollowingUser & {
  isFollowed: boolean;
};


const FollowingPage = async () => {
  const { userId } = await auth();
  if (!userId) {
    // Handle case where user is not logged in, maybe redirect or show message
    return <div className="p-4">Please log in to see who you are following.</div>;
  }

  // Fetch the users that the current user is following
  const followingRelations = await prisma.follow.findMany({
    where: {
      followerId: userId,
    },
    include: {
      // Include the full user data for the person being followed
      following: {
        select: {
          id: true,
          username: true,
          displayName: true,
          img: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc', // Optional: Order by when they were followed
    }
  });

  // Extract the user data and add the isFollowed status (always true here)
  const followingUsersWithStatus: FollowingUserWithStatus[] = followingRelations.map((relation: FollowingRelation) => ({
    ...relation.following,
    isFollowed: true, // On this page, we know they are followed
  }));


  return (
    <div className="">
      {/* Header Tabs - Copied from page.tsx for consistency, active tab updated */}
      <div className='px-4 pt-4 flex justify-between text-textGray font-bold border-b-[1px] border-borderYellow'>
        <Link className="pb-3 flex items-center" href="/">Feed</Link>
        <Link className="pb-3 flex items-center border-b-4 border-iconBlue" href="/following">Following</Link> {/* Updated href and active style */}
        <Link className="hidden pb-3 md:flex items-center" href="/">Scrims</Link>
        <Link className="hidden pb-3 md:flex items-center" href="/">Draft</Link>
      </div>

      {/* Pass data (including isFollowed status) to client component */}
      <FollowingClientPage initialFollowingUsers={followingUsersWithStatus} _currentUserId={userId} />
    </div>
  );
};

export default FollowingPage;