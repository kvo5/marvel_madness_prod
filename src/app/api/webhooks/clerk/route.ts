import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { prisma } from "@/prisma";
import { Prisma } from "@prisma/client"; // Import Prisma namespace for types

export async function POST(req: Request) {
  const SIGNING_SECRET = process.env.SIGNING_SECRET;

  if (!SIGNING_SECRET) {
    throw new Error(
      "Error: Please add SIGNING_SECRET from Clerk Dashboard to .env or .env.local"
    );
  }

  // Create new Svix instance with secret
  const wh = new Webhook(SIGNING_SECRET);

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error: Missing Svix headers", {
      status: 400,
    });
  }

  // Get body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  let evt: WebhookEvent;

  // Verify payload with headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error: Could not verify webhook:", err);
    return new Response("Error: Verification error", {
      status: 400,
    });
  }

  // Do something with payload
  // For this guide, log payload to console
  const { id } = evt.data;
  const eventType = evt.type;
  console.log(`Received webhook with ID ${id} and event type of ${eventType}`);
  console.log("Webhook payload:", body);

  // Handle user creation
  if (eventType === "user.created") {
    try {
      const { id, email_addresses, username, image_url } = evt.data;
      const email = email_addresses?.[0]?.email_address;

      if (!email) {
        console.error("Error creating user: Email address is missing in webhook payload.");
        return new Response("Error: Missing email address", { status: 400 });
      }
      if (!username) {
        console.error("Error creating user: Username is missing in webhook payload.");
        // Consider how to handle missing usernames - maybe generate one or require it in Clerk settings
        return new Response("Error: Missing username", { status: 400 });
      }


      console.log(`Attempting to create user in DB: ID=${id}, Email=${email}, Username=${username}`); // <-- ADDED LOG
      await prisma.user.create({
        data: {
          id: id,
          username: username, // Use username from evt.data
          email: email,       // Use safely accessed email
          img: image_url || null, // Use image_url from evt.data, default to null
        },
      });
      console.log(`Successfully created user ${id} in database.`);
      return new Response("User created", { status: 201 }); // Use 201 for resource creation
    } catch (err) {
      // <-- MODIFIED LOGGING
      console.error(`Error during prisma.user.create for user ID ${evt.data.id}:`, err);
      // Check for unique constraint violation
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // User might already exist (e.g., previous delete failed, unique email constraint)
        // Attempt to update the existing user record with the new Clerk ID and details

        // Define emailToFind *before* the try block to make it accessible in catch
        const { id, email_addresses, username, image_url } = evt.data; // Re-destructure for clarity
        const emailToFind = email_addresses?.[0]?.email_address;
        console.warn(`Unique constraint violation for user.created. Attempting to update existing user by email: ${emailToFind}`);

        if (!emailToFind) {
          console.error("Update attempt failed: Email address missing in webhook payload.");
          return new Response("Error: Missing email for update", { status: 400 });
        }

        try { // Inner try block starts here
          await prisma.user.update({
            where: { email: emailToFind }, // Find the existing user by email
            data: {
              id: id, // Update the Clerk ID
              username: username || `user_${id}`, // Update username, provide fallback
              img: image_url || null, // Update image
              // Add any other fields that should be reset/updated on re-signup
            },
          });
          console.log(`Successfully updated existing user ${emailToFind} with new Clerk ID ${id}.`);
          return new Response("Existing user updated", { status: 200 });
        } catch (updateErr) { // Inner catch block starts here
          // emailToFind is now accessible here
          // <-- MODIFIED LOGGING
          console.error(`Error during prisma.user.update for email ${emailToFind} (attempting recovery from P2002):`, updateErr);
          // If the update fails, return a server error
          return new Response("Error: Failed to update existing user!", { status: 500 });
        } // End inner catch
      } // End outer if (P2002)
      // Handle other errors during creation
      return new Response("Error: Failed to create user!", { status: 500 });
    }
  }

  // Handle user updates
  if (eventType === "user.updated") {
    try {
      const { id, email_addresses, username, image_url } = evt.data;
      const email = email_addresses?.[0]?.email_address;

      // Prepare data for update, only include fields that might change
      const dataToUpdate: { email?: string; username?: string; img?: string | null } = {};
      if (email) dataToUpdate.email = email;
      if (username) dataToUpdate.username = username;
      // Allow setting img to null if image_url is empty/null in Clerk
      dataToUpdate.img = image_url || null;


      if (Object.keys(dataToUpdate).length === 0) {
         console.log(`No relevant user data to update for user ${id}.`);
         return new Response("No update needed", { status: 200 });
      }

      await prisma.user.update({
        where: { id: id },
        data: dataToUpdate,
      });
      console.log(`Successfully updated user ${id} in database.`);
      return new Response("User updated", { status: 200 });
    } catch (err) {
      console.error("Error processing user.updated webhook:", err);
       // Handle case where user might not exist during an update (though less likely)
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
         console.warn(`User ${evt.data.id} not found for update.`);
         return new Response("User not found", { status: 404 });
      }
      return new Response("Error: Failed to update user!", { status: 500 });
    }
  }

  // Handle user deletion
  if (eventType === "user.deleted") {
    try {
      // Use evt.data.id which should be available for deleted event
      const userIdToDelete = evt.data.id;
      if (!userIdToDelete) {
         console.error("Error deleting user: ID missing in webhook payload.");
         return new Response("Error: Missing user ID", { status: 400 });
      }
      await prisma.user.delete({ where: { id: userIdToDelete } });
      console.log(`Successfully deleted user ${userIdToDelete} from database.`);
      return new Response("User deleted", { status: 200 });
    } catch (err) {
      console.error("Error processing user.deleted webhook:", err);
       // Handle case where user might not exist during deletion
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
         console.warn(`User ${evt.data.id} not found for deletion.`);
         return new Response("User not found", { status: 404 });
      }
      return new Response("Error: Failed to delete user!", { status: 500 });
    }
  }

  return new Response("Webhook received", { status: 200 });
}