"use server";

import { auth } from "@clerk/nextjs/server"; // Correct auth import
import { createClerkClient } from "@clerk/backend"; // Import createClerkClient
import { prisma } from "./prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { UploadResponse } from "imagekit/dist/libs/interfaces";
import { imagekit } from "./utils";
import { Role } from "@prisma/client"; // Revert to standard import
export const followUser = async (targetUserId: string) => {
  const { userId } = await auth();

  if (!userId) return;

  const existingFollow = await prisma.follow.findFirst({
    where: {
      followerId: userId,
      followingId: targetUserId,
    },
  });

  if (existingFollow) {
    await prisma.follow.delete({
      where: { id: existingFollow.id },
    });
  } else {
    await prisma.follow.create({
      data: { followerId: userId, followingId: targetUserId },
    });
  }
};
export const likePost = async (postId: number) => {
  const { userId } = await auth();

  if (!userId) return;

  const existingLike = await prisma.like.findFirst({
    where: {
      userId: userId,
      postId: postId,
    },
  });

  if (existingLike) {
    await prisma.like.delete({
      where: { id: existingLike.id },
    });
  } else {
    await prisma.like.create({
      data: { userId, postId },
    });
  }
};
export const rePost = async (postId: number) => {
  const { userId } = await auth();

  if (!userId) return;

  const existingRePost = await prisma.post.findFirst({
    where: {
      userId: userId,
      rePostId: postId,
    },
  });

  if (existingRePost) {
    await prisma.post.delete({
      where: { id: existingRePost.id },
    });
  } else {
    await prisma.post.create({
      data: { userId, rePostId: postId },
    });
  }
};

export const savePost = async (postId: number) => {
  const { userId } = await auth();

  if (!userId) return;

  const existingSavedPost = await prisma.savedPosts.findFirst({
    where: {
      userId: userId,
      postId: postId,
    },
  });

  if (existingSavedPost) {
    await prisma.savedPosts.delete({
      where: { id: existingSavedPost.id },
    });
  } else {
    await prisma.savedPosts.create({
      data: { userId, postId },
    });
  }
};

export const addComment = async (
  prevState: { success: boolean; error: boolean },
  formData: FormData
) => {
  const { userId } = await auth();

  if (!userId) return { success: false, error: true };

  const postId = formData.get("postId");
  const username = formData.get("username");
  const desc = formData.get("desc");

  const Comment = z.object({
    parentPostId: z.number(),
    desc: z.string().max(140),
  });

  const validatedFields = Comment.safeParse({
    parentPostId: Number(postId),
    desc,
  });

  if (!validatedFields.success) {
    console.log(validatedFields.error.flatten().fieldErrors);
    return { success: false, error: true };
  }

  try {
    await prisma.post.create({
      data: {
        ...validatedFields.data,
        userId,
      },
    });
    revalidatePath(`/${username}/status/${postId}`);
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const addPost = async (
  prevState: { success: boolean; error: boolean },
  formData: FormData
) => {
  const { userId } = await auth();

  if (!userId) return { success: false, error: true };

  const desc = formData.get("desc");
  const file = formData.get("file") as File;
  const isSensitive = formData.get("isSensitive") as string;
  const imgType = formData.get("imgType");

  const uploadFile = async (file: File): Promise<UploadResponse> => {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const transformation = `w-600,${
      imgType === "square" ? "ar-1-1" : imgType === "wide" ? "ar-16-9" : ""
    }`;

    return new Promise((resolve, reject) => {
      imagekit.upload(
        {
          file: buffer,
          fileName: file.name,
          folder: "/posts",
          ...(file.type.includes("image") && {
            transformation: {
              pre: transformation,
            },
          }),
        },
        function (error, result) {
          if (error) reject(error);
          else resolve(result as UploadResponse);
        }
      );
    });
  };

  const Post = z.object({
    desc: z.string().max(140),
    isSensitive: z.boolean().optional(),
  });

  const validatedFields = Post.safeParse({
    desc,
    isSensitive: JSON.parse(isSensitive),
  });

  if (!validatedFields.success) {
    console.log(validatedFields.error.flatten().fieldErrors);
    return { success: false, error: true };
  }

  let img = "";
  let imgHeight = 0;
  let video = "";

  if (file.size) {
    const result: UploadResponse = await uploadFile(file);

    if (result.fileType === "image") {
      img = result.filePath;
      imgHeight = result.height;
    } else {
      video = result.filePath;
    }
  }

  console.log({
    ...validatedFields.data,
    userId,
    img,
    imgHeight,
    video,
  });

  try {
    await prisma.post.create({
      data: {
        ...validatedFields.data,
        userId,
        img,
        imgHeight,
        video,
      },
    });
    revalidatePath(`/`);
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
  // This line seems redundant as the try/catch should cover outcomes
  // return { success: false, error: true };
};

export const deletePost = async (postId: number) => {
  const { userId } = await auth();

  if (!userId) {
    console.error("Error deleting post: User not authenticated.");
    return { success: false, error: "Not authenticated" };
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true }, // Only select the userId for verification
    });

    if (!post) {
      console.error(`Error deleting post: Post with ID ${postId} not found.`);
      return { success: false, error: "Post not found" };
    }

    if (post.userId !== userId) {
      console.error(`Error deleting post: User ${userId} does not own post ${postId}.`);
      return { success: false, error: "Unauthorized" };
    }

    // Proceed with deletion
    await prisma.post.delete({
      where: { id: postId },
    });

    // Revalidate relevant paths
    revalidatePath("/");
    // Consider revalidating user profile paths if posts appear there
    // revalidatePath(`/[username]`);

    return { success: true, error: false };
  } catch (err) {
    console.error(`Error deleting post ${postId}:`, err);
    return { success: false, error: "Database error" };
  }
};


