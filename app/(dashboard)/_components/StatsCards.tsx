"use client";
import SkeletonWrapper from '@/components/SkeletonWrapper';
import { Card } from '@/components/ui/card';
import { DateToUTCDate, GetFormatterForCurrency } from '@/lib/helpers';
import { UserSettings } from '@prisma/client';
import { useQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import React, { ReactNode, useCallback, useMemo } from 'react'
import CountUp from "react-countup";
import { useAuth } from '@clerk/nextjs';
import { API_BASE_URL } from '@/lib/constants';

interface GetBalanceStatsResponseType {
    income: number;
    expense: number;
}

interface Props {
    from: Date;
    to: Date;
    userSettings: UserSettings;
}

function StatsCards({ from, to, userSettings }: Props) {
    const { userId } = useAuth();

    const statsQuery = useQuery<GetBalanceStatsResponseType>({
        queryKey: ["overview", "stats", from, to, userId],
        queryFn: async () => {
            if (!userId) return Promise.reject("No user ID available");

            console.log("Fetching balance stats for userId:", userId);

            try {
                const res = await fetch(
                    `${API_BASE_URL}/api/stats/balance?userId=${userId}&from=${DateToUTCDate(from)}&to=${DateToUTCDate(to)}`,
                    {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer your-secure-api-key'
                        }
                    }
                )
                return res.json();
            } catch (error) {
                console.log("Error fetching balance stats:", error);
                return [];
            }
        },
        enabled: !!userId,
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

    return (
        <Card className="flex w-full items-center gap-2 p-4 transition-all duration-300 ease-in-out hover:shadow-md">
            <div className="transition-all duration-300 ease-in-out">
                {icon}
            </div>
            <div className='flex flex-col items-start gap-0'>
                <p className='text-muted-foreground transition-colors duration-200'>{title}</p>
                <CountUp
                    key={`${title}-${value}-${Date.now()}`}
                    start={value * 0.7}
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