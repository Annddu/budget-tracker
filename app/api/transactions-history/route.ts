import { GetFormatterForCurrency } from "@/lib/helpers";
import { prisma } from "@/lib/prisma";
import { OverviewQuerySchema } from "@/schema/overview";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
    // Get user from Clerk or via API key
    let userId: string | null = null;
    
    // Check for API key auth first
    const authHeader = request.headers.get('authorization');
    const API_KEY = process.env.API_KEY || 'your-secure-api-key';
    
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

    // Rest of your existing code, using userId
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const queryParams = OverviewQuerySchema.safeParse({
        from,
        to,
    });

    if(!queryParams.success) {
        return Response.json(queryParams.error.message, {
            status: 400,
        });
    
    }

    const tranasctios = await getTransactionsHistory(
        userId,
        queryParams.data.from,
        queryParams.data.to
    );

    return Response.json(tranasctios);
}

export type getTransactionsHistoryResponseType = Awaited<
    ReturnType<typeof getTransactionsHistory>
>;

export async function getTransactionsHistory(userId: string, from: Date, to: Date) {
    const userSettings = await prisma.userSettings.findUnique({
        where: {
            userId,
        },
    });
    if(!userSettings) {
        throw new Error("User settings not found");
    }

    const formatter = GetFormatterForCurrency(userSettings.currency);

    const transations = await prisma.transation.findMany({
        where: {
            userId,
            date: {
                gte: from,
                lte: to,
            },
        },
        orderBy: {
            date: 'desc',
        },
    });

    return transations.map(transation => ({
        ...transation,
        // format the amount to the user currency
        formattedAmount: formatter.format(transation.amount),
    }))

}