export const updateUserProfile = async (
  prevState: { success: boolean; error: string | null },
  formData: FormData
) => {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const displayName = formData.get("displayName") as string | null;
  const bio = formData.get("bio") as string | null;
  const location = formData.get("location") as string | null;
  const roleString = formData.get("role") as string | null; // Get role as string first
  const rank = formData.get("rank") as string | null; // Add rank
  const profilePicFile = formData.get("profilePic") as File | null;
  const coverPicFile = formData.get("coverPic") as File | null;

  // --- ImageKit Upload Helper ---
  const uploadFile = async (file: File, folder: string): Promise<UploadResponse | null> => {
    if (!file || file.size === 0) return null;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Basic transformation for profile/cover pics (e.g., width limit)
    const transformation = "w-400"; // Adjust as needed

    return new Promise((resolve, reject) => {
      imagekit.upload(
        {
          file: buffer,
          fileName: file.name,
          folder: folder, // e.g., /profile_pics or /cover_pics
          transformation: {
            pre: transformation,
          },
          useUniqueFileName: true, // Good practice for user uploads
        },
        function (error, result) {
          if (error) reject(error);
          else resolve(result as UploadResponse);
        }
      );
    });
  };

  // --- Validation (Optional but Recommended) ---
  // You could add Zod validation here if needed for string lengths, URL format etc.
  // const ProfileData = z.object({ ... });
  // const validatedFields = ProfileData.safeParse({ ... });
  // if (!validatedFields.success) { ... }

  try {
    console.log("Starting profile update for user:", userId); // Log start of action
    let profilePicPath: string | undefined = undefined; // For DB
    let profilePicUrl: string | undefined = undefined; // For Clerk
    let coverPicPath: string | undefined = undefined; // Keep path for potential direct use? Or remove if only URL is needed.
    let coverPicUrl: string | undefined = undefined; // Add variable for cover URL

    // Upload profile picture if provided
    if (profilePicFile && profilePicFile.size > 0) {
      console.log("Attempting to upload profile picture..."); // Log start
      const result = await uploadFile(profilePicFile, "/profile_pics");
      if (result) {
        profilePicPath = result.filePath; // Store path for DB
        profilePicUrl = result.url; // Store full URL for Clerk
        console.log("Profile picture uploaded:", profilePicPath, profilePicUrl); // Log both
      } else {
        // Handle upload error specifically if needed
        console.error("Profile picture upload failed (uploadFile returned null/undefined).");
        // Potentially return error here if upload is critical
        // return { success: false, error: "Profile picture upload failed." };
      }
    }

    // Upload cover picture if provided
    if (coverPicFile && coverPicFile.size > 0) {
       console.log("Attempting to upload cover picture..."); // Log start
       const result = await uploadFile(coverPicFile, "/cover_pics");
       if (result) {
         coverPicPath = result.filePath; // Store path (optional)
         coverPicUrl = result.url; // Store URL
         console.log("Cover picture uploaded:", coverPicPath, coverPicUrl); // Log both
       } else {
         console.error("Cover picture upload failed (uploadFile returned null/undefined).");
         // Potentially return error here
         // return { success: false, error: "Cover picture upload failed." };
       }
    }

    // --- Prepare Data for Prisma ---
    const dataToUpdate: {
      displayName?: string;
      bio?: string;
      location?: string;
      role?: Role;
      rank?: string;
      img?: string;
      cover?: string; // This will now store the full URL
    } = {};
    // Use nullish coalescing or check explicitly to avoid saving empty strings if not intended
    if (displayName !== null) dataToUpdate.displayName = displayName;
    if (bio !== null) dataToUpdate.bio = bio;
    if (location !== null) dataToUpdate.location = location;
    // Role validation moved here for clarity
    // Validate and add Role using direct import
    const validRole = roleString && Object.values(Role).includes(roleString as Role) ? roleString as Role : null;
    if (validRole !== null) dataToUpdate.role = validRole;
    if (rank !== null) dataToUpdate.rank = rank; // Assuming empty string is acceptable if user clears rank
    // Update Clerk user image URL if a new profile picture was uploaded AND prepare DB update
    // Update Clerk user image URL if a new profile picture was uploaded
    if (profilePicUrl !== undefined) { // Check if we have a URL for Clerk
      // Explicitly create a backend client instance
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      if (!clerk) {
         console.error("Failed to create Clerk client. Check CLERK_SECRET_KEY.");
         // Decide how to handle this - maybe return an error
         // return { success: false, error: "Server configuration error." };
      } else { // If clerk client created successfully
        try { // Try updating the user
          console.log(`Attempting to update Clerk publicMetadata.imageUrl for user ${userId} to ${profilePicUrl}`);
          // Try updating publicMetadata instead
          await clerk.users.updateUser(userId, {
             publicMetadata: { imageUrl: profilePicUrl },
          });
          console.log(`Successfully called updateUser with publicMetadata.imageUrl for user ${userId}`);

          // Add path to DB update data *only if* Clerk update succeeds
          // Store the full URL in the database if available
          if (profilePicUrl !== undefined) {
               dataToUpdate.img = profilePicUrl;
          }
      } catch (clerkError) {
        console.error(`Failed to update Clerk imageUrl for user ${userId}:`, clerkError);
        // Decide if this should be a fatal error or just logged
        // return { success: false, error: "Failed to update user identity service." };
      } // Closing brace for inner try...catch
    } // Closing brace for outer 'else' block
  } // Closing brace for 'if (profilePicUrl !== undefined)'
  // Store the full URL in the database if available
  if (coverPicUrl !== undefined) dataToUpdate.cover = coverPicUrl;

  // Only update if there's something to change
    if (Object.keys(dataToUpdate).length === 0) {
       console.log("No profile data to update."); // Log no changes
       return { success: true, error: null }; // No changes needed
    }

    console.log("Attempting to update database with data:", dataToUpdate); // Log before DB update
    // --- Update Database ---
    await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
    });
    console.log("Database update successful for user:", userId); // Log DB success

    // --- Revalidation ---

    revalidatePath("/settings");
    revalidatePath(`/${formData.get("username")}`); // Revalidate profile page

    return { success: true, error: null };

  } catch (err) {
    // Log the specific error caught
    console.error("Caught error during profile update:", err);
    return { success: false, error: "Failed to update profile." };
  }
};
// --- Delete User Account Action Removed ---