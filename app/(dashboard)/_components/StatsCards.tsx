"use client";
import { GetBalanceStatsResponseType } from '@/app/api/stats/balance/route';
import SkeletonWrapper from '@/components/SkeletonWrapper';
import { Card } from '@/components/ui/card';
import { DateToUTCDate, GetFormatterForCurrency } from '@/lib/helpers';
import { UserSettings } from '@prisma/client';
import { useQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import React, { ReactNode, useCallback, useMemo } from 'react'
import CountUp from "react-countup";

interface Props {
    from: Date;
    to: Date;
    userSettings: UserSettings;
}

function StatsCards({ from, to, userSettings }: Props) {
    const statsQuery = useQuery<GetBalanceStatsResponseType>({
        queryKey: ["overview", "stats", from, to],
        queryFn: () =>
            fetch(
                `/api/stats/balance?from=${DateToUTCDate(from)}&to=${DateToUTCDate(to)}`
            ).then((res) => res.json()),
    });

    const formatter = useMemo(() => {
        return GetFormatterForCurrency(userSettings.currency);
    }, [userSettings.currency]);

    const income = statsQuery.data?.income || 0;
    const expense = statsQuery.data?.expense || 0;

    const balance = income - expense;

    return (
        <div className='relative flex w-full flex-wrap gap-2 md:flex-nowrap'>
            
            <SkeletonWrapper isLoading={statsQuery.isFetching}>
                <StatCard
                    formatter={formatter}
                    value={income}
                    title="Income"
                    icon={
                        <div>
                            <TrendingUp className='h-12 w-12 items-center rounded-lg p-2 text-emerald-500 bg-emerald-400/10' />
                        </div>
                    }
                />
            </SkeletonWrapper>

            <SkeletonWrapper isLoading={statsQuery.isFetching}>
                <StatCard
                    formatter={formatter}
                    value={expense}
                    title="Expense"
                    icon={
                        <div>
                            <TrendingDown className='h-12 w-12 items-center rounded-lg p-2 text-red-500 bg-red-400/10' />
                        </div>
                    }
                />
            </SkeletonWrapper>

            <SkeletonWrapper isLoading={statsQuery.isFetching}>
                <StatCard
                    formatter={formatter}
                    value={balance}
                    title="Balance"
                    icon={
                        <div>
                            <Wallet className='h-12 w-12 items-center rounded-lg p-2 text-violet-500 bg-violet-400/10' />
                        </div>
                    }
                />
            </SkeletonWrapper>
        </div>
    )
}

export default StatsCards;

function StatCard({
    formatter,
    value,
    title,
    icon
}: {
    formatter: Intl.NumberFormat;
    value: number;
    title: String;
    icon: ReactNode
}) {
    const formatFn = useCallback(
        (value: number) => {
            return formatter.format(value);
        },
        [formatter]
    );

    // Add key prop to force re-render when value changes
    // This ensures proper animation
    return (
        <Card className="flex w-full items-center gap-2 p-4 transition-all duration-300 ease-in-out hover:shadow-md">
            <div className="transition-all duration-300 ease-in-out">
                {icon}
            </div>
            <div className='flex flex-col items-start gap-0'>
                <p className='text-muted-foreground transition-colors duration-200'>{title}</p>
                <CountUp
                    key={`${title}-${value}-${Date.now()}`} // Add timestamp to force rerender
                    start={value * 0.7}  // Start from 70% of the final value 
                    preserveValue={false} 
                    end={value}
                    decimals={2}
                    formattingFn={formatFn}
                    duration={1.5}
                    className='text-2xl transition-all duration-300 ease-in-out'
                />
            </div>
        </Card>
    )
}