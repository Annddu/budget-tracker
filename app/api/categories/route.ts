import { prisma } from "@/lib/prisma";
import { CreateCategorySchema } from "@/schema/categories";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { z } from "zod";

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

  const { searchParams } = new URL(request.url);
  const paramType = searchParams.get("type");

  const validator = z.enum(["expense", "income"]).nullable();
  const queryParams = validator.safeParse(paramType);
  if(!queryParams.success) {
    return Response.json(queryParams.error, {
        status: 400,
    });
  }  

  const type = queryParams.data;
  
  try {
    const categories = await prisma.category.findMany({
      where: {
        userId, 
        ...(type && { type }),//include type in the filters if it's defined
      },
      orderBy: {
        name: 'asc',
      }
    });
    
    return Response.json(categories);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
  
  try {
    const data = await request.json();
    const parsedBody = CreateCategorySchema.safeParse(data);
    
    if (!parsedBody.success) {
      return Response.json({ error: "Invalid request data" }, { status: 400 });
    }
    
    const { name, icon, type } = parsedBody.data;
    const category = await prisma.category.create({
      data: {
        userId,
        name,
        icon,
        type,
      },
    });
    
    return Response.json(category);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}