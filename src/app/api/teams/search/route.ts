import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma';

// GET /api/teams/search?q=<searchTerm> - Search for teams by name
export async function GET(request: Request) {
    try {
        const authResult = await auth();
        const userId = authResult?.userId;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return NextResponse.json({ error: 'Search query parameter "q" is required' }, { status: 400 });
        }

        const teams = await prisma.team.findMany({
            where: {
                name: {
                    contains: query,
                    // mode: 'insensitive', // Rely on DB collation for case-insensitivity
                },
            },
            // Include relations and count. Scalar fields are included by default.
            include: {
                leader: {
                    select: { id: true, username: true, img: true, displayName: true },
                },
                members: {
                    include: {
                        user: {
                            select: { id: true, username: true, img: true, displayName: true },
                        },
                    },
                    orderBy: {
                        createdAt: 'asc',
                    }
                },
                _count: { // Include member count
                    select: { members: true }
                }
            },
            orderBy: {
                name: 'asc', // Order results alphabetically by name
            },
            take: 20, // Limit the number of search results
        });

        // Return response matching frontend expectation { teams: Team[] }
        return NextResponse.json({ teams });

    } catch (error) {
        console.error("Error searching teams:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}