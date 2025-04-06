import { prisma } from "@/lib/prisma";
import { CreateTransactionSchema } from "@/schema/transation";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

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
    // Parse and validate the request body
    const data = await request.json();
    const parsedBody = CreateTransactionSchema.safeParse(data);
    
    if (!parsedBody.success) {
      return Response.json({ error: parsedBody.error.message }, { status: 400 });
    }
    
    const {amount, category, date, description, type} = parsedBody.data;
    
    // Find the category
    const categoryRow = await prisma.category.findFirst({
      where: {
        userId,
        name: category,
      }
    });
    
    if (!categoryRow) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }
    
    // Use a transaction to ensure data consistency
    await prisma.$transaction([
      prisma.transation.create({
        data: {
          userId,
          amount,
          date: new Date(date), // Ensure date is properly converted
          description: description || "",
          type,
          category: categoryRow.name,
          categoryIcon: categoryRow.icon,
        },
      }),
      
      // Update month aggregate
      prisma.monthHistory.upsert({
        where: {
          day_month_year_userId: {
            userId,
            day: new Date(date).getUTCDate(),
            month: new Date(date).getUTCMonth(),
            year: new Date(date).getUTCFullYear(),
          },
        },
        create: {
          userId,
          day: new Date(date).getUTCDate(),
          month: new Date(date).getUTCMonth(),
          year: new Date(date).getUTCFullYear(),
          expense: type === "expense" ? amount : 0,
          income: type === "income" ? amount : 0,
        },
        update: {
          expense: {
            increment: type === "expense" ? amount : 0,
          },
          income: {
            increment: type === "income" ? amount : 0,
          },
        },
      }),
      
      // Update year aggregate
      prisma.yearHistory.upsert({
        where: {
          month_year_userId: {
            userId,
            month: new Date(date).getUTCMonth(),
            year: new Date(date).getUTCFullYear(),
          },
        },
        create: {
          userId,
          month: new Date(date).getUTCMonth(),
          year: new Date(date).getUTCFullYear(),
          expense: type === "expense" ? amount : 0,
          income: type === "income" ? amount : 0,
        },
        update: {
          expense: {
            increment: type === "expense" ? amount : 0,
          },
          income: {
            increment: type === "income" ? amount : 0,
          },
        },
      })
    ]);
    
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error creating transaction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}

// Add this PUT method to your existing transactions route file

