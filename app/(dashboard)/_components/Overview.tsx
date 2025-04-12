"use client";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { MAX_DATE_RANGE_DAYS } from '@/lib/constants';
import { UserSettings } from '@prisma/client';
import { differenceInDays, startOfMonth } from 'date-fns';
import React, { useState } from 'react'
import { toast } from 'sonner';
import StatsCards from './StatsCards';
import CategoriesStats from './CategoriesStats';
import { useNetwork } from '../_context/NetworkStatusProvider';
import { AlertCircle } from 'lucide-react';

function Overview({ userSettings }: { userSettings: UserSettings }) {
    const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
        from: startOfMonth(new Date()),
        to: new Date(),
    });
    
    const { isOnline } = useNetwork();

    return (
        <>
            <div className='flex items-end justify-between gap-2 py-6 px-8 bg-card'>
                <h2 className='text-3xl font-bold'>Overview</h2>
                <div className='flex items-center gap-3'>
                    {!isOnline && (
                        <div className="text-yellow-600 flex items-center text-sm">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            <span>Date filtering unavailable offline</span>
                        </div>
                    )}
                    <DateRangePicker
                        initialDateFrom={dateRange.from}
                        initialDateTo={dateRange.to}
                        showCompare={false}
                        disabled={!isOnline}
                        onUpdate={(values) => {
                            const { from, to } = values.range;

                            if (!from || !to) return;
                            if (differenceInDays(to, from) > MAX_DATE_RANGE_DAYS) {
                                toast.error(
                                    `The selected date range is too big. Max allowed range is ${MAX_DATE_RANGE_DAYS} days!`
                                );
                                return;
                            }

                            setDateRange({ from, to });
                        }}
                    />
                </div>
            </div>
            <div className='gap-2 w-full px-8 flex flex-col '>
                <StatsCards
                    userSettings={userSettings}
                    from={dateRange.from}
                    to={dateRange.to}
                />

                <CategoriesStats
                    userSettings={userSettings}
                    from={dateRange.from}
                    to={dateRange.to}
                />
            </div>
        </>
    )
}

export default Overview