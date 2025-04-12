import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import React, { Suspense } from 'react';
import CreateTransactionDialog from './_components/CreateTransactionDialog';
import { Button } from '@/components/ui/button';
import DatePicker from './_components/DatePicker';
import FilesPage from './files/page';
import DashboardClient from './_components/DashboardClient';
import History from './_components/History';
import CategoriesManager from './_components/CategoriesManager';

// Loading spinner component
const LoadingSpinner = () => {
  return (
    <div className="flex justify-center items-center p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
};

// This is now a Server Component (no "use client" directive)
export default async function DashboardPage() {
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
    <>
      <div className='block h-full bg-background'>
        <div className='border-b bg-card flex justify-between'>
          <div className='flex flex-wrap items-center py-8 px-8'>
            <p className='text-3xl font-bold'>Hello, {user.firstName}! 👋</p>
          </div>

          <div className='flex items-center gap-3 px-8'>
            <CreateTransactionDialog
              label="Add income"
              type="income"
              buttonClassName="border-emerald-500 border-1 bg-emerald-950 text-white hover:bg-emerald-700 hover:text-white"
            />
            <CreateTransactionDialog
              label="Add expense"
              type="expense"
              buttonClassName="border-rose-500 border-1 bg-rose-950 text-white hover:bg-rose-700 hover:text-white"
            />
          </div>
        </div>

        <FilesPage />

        {/* Pass the userSettings to the client component */}
        <DashboardClient userSettings={userSettings} />

        <Suspense fallback={<LoadingSpinner />}>
          <History userSettings={userSettings} />
        </Suspense>

        {/* Categories Manager Section */}
        <div className='py-8 px-8'>
          <h2 className='text-3xl font-bold mb-6'>Categories</h2>
          <div className="w-full">
            <Suspense fallback={<LoadingSpinner />}>
              <CategoriesManager />
            </Suspense>
          </div>
        </div>

        <div className='border-b flex flex-wrap justify-between gap-6 px-8'>
          <p className='text-3xl font-bold'>Transactions</p>
          <DatePicker />
        </div>
      </div>
    </>
  );
}