import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          {
            username: {
              contains: query,
            },
          },
          {
            displayName: {
              contains: query,
            },
          },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        img: true,
      },
      take: 10, // Limit results for performance
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}