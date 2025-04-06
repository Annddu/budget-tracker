import { prisma } from "@/lib/prisma"; // Added missing prisma import
import { OverviewQuerySchema } from "@/schema/overview";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

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

    const {searchParams} = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const queryParams = OverviewQuerySchema.safeParse({ from, to});

    if (!queryParams.success) {
        return Response.json(queryParams.error.message, {
            status: 400,
        });
    }

    const stats = await getBalanceStats(
        userId,
        queryParams.data.from,
        queryParams.data.to
    );
    
    return Response.json(stats);
}

export type GetBalanceStatsResponseType = Awaited<
ReturnType<typeof getBalanceStats>
>;

async function getBalanceStats(userId: string, from: Date, to: Date) {
    const totals = await prisma.transation.groupBy({ // Keep as 'transation' if that's your schema
        by: ["type"],
        where: {
            userId,
            date: {
                gte: from,
                lte: to,
            },
        },
        _sum: {
            amount: true,
        },
    });

    return {
        expense: totals.find((t) => t.type === "expense")?._sum.amount || 0,
        income: totals.find((t) => t.type === "income")?._sum.amount || 0,
    }
}