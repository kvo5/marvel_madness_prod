import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/prisma"; // Use named import

export async function GET() {
  try {
    const { userId } = await auth(); // Await the auth() call

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        points: true, // Only select the points field
      },
    });

    if (!user) {
      // User authenticated via Clerk but not found in DB? Should sync via webhook.
      // Return 0 points as a fallback.
      console.warn(`User with Clerk ID ${userId} not found in database.`);
      return NextResponse.json({ points: 0 });
    }

    return NextResponse.json({ points: user.points ?? 0 }); // Return points, default to 0 if null/undefined
  } catch (error) {
    console.error("[POINTS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}