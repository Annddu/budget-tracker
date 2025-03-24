
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation';
import React from 'react'
import CreateTransactionDialog from './_components/CreateTransactionDialog';
import TransactionTable from './_components/TransactionTable';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { toast } from 'sonner';
import { differenceInDays, startOfMonth } from 'date-fns';
import DatePicker from './_components/DatePicker';
import Overview from './_components/Overview';
import History from './_components/History';

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

  // const [dateRange, setDateRange] = React.useState<{ from: Date, to: Date }>({
  //   from: startOfMonth(new Date()),
  //   to: new Date()
  // })

  return (
    <>
      <div className='block h-full bg-background '>
        <div className='border-b bg-card flex justify-between'>
          <div className='flex flex-wrap items-center  py-8 px-8'>
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
                Add expense
              </Button>
            }
              type='expense'
            />
          </div>
        </div>

        <Overview userSettings={userSettings} />
        <History userSettings={userSettings} />

        {/* <div className='px-8 border-b flex flex-wrap items-center justify-between gap-6 py-8'> 
          <div>
            <p className='text-3xl font-bold'>Transactions</p>
          </div>
          <DatePicker />
        </div>*/}

      </div>

    </>
  )
}

export default page