import { prisma } from "@/prisma";
import Post from "./Post";
import { auth } from "@clerk/nextjs/server";
import InfiniteFeed from "@/components/InfiniteFeed"; // Use path alias
// Define type for the result of the follow query
type FollowIdResult = {
  followingId: string;
};

// Define types based on the postIncludeQuery and the final post structure
type UserSummary = {
  displayName: string | null;
  username: string;
  img: string | null;
};

type EngagementCounts = {
  likes: number;
  rePosts: number;
  comments: number;
};

type EngagementRelations = {
  likes: { id: number }[];
  rePosts: { id: number }[];
  saves: { id: number }[];
};

// Base Post type from Prisma (adjust if needed based on actual Post model)
// Import directly from generated client location
import { Post as PostType } from "../../node_modules/.prisma/client";

type IncludedPostData = PostType & {
  user: UserSummary;
  _count: EngagementCounts;
} & EngagementRelations;

// Final type for the posts array, including the optional rePost
type PostWithDetails = IncludedPostData & {
  rePost?: IncludedPostData | null;
};

const Feed = async ({ userProfileId }: { userProfileId?: string }) => {
  const { userId } = await auth();

  if (!userId) return;

  const whereCondition = userProfileId
    ? { parentPostId: null, userId: userProfileId }
    : {
        parentPostId: null,
        userId: {
          in: [
            userId,
            ...(
              await prisma.follow.findMany({
                where: { followerId: userId },
                select: { followingId: true },
              })
            ).map((follow: FollowIdResult) => follow.followingId), // Add type for 'follow'
          ],
        },
      };

  const postIncludeQuery = {
    user: { select: { displayName: true, username: true, img: true } },
    _count: { select: { likes: true, rePosts: true, comments: true } },
    likes: { where: { userId: userId }, select: { id: true } },
    rePosts: { where: { userId: userId }, select: { id: true } },
    saves: { where: { userId: userId }, select: { id: true } },
  };

  const posts = await prisma.post.findMany({
    where: whereCondition,
    include: {
      rePost: {
        include: postIncludeQuery,
      },
      ...postIncludeQuery,
    },
    take: 3,
    skip: 0,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="">
      {/* Add type for 'post' */}
      {posts.map((post: PostWithDetails) => (
        <div key={post.id}>
          <Post post={post} />
        </div>
      ))}
      <InfiniteFeed userProfileId={userProfileId} />
    </div>
  );
};

export default Feed;