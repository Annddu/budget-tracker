import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { faker } from "@faker-js/faker";

// Function to wait a specified time
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
  
  // Parse options from request body
  const { count = 100, delayMs = 100 } = await request.json();
  
  // Start the streaming response
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  
  // Start async process to generate transactions
  generateTransactions(userId, count, delayMs, writer);
  
  // Return streaming response
  return new NextResponse(stream.readable);
}

async function generateTransactions(userId: string, count: number, delayMs: number, writer: WritableStreamDefaultWriter) {
  try {
    // Get user's categories from database
    const categories = await prisma.category.findMany({
      where: { userId }
    });
    
    // If no categories, use default ones
    const defaultCategories = [
      { name: "Food", icon: "🍔", type: "expense" },
      { name: "Transportation", icon: "🚗", type: "expense" },
      { name: "Entertainment", icon: "🎬", type: "expense" },
      { name: "Shopping", icon: "🛍️", type: "expense" },
      { name: "Health", icon: "🏥", type: "expense" },
      { name: "Education", icon: "📚", type: "expense" },
      { name: "Salary", icon: "💰", type: "income" },
      { name: "Investment", icon: "📈", type: "income" }
    ];
    
    const availableCategories = categories.length > 0 ? categories : defaultCategories;
    
    // Current date for reference
    const now = new Date();
    
    // Generate transactions one by one with delay
    for (let i = 0; i < count; i++) {
      // Choose between income or expense (30% income, 70% expense)
      const isExpense = Math.random() > 0.3;
      
      // Choose appropriate category based on transaction type
      const typeCategories = availableCategories.filter(c => 
        (isExpense && c.type === "expense") || (!isExpense && c.type === "income")
      );
      
      // Find the right category with icon
      const category = typeCategories.length > 0 
        ? typeCategories[Math.floor(Math.random() * typeCategories.length)]
        : (isExpense ? availableCategories[0] : availableCategories[6]);
      
      // Generate random date within the last 30 days
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 30));
      
      // Generate random amount based on transaction type
      const amount = isExpense 
        ? parseFloat((Math.random() * 200 + 10).toFixed(2)) 
        : parseFloat((Math.random() * 2000 + 500).toFixed(2));
      
      // Generate description using faker
      const description = isExpense
        ? faker.commerce.productName()
        : ["Monthly salary", "Freelance work", "Dividend payment", "Bonus"][Math.floor(Math.random() * 4)];
      
      // Create the transaction
      await prisma.$transaction([
        prisma.transation.create({
          data: {
            userId,
            amount,
            date,
            description,
            type: isExpense ? "expense" : "income",
            category: category.name,
            categoryIcon: category.icon,
          },
        }),
        
        // Update month aggregate
        prisma.monthHistory.upsert({
          where: {
            day_month_year_userId: {
              userId,
              day: date.getUTCDate(),
              month: date.getUTCMonth(),
              year: date.getUTCFullYear(),
            },
          },
          create: {
            userId,
            day: date.getUTCDate(),
            month: date.getUTCMonth(),
            year: date.getUTCFullYear(),
            expense: isExpense ? amount : 0,
            income: !isExpense ? amount : 0,
          },
          update: {
            expense: {
              increment: isExpense ? amount : 0,
            },
            income: {
              increment: !isExpense ? amount : 0,
            },
          },
        }),
        
        // Update year aggregate
        prisma.yearHistory.upsert({
          where: {
            month_year_userId: {
              userId,
              month: date.getUTCMonth(),
              year: date.getUTCFullYear(),
            },
          },
          create: {
            userId,
            month: date.getUTCMonth(),
            year: date.getUTCFullYear(),
            expense: isExpense ? amount : 0,
            income: !isExpense ? amount : 0,
          },
          update: {
            expense: {
              increment: isExpense ? amount : 0,
            },
            income: {
              increment: !isExpense ? amount : 0,
            },
          },
        })
      ]);
      
      // Send update to client
      const progress = Math.round(((i + 1) / count) * 100);
      writer.write(encoder.encode(JSON.stringify({ 
        progress, 
        current: i + 1, 
        total: count,
        lastTransaction: {
          amount,
          type: isExpense ? "expense" : "income",
          category: category.name,
          categoryIcon: category.icon,
          description,
          date: date.toISOString()
        }
      }) + '\n'));
      
      // Wait before creating the next transaction
      await wait(delayMs);
    }
    
    // Complete the stream
    writer.write(encoder.encode(JSON.stringify({ complete: true }) + '\n'));
    writer.close();
  } catch (error) {
    console.error("Error generating transactions:", error);
    writer.write(encoder.encode(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }) + '\n'));
    writer.close();
  }
}

const encoder = new TextEncoder();