"use client";

import SkeletonWrapper from '@/components/SkeletonWrapper';
import { Select, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Tabs, TabsTrigger } from '@/components/ui/tabs';
import { API_BASE_URL } from '@/lib/constants';
import { Period, Timeframe } from '@/lib/types';
import { useAuth } from '@clerk/nextjs';
import { SelectTrigger } from '@radix-ui/react-select';
import { TabsList } from '@radix-ui/react-tabs';
import { useQuery } from '@tanstack/react-query';
import React from 'react'

type getHistoryPeriodsResponseType = number[];

interface Props {
    period: Period;
    setPeriod: (period: Period) => void;
    timeframe: Timeframe;
    setTimeframe: (timeframe: Timeframe) => void;
}

function HistoryPeriodSelector({
    period,
    setPeriod,
    timeframe,
    setTimeframe,
}: Props) {
    const { userId } = useAuth();

    const historyPeriods = useQuery<getHistoryPeriodsResponseType>({
        queryKey: ["overview", "history", "periods", userId],
        queryFn: async () => {
            if (!userId) return Promise.reject("No user ID available");
            try {
                const res = await fetch(`${API_BASE_URL}/api/history-periods?userId=${userId}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer your-secure-api-key'
                    }
                })
                return res.json();
            }
            catch (error) {
                console.log("Error fetching history periods:", error);
                return [];
            }
        },
        enabled: !!userId,
    });

    return (
        <div className='flex flex-wrap items-center gap-4'>
            <SkeletonWrapper isLoading={historyPeriods.isFetching} fullWidth={false}>
                <Tabs
                    value={timeframe}
                    onValueChange={(value) => setTimeframe(value as Timeframe)}
                >
                    <TabsList>
                        <TabsTrigger value="year">Year</TabsTrigger>
                        <TabsTrigger value='month'>Month</TabsTrigger>
                    </TabsList>
                </Tabs>
            </SkeletonWrapper>

            <div className='flex flex-wrap items-center gap-2'>
                <SkeletonWrapper isLoading={historyPeriods.isFetching} fullWidth={false}>
                    <YearSelector
                        period={period}
                        setPeriod={setPeriod}
                        years={historyPeriods.data || []}
                    />
                </SkeletonWrapper>
                {timeframe === "month" && (
                    <SkeletonWrapper
                        isLoading={historyPeriods.isFetching}
                        fullWidth={false}
                    >
                        <MonthSelector period={period} setPeriod={setPeriod} />
                    </SkeletonWrapper>
                )}
            </div>
        </div>
    )
}

export default HistoryPeriodSelector

function YearSelector({ period, setPeriod, years }: {
    period: Period;
    setPeriod: (period: Period) => void;
    years: getHistoryPeriodsResponseType;
}) {
    return (
        <Select
            value={period.year.toString()}
            onValueChange={(value) => {
                setPeriod({
                    month: period.month,
                    year: parseInt(value),
                });
            }}
        >
            <SelectTrigger className='w-[180px]'>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {years?.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                        {year}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

function MonthSelector({ period, setPeriod }: {
    period: Period;
    setPeriod: (period: Period) => void;
}) {
    return (
        <Select
            value={period.month.toString()}
            onValueChange={(value) => {
                setPeriod({
                    year: period.year,
                    month: parseInt(value),
                });
            }}
        >
            <SelectTrigger className='w-[180px]'>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]?.map((month) => {
                    const monthStr = new Date(period.year, month, 1).toLocaleString(
                        "default",
                        { month: "long" }
                    );
                    return (
                        <SelectItem key={month} value={month.toString()}>
                            {monthStr}
                        </SelectItem>
                    )
                })}
            </SelectContent>
        </Select>
    )
}