"use server";

import { prisma } from "@/lib/prisma";
import { UpdateUserCurrencySchema } from "@/schema/userSettings";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export async function UpdateUserCurrency(currency: string) {
    const parsedBody = UpdateUserCurrencySchema.safeParse({
        currency,
    });

    if (!parsedBody.success) {
        throw parsedBody.error;
    }

    const user = await currentUser();
    if (!user) {
        redirect("/sign-in");
    }

    // Use upsert instead of update to handle both new and existing users
    const userSettings = await prisma.userSettings.upsert({
        where: {
            userId: user.id,
        },
        update: {
            currency,
        },
        create: {
            userId: user.id,
            currency,
        },
    });

    return userSettings;
}