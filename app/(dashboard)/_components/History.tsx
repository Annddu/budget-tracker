"use client";

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GetFormatterForCurrency } from '@/lib/helpers';
import { Period, Timeframe } from '@/lib/types';
import { UserSettings } from '@prisma/client';
import React, { useCallback, useMemo, useState, useEffect } from 'react'
import HistoryPeriodSelector from './HistoryPeriodSelector';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import SkeletonWrapper from '@/components/SkeletonWrapper';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import CountUp from 'react-countup';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { API_BASE_URL } from '@/lib/constants';
import { useAuth } from '@clerk/nextjs';

function History({ userSettings }: { userSettings: UserSettings }) {
    const [timeframe, setTimeframe] = useState<Timeframe>("month");
    const [period, setPeriod] = useState<Period>({
        month: new Date().getMonth(),
        year: new Date().getFullYear(),
    });

    const formatter = useMemo(() => {
        return GetFormatterForCurrency(userSettings.currency);
    }, [userSettings.currency]);

    const queryClient = useQueryClient();
    const { userId } = useAuth();

    // Function to generate random data based on the current timeframe
    const generateRandomData = () => {
        const randomData = [];

        if (timeframe === "month") {
            // Generate daily data for the current month
            const daysInMonth = new Date(period.year, period.month + 1, 0).getDate();

            for (let day = 1; day <= daysInMonth; day++) {
                randomData.push({
                    year: period.year,
                    month: period.month,
                    day: day,
                    income: Math.random() * 5000,
                    expense: Math.random() * 3000
                });
            }
        } else {
            // Generate monthly data for the current year
            for (let month = 0; month < 12; month++) {
                randomData.push({
                    year: period.year,
                    month: month,
                    income: Math.random() * 15000,
                    expense: Math.random() * 10000
                });
            }
        }

        // Update the query data directly
        queryClient.setQueryData(
            ["overview", "history", timeframe, period],
            randomData
        );
    };

    // Add this function to restore original data
    const restoreOriginalData = () => {
        // Invalidate the queries to trigger a refetch from the server
        queryClient.invalidateQueries({
            queryKey: ["overview", "history", timeframe, period]
        });
    };

    useEffect(() => {
        // Store current state for other components to know what's displayed
        sessionStorage.setItem('historyState', JSON.stringify({ timeframe, period }));

        return () => {
            // Cleanup on unmount
            sessionStorage.removeItem('historyState');
        };
    }, [timeframe, period]);

    const historyDataQuery = useQuery({
        queryKey: ["overview", "history", timeframe, period, userId],
        queryFn: async () => {
            if (!userId) return Promise.reject("No user ID available");
            try {
                const res = await fetch(`${API_BASE_URL}/api/history-data?userId=${userId}&timeframe=${timeframe}&year=${period.year}&month=${period.month}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer your-secure-api-key'
                    }
                })
                return res.json();
            }
            catch (error) {
                console.log("Error fetching history data:", error);
                return [];
            }
        },
        enabled: !!userId,
    });

    const dataAvailable =
        historyDataQuery.data && historyDataQuery.data.length > 0;

    return (
        <div className='px-8'>
            <Card className='col-span-12 mt-2 w-full transition-all duration-300 ease-in-out'>
                <CardHeader className='gap-2'>
                    <CardTitle className='grid grid-flow-row justify-between gap-2 md:grid-flow-col transition-colors duration-200'>
                        <HistoryPeriodSelector
                            period={period}
                            setPeriod={setPeriod}
                            timeframe={timeframe}
                            setTimeframe={setTimeframe}
                        />

                        <div className='flex h-10 gap-2'>
                            <Badge
                                variant={"outline"}
                                className='flex items-center gap-2 text-sm'
                            >
                                <div className='h-4 w-4 rounded-full bg-emerald-500'></div>
                                Income
                            </Badge>

                            <Badge
                                variant={"outline"}
                                className='flex items-center gap-2 text-sm'
                            >
                                <div className='h-4 w-4 rounded-full bg-red-500'></div>
                                Expense
                            </Badge>

                            {/* <div className="flex gap-2 ml-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={generateRandomData}
                                >
                                    Generate Test Data
                                </Button>
                                
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={restoreOriginalData}
                                >
                                    Restore Data
                                </Button>
                            </div> */}
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="transition-opacity duration-300 ease-in-out">
                        <SkeletonWrapper isLoading={historyDataQuery.isFetching}>
                            {dataAvailable && (
                                <ResponsiveContainer width={"100%"} height={300}>
                                    <BarChart
                                        height={300}
                                        data={historyDataQuery.data}
                                        barCategoryGap={5}
                                    >
                                        <defs>
                                            <linearGradient id="incomeBar" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset={"0"} stopColor="#10b981" stopOpacity={"1"} />
                                                <stop offset={"1"} stopColor="#10b981" stopOpacity={"0"} />
                                            </linearGradient>

                                            <linearGradient id="expenseBar" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset={"0"} stopColor="#ef4444" stopOpacity={"1"} />
                                                <stop offset={"1"} stopColor="#ef4444" stopOpacity={"0"} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid
                                            strokeDasharray="5 5"
                                            strokeOpacity={"0.2"}
                                            vertical={false}
                                        />
                                        <XAxis
                                            stroke="#888888"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            padding={{ left: 5, right: 5 }}
                                            dataKey={(data) => {
                                                const { year, month, day } = data;
                                                const date = new Date(year, month, day || 1);
                                                if (timeframe === "year") {
                                                    return date.toLocaleDateString("default", {
                                                        month: "long",
                                                    });
                                                }
                                                return date.toLocaleDateString("default", {
                                                    day: "2-digit",
                                                });
                                            }}
                                        />
                                        <YAxis
                                            stroke="#888888"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <Bar
                                            dataKey={"income"}
                                            label="Income"
                                            fill="url(#incomeBar)"
                                            radius={4}
                                            className="cursor-pointer"
                                        />
                                        <Bar
                                            dataKey={"expense"}
                                            label="Expense"
                                            fill="url(#expenseBar)"
                                            radius={4}
                                            className="cursor-pointer"
                                        />
                                        <Tooltip cursor={{ opacity: 0.1 }} content={props => (
                                            <CustomTooltip formatter={formatter} {...props} />
                                        )} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                            {!dataAvailable && (
                                <Card className="flex h-[300px] flex-col items-center justify-center bg-background">
                                    No data for the selected period
                                    <p className="text-sm text-muted-foreground">
                                        Try selecting a different period or adding new transactions
                                    </p>
                                </Card>
                            )}
                        </SkeletonWrapper>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default History

function CustomTooltip({ active, payload, formatter }: any) {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    const { expense, income } = data;

    return (
        <div className="min-w-[300px] rounded border bg-background p-4">
            <TooltipRow formatter={formatter} label="Expense" value={expense} bgColor="bg-red-500" textColor="text-red-500" />
            <TooltipRow formatter={formatter} label="Income" value={income} bgColor="bg-emeral-500" textColor="text-emerald-500" />
            <TooltipRow formatter={formatter} label="Balance" value={income - expense} bgColor="bg-gray-100" textColor="text-foreground" />

        </div>
    );
}

function TooltipRow({
    label,
    value,
    bgColor,
    textColor,
    formatter,
}: {
    label: string;
    textColor: string;
    bgColor: string;
    value: number;
    formatter: Intl.NumberFormat;
}) {
    const formattingFn = useCallback((value: number) => {
        return formatter.format(value);
    },
        [formatter]
    );
    return (
        <div className="flex items-center gap-2">
            <div className={cn("h-4 w-4 rounded-full", bgColor)} />
            <div className="flex w-full justify-between">
                <p className="text-sm text-muted-foreground">{label}</p>
                <div className={cn("text-sm font-bold", textColor)}>
                    <CountUp
                        duration={0.5}
                        preserveValue
                        end={value}
                        decimals={0}
                        formattingFn={formattingFn}
                        className="text-sm"
                    />
                </div>
            </div>
        </div>
    );
}