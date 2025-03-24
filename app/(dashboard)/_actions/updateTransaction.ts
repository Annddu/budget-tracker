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

  // Check if we need to update history records
  const dateChanged = 
    originalTransaction.date.getUTCDate() !== date.getUTCDate() ||
    originalTransaction.date.getUTCMonth() !== date.getUTCMonth() ||
    originalTransaction.date.getUTCFullYear() !== date.getUTCFullYear();
  
  const typeChanged = originalTransaction.type !== type;
  const amountChanged = originalTransaction.amount !== amount;

  await prisma.$transaction(async (tx) => {
    // Update the transaction
    await tx.transation.update({
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

    // If date, type or amount changed, update history records
    if (dateChanged || typeChanged || amountChanged) {
      // Remove from old history records
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

      // Add to new history records
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
    }
  });

  return { success: true };
}