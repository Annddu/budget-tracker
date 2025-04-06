import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    // Check for API key auth first
    const authHeader = request.headers.get('authorization');
    const API_KEY = process.env.API_KEY || 'your-secure-api-key';
    let userId;
    
    if (authHeader === `Bearer ${API_KEY}`) {
        // For API key auth, get userId from query param
        const { searchParams } = new URL(request.url);
        userId = searchParams.get('userId');
        
        if (!userId) {
            return Response.json({ error: "userId is required for API key authentication" }, { status: 400 });
        }
    } else {
        // Use normal Clerk auth
        const user = await currentUser();
        if (!user) {
            redirect("/sign-in");
        }
        userId = user.id;
    }

    const periods = await getHistoryPeriods(userId);
    return Response.json(periods);
}

export type getHistoryPeriodsResponseType = Awaited<
    ReturnType<typeof getHistoryPeriods>
>;

async function getHistoryPeriods(userId: string) {
    const result = await prisma.monthHistory.findMany({
        where: {
            userId,
        },
        select: {
            year: true,
        },
        distinct: ["year"],
        orderBy: [
            {
                year: "asc",
            }
        ]
    })

    const years = result.map((el) => el.year);
    if(years.length === 0){
        return [new Date().getFullYear()];
    }
    return years;
}