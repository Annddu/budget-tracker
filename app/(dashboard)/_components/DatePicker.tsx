"use client";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { differenceInDays, startOfMonth } from 'date-fns';
import React, { useState } from 'react' 
import { toast } from 'sonner';
import TransactionTable from './TransactionTable';
import { MAX_DATE_RANGE_DAYS } from '@/lib/constants';
import { useNetwork } from '../_context/NetworkStatusProvider';
import { AlertCircle } from 'lucide-react';

function DatePicker() {
    const [dateRange, setDateRange] = useState<{ from: Date, to: Date }>({
        from: startOfMonth(new Date()),
        to: new Date()
    });
    
    const { isOnline } = useNetwork();

    return (
        <>
            <div className="flex gap-2 items-center">
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
                                "The selected date range is too large. Please select a range of 10,000 days or less."
                            );
                            return;
                        }

                        setDateRange({ from, to });
                    }}
                />
            </div>

            <div className='w-full'>
                <TransactionTable from={dateRange.from} to={dateRange.to}/>
            </div>
        </>
    )
}

export default DatePicker
