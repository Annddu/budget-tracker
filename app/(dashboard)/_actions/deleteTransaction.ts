"use server";

import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function DeleteTransaction(id: string) {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const transaction = await prisma.transation.findUnique({
    where: {
        userId: user.id,
        id,
    }
  });
  if(!transaction) {
    throw new Error("Transaction not found");
  }

  await prisma.$transaction([
    // Delete transaction from db
    prisma.transation.delete({
      where: {
        id,
        userId: user.id,
      },
    }),
    // Update month history
    prisma.monthHistory.update({
      where: {
        day_month_year_userId: {
            userId: user.id,
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
              userId: user.id,
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
  
  // Add revalidation path
  revalidatePath("/dashboard");
  
  // Return a success object to match the test expectation
  return { success: true };
}