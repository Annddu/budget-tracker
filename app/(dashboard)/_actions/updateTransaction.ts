"use server";

import { prisma } from "@/lib/prisma";
import { CreateTransactionSchema, CreateTransactionSchemaType } from "@/schema/transation";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// Extended type for update that includes the transaction ID
type UpdateTransactionParams = CreateTransactionSchemaType & {
  id: string;
};

export async function UpdateTransaction({
  id,
  amount,
  category,
  date,
  description,
  type,
}: UpdateTransactionParams) {
  const parsedBody = CreateTransactionSchema.safeParse({
    amount,
    category,
    date,
    description,
    type,
  });
  
  if (!parsedBody.success) {
    throw new Error(parsedBody.error.message);
  }

  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }

  try {
    // Get the original transaction to calculate the difference
    const originalTransaction = await prisma.transation.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!originalTransaction) {
      throw new Error("Transaction not found");
    }

    const categoryRow = await prisma.category.findFirst({
      where: {
        userId: user.id,
        name: category,
      },
    });

    if (!categoryRow) {
      throw new Error("Category not found");
    }

    // Always perform history updates for maximum reliability
    // rather than conditional updates based on changes

    // Use transaction to ensure atomic operations
    const result = await prisma.$transaction(async (tx) => {
      // First update the transaction 
      const updatedTransaction = await tx.transation.update({
        where: {
          id,
          userId: user.id,
        },
        data: {
          amount,
          date,
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
            userId: user.id,
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
            userId: user.id,
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
            userId: user.id,
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
            userId: user.id,
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
              userId: user.id,
              day: date.getUTCDate(),
              month: date.getUTCMonth(),
              year: date.getUTCFullYear(),
            },
          },
          create: {
            userId: user.id,
            day: date.getUTCDate(),
            month: date.getUTCMonth(),
            year: date.getUTCFullYear(),
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
              userId: user.id,
              month: date.getUTCMonth(),
              year: date.getUTCFullYear(),
            },
          },
          create: {
            userId: user.id,
            month: date.getUTCMonth(),
            year: date.getUTCFullYear(),
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
              userId: user.id,
              day: date.getUTCDate(),
              month: date.getUTCMonth(),
              year: date.getUTCFullYear(),
            },
          },
          create: {
            userId: user.id,
            day: date.getUTCDate(),
            month: date.getUTCMonth(),
            year: date.getUTCFullYear(),
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
              userId: user.id,
              month: date.getUTCMonth(),
              year: date.getUTCFullYear(),
            },
          },
          create: {
            userId: user.id,
            month: date.getUTCMonth(),
            year: date.getUTCFullYear(),
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

    // Add this to force revalidation on the client
    return { 
      success: true,
      transaction: result,
      timestamp: new Date().toISOString() // Forces clients to recognize this as fresh data
    };
  } catch (error) {
    console.error("Error updating transaction:", error);
    throw error;
  }
}