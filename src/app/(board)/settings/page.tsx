import React from 'react';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/prisma'; // Import prisma client
import SettingsForm from '@/components/SettingsForm'; // Import the new form component

const SettingsPage = async () => {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    redirect('/sign-in'); // Redirect if not logged in
  }

  console.log(`[SettingsPage] Attempting to fetch DB user for Clerk ID: ${clerkUser.id}`); // Log the ID being used
  // Fetch user data from your database using the clerk user ID
  const dbUser = await prisma.user.findUnique({
    where: { id: clerkUser.id },
    select: {
      displayName: true,
      bio: true,
      location: true,
      role: true, // Add role
      rank: true, // Add rank
      img: true,
      cover: true,
      username: true, // Include username for form submission/revalidation
    },
  });

  console.log(`[SettingsPage] Prisma findUnique result for ID ${clerkUser.id}:`, dbUser ? 'Found' : 'Not Found'); // Log the result

  if (!dbUser) {
    // This case might happen if the webhook hasn't created the user yet
    // Or if there's a data inconsistency. Handle appropriately.
    console.error(`[SettingsPage] User ${clerkUser.id} not found in database.`);
    // You might want to show an error message or redirect
    return <div className="p-4">Error: User data not found. Please try again later.</div>;
  }

  // Prepare initial data for the form
  const initialData = {
    displayName: dbUser.displayName,
    bio: dbUser.bio,
    location: dbUser.location,
    role: dbUser.role, // Add role
    rank: dbUser.rank, // Add rank
    img: dbUser.img,
    cover: dbUser.cover,
    username: dbUser.username,
  };


  return (
    <div className="p-4 border-l border-r border-borderYellow min-h-screen">
      <h1 className="text-xl font-bold mb-6">Edit Profile</h1>
      {/* Render the client component with initial data */}
      <SettingsForm initialData={initialData} />
    </div>
  );
};

export default SettingsPage;