export async function PUT(request: Request) {
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
    // Parse and validate the request body
    const data = await request.json();
    const parsedBody = CreateTransactionSchema.safeParse({
      amount: data.amount,
      category: data.category,
      date: data.date,
      description: data.description,
      type: data.type,
    });
    
    if (!parsedBody.success) {
      return Response.json({ error: parsedBody.error.message }, { status: 400 });
    }
    
    if (!data.id) {
      return Response.json({ error: "Transaction ID is required" }, { status: 400 });
    }
    
    // Get the original transaction
    const originalTransaction = await prisma.transation.findFirst({
      where: {
        id: data.id,
        userId,
      },
    });

    if (!originalTransaction) {
      return Response.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Find the category
    const categoryRow = await prisma.category.findFirst({
      where: {
        userId,
        name: data.category,
      },
    });

    if (!categoryRow) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }
    
    // The rest is identical to your server action
    const {amount, category, date, description, type} = parsedBody.data;
    
    // Use transaction to ensure atomic operations
    const result = await prisma.$transaction(async (tx) => {
      // First update the transaction 
      const updatedTransaction = await tx.transation.update({
        where: {
          id: data.id,
          userId,
        },
        data: {
          amount,
          date: new Date(date),
          description: description || "",
          type,
          category: categoryRow.name,
          categoryIcon: categoryRow.icon,
        },
      });

      // Always remove from the old history records first
      if (originalTransaction.type === "expense") {
        await tx.monthHistory.updateMany({
          where: {
            userId,
            day: originalTransaction.date.getUTCDate(),
            month: originalTransaction.date.getUTCMonth(),
            year: originalTransaction.date.getUTCFullYear(),
          },
          data: {
            expense: {
              decrement: originalTransaction.amount,
            },
          },
        });

        await tx.yearHistory.updateMany({
          where: {
            userId,
            month: originalTransaction.date.getUTCMonth(),
            year: originalTransaction.date.getUTCFullYear(),
          },
          data: {
            expense: {
              decrement: originalTransaction.amount,
            },
          },
        });
      } else if (originalTransaction.type === "income") {
        await tx.monthHistory.updateMany({
          where: {
            userId,
            day: originalTransaction.date.getUTCDate(),
            month: originalTransaction.date.getUTCMonth(),
            year: originalTransaction.date.getUTCFullYear(),
          },
          data: {
            income: {
              decrement: originalTransaction.amount,
            },
          },
        });

        await tx.yearHistory.updateMany({
          where: {
            userId,
            month: originalTransaction.date.getUTCMonth(),
            year: originalTransaction.date.getUTCFullYear(),
          },
          data: {
            income: {
              decrement: originalTransaction.amount,
            },
          },
        });
      }

      // Now add to the new history records
      if (type === "expense") {
        await tx.monthHistory.upsert({
          where: {
            day_month_year_userId: {
              userId,
              day: new Date(date).getUTCDate(),
              month: new Date(date).getUTCMonth(),
              year: new Date(date).getUTCFullYear(),
            },
          },
          create: {
            userId,
            day: new Date(date).getUTCDate(),
            month: new Date(date).getUTCMonth(),
            year: new Date(date).getUTCFullYear(),
            expense: amount,
            income: 0,
          },
          update: {
            expense: {
              increment: amount,
            },
          },
        });

        await tx.yearHistory.upsert({
          where: {
            month_year_userId: {
              userId,
              month: new Date(date).getUTCMonth(),
              year: new Date(date).getUTCFullYear(),
            },
          },
          create: {
            userId,
            month: new Date(date).getUTCMonth(),
            year: new Date(date).getUTCFullYear(),
            expense: amount,
            income: 0,
          },
          update: {
            expense: {
              increment: amount,
            },
          },
        });
      } else if (type === "income") {
        await tx.monthHistory.upsert({
          where: {
            day_month_year_userId: {
              userId,
              day: new Date(date).getUTCDate(),
              month: new Date(date).getUTCMonth(),
              year: new Date(date).getUTCFullYear(),
            },
          },
          create: {
            userId,
            day: new Date(date).getUTCDate(),
            month: new Date(date).getUTCMonth(),
            year: new Date(date).getUTCFullYear(),
            income: amount,
            expense: 0,
          },
          update: {
            income: {
              increment: amount,
            },
          },
        });

        await tx.yearHistory.upsert({
          where: {
            month_year_userId: {
              userId,
              month: new Date(date).getUTCMonth(),
              year: new Date(date).getUTCFullYear(),
            },
          },
          create: {
            userId,
            month: new Date(date).getUTCMonth(),
            year: new Date(date).getUTCFullYear(),
            income: amount,
            expense: 0,
          },
          update: {
            income: {
              increment: amount,
            },
          },
        });
      }
      
      return updatedTransaction;
    });
    
    return Response.json({ 
      success: true, 
      transaction: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error updating transaction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}

// Add this DELETE method to your existing transactions route file

export async function DELETE(request: Request) {
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
    // Get transaction ID from query params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return Response.json({ error: "Transaction ID is required" }, { status: 400 });
    }
    
    // Find the transaction first to get details needed for history updates
    const transaction = await prisma.transation.findUnique({
      where: {
        id,
        userId,
      }
    });
    
    if (!transaction) {
      return Response.json({ error: "Transaction not found" }, { status: 404 });
    }
    
    // Delete transaction and update history
    await prisma.$transaction([
      // Delete transaction from db
      prisma.transation.delete({
        where: {
          id,
          userId,
        },
      }),
      
      // Update month history
      prisma.monthHistory.update({
        where: {
          day_month_year_userId: {
            userId,
            day: transaction.date.getUTCDate(),
            month: transaction.date.getUTCMonth(),
            year: transaction.date.getUTCFullYear(),
          }
        },
        data: {
          ...(transaction.type === "expense" && {
            expense: {
              decrement: transaction.amount,
            },
          }),
          ...(transaction.type === "income" && {
            income: {
              decrement: transaction.amount,
            },
          }),
        }
      }),
      
      // Update year history
      prisma.yearHistory.update({
        where: {
          month_year_userId: {
            userId,
            month: transaction.date.getUTCMonth(),
            year: transaction.date.getUTCFullYear(),
          }
        },
        data: {
          ...(transaction.type === "expense" && {
            expense: {
              decrement: transaction.amount,
            },
          }),
          ...(transaction.type === "income" && {
            income: {
              decrement: transaction.amount,
            },
          }),
        }
      }),
    ]);
    
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}