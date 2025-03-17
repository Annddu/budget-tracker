"use client";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { differenceInDays, startOfMonth } from 'date-fns';
import React, { useState } from 'react' // Import useState from React
import { toast } from 'sonner';
import TransactionTable from './TransactionTable';

function DatePicker() {
    const [dateRange, setDateRange] = useState<{ from: Date, to: Date }>({
        from: startOfMonth(new Date()),
        to: new Date()
    })

    return (
        <>
            <DateRangePicker
                initialDateFrom={dateRange.from}
                initialDateTo={dateRange.to}
                showCompare={false}
                onUpdate={(values) => {
                    const { from, to } = values.range;

                    if (!from || !to) return;
                    if (differenceInDays(to, from) > 10000) {
                        toast.error(
                            "The selected date range is too large. Please select a range of 10,000 days or less."
                        );
                        return;
                    }

                    setDateRange({ from, to });
                }}
            />

            <div className='container'>
                <TransactionTable from={dateRange.from} to={dateRange.to}/>
            </div>
        </>
    )
}

export default DatePicker
