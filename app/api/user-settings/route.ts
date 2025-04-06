import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
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

    let userSettings = await prisma.userSettings.findUnique({
        where: {
            userId: userId
        },
    });

    if (!userSettings) {
        userSettings = await prisma.userSettings.create({
            data: {
                userId: userId,
                currency: "USD",
            },
        });
    }

    // Revalidate the home page that uses the user currency
    // Only revalidate if using normal Clerk auth (not API key)
    if (authHeader !== `Bearer ${API_KEY}`) {
        revalidatePath("/");
    }
    
    return Response.json(userSettings);
}