import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation';
import React from 'react'
import CreateTransactionDialog from './_components/CreateTransactionDialog';

async function page() {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const userSettings = await prisma.userSettings.findUnique({
    where: {
      userId: user.id
    },
  });

  if (!userSettings) {
    redirect("/wizard");
  }

  return (
    <div className='h-full bg-background '>
      <div className='border-b bg-card flex'>
        <div className='container flex flex-wrap items-center justify-between gap-6 py-8 px-8'>
          <p className='text-3xl font-bold'>Hello, {user.firstName}! 👋</p>
        </div>

        <div className='flex items-center gap-3 px-8'>
          <CreateTransactionDialog trigger={
            <Button className='border-emerald-500 border-1 bg-emerald-950 text-white hover:bg-emerald-700 hover:text-white '>
              Add income
            </Button>
          }
            type='income'
          />
          <CreateTransactionDialog trigger={
            <Button className='border-rose-500 border-1 bg-rose-950 text-white hover:bg-rose-700 hover:text-white '>
              Add income
            </Button>
          }
            type='expense'
          />
        </div>
      </div>
    </div>
  )
}

export default page