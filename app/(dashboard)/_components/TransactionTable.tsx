"use client";
import { DateToUTCDate } from '@/lib/helpers';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState, useRef, useCallback } from 'react'
import {
    ColumnDef,
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import SkeletonWrapper from '@/components/SkeletonWrapper';
import { DataTableColumnHeader } from '@/components/datatable/ColumnHeader';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TrashIcon } from '@radix-ui/react-icons';
import DeleteTransactionDialog from './DeleteTransactionDialog';
import UpdateTransactionDialog from './UpdateTransactionDialog';
import { MoreHorizontal, Pencil, Trash, RefreshCw } from 'lucide-react';
import { DataTableFacetedFilter } from '@/components/datatable/FacetedFilters';
import { DataTableViewOptions } from '@/components/datatable/ColumnToggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useInView } from 'react-intersection-observer';
import { useDataRefresh } from '../_hooks/useDataRefresh';
import { useNetwork } from '../_context/NetworkStatusProvider';
import {
    DropdownMenu,
    DropdownMenuItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { notifyManager } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/constants';
import { useAuth } from '@clerk/nextjs';
import { offlineStorage } from '@/lib/offlineStorage';
import { syncService } from '@/lib/syncService';

interface Props {
    from: Date;
    to: Date;
}

export type getTransactionsHistoryResponseType = Awaited<
    ReturnType<typeof getTransactionsHistory>
>;

const emptyData: any[] = [];
type TransactionHistoryRow = getTransactionsHistoryResponseType[0];

export const columns: ColumnDef<TransactionHistoryRow>[] = [
    {
        accessorKey: "category",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Category" />
        ),
        filterFn: (row, id, value) => {
            return value.includes(row.getValue(id));
        },
        cell: ({ row }) => (
            <div className='flex gap-2 capitalize'>
                {row.original.categoryIcon}
                <div className='capitalize'>{row.original.category}</div>
            </div>
        )
    },
    {
        accessorKey: "description",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Description" />
        ),
        cell: ({ row }) => (
            <div className='capitalize'>
                {row.original.description}
            </div>
        )
    },
    {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => {
            const date = new Date(row.original.date);
            const formattedDate = date.toLocaleDateString("default", {
                timeZone: "UTC",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            })
            return <div className='text-muted-foreground'>
                {formattedDate}
            </div>
        },
    },
    {
        accessorKey: "type",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Type" />
        ),
        filterFn: (row, id, value) => {
            return value.includes(row.getValue(id));
        },
        cell: ({ row }) => (
            <div className={cn('capitalize rounded-lg text-center p-2',
                row.original.type === "income" && "bg-emerald-400/10 text-emerald-500",
                row.original.type === "expense" && "bg-rose-400/10 text-rose-500"
            )}>
                {row.original.type}
            </div>
        )
    },
    {
        accessorKey: "amount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Amount" />
        ),
        cell: ({ row }) => (
            <p className="text-md rounded-lg bg-gray-400/5 p-2 text-center font-medium">
                {row.original.formattedAmount}
            </p>
        )
    },
    {
        id: "actions",
        enableHiding: false,
        header: () => <div className="text-right">Actions</div>, // Changed to right-aligned div
        cell: ({ row }) => <RowActions transaction={row.original} />,
    }
];

function TransactionTable({ from, to }: Props) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [newTransactions, setNewTransactions] = useState<any[]>([]);
    const queryClient = useQueryClient();
    const { ref, inView } = useInView();
    const { refreshAllData } = useDataRefresh();
    const { userId } = useAuth();
    const { isOnline } = useNetwork();

    const ITEMS_PER_PAGE = 25; // Set a larger page size for better performance

    // Modify the useInfiniteQuery call:
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isFetching,
        refetch
    } = useInfiniteQuery({
        queryKey: ["transactions", from, to, userId],
        queryFn: async ({ pageParam = 1 }) => {
            if (!userId) return Promise.reject("No user ID available");

            try {
                // Try to fetch from server if online
                if (isOnline) {
                    const res = await fetch(`${API_BASE_URL}/api/transactions-history?userId=${userId}&page=${pageParam}&from=${DateToUTCDate(from)}&to=${DateToUTCDate(to)}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer your-secure-api-key'
                        }
                    });
                    
                    const serverData = await res.json();
                    
                    // Cache for offline use
                    if (pageParam === 1) {
                        offlineStorage.cacheTransactions(serverData.data, userId);
                    }
                    
                    return serverData;
                } else {
                    // Use cached transactions when offline
                    const cachedTransactions = offlineStorage.getCachedTransactions(userId);
                    
                    // Use the standardized date filtering method
                    const filteredTransactions = offlineStorage.filterTransactionsByDateRange(
                        cachedTransactions,
                        from,
                        to
                    );
                    
                    // Sort by date (newest first)
                    filteredTransactions.sort((a, b) => 
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    );
                    
                    // Paginate results
                    const pageSize = 25;
                    const startIndex = (pageParam - 1) * pageSize;
                    const pageData = filteredTransactions.slice(startIndex, startIndex + pageSize);
                    
                    return {
                        data: pageData,
                        pagination: {
                            page: pageParam,
                            pages: Math.ceil(filteredTransactions.length / pageSize),
                            total: filteredTransactions.length
                        }
                    };
                }
            } catch (error) {
                console.log("Error fetching transactions:", error);
                
                // Fallback to cache if fetch fails
                const cachedTransactions = offlineStorage.getCachedTransactions(userId);
                
                // Apply same filtering and pagination as above
                const fromDate = new Date(from);
                const toDate = new Date(to);
                
                const filteredTransactions = cachedTransactions.filter(tx => {
                    const txDate = new Date(tx.date);
                    return txDate >= fromDate && txDate <= toDate;
                });
                
                filteredTransactions.sort((a, b) => 
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                );
                
                const pageSize = 25;
                const startIndex = (pageParam - 1) * pageSize;
                const pageData = filteredTransactions.slice(startIndex, startIndex + pageSize);
                
                return {
                    data: pageData,
                    pagination: {
                        page: pageParam,
                        pages: Math.ceil(filteredTransactions.length / pageSize),
                        total: filteredTransactions.length
                    }
                };
            }
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            if (!lastPage.pagination) return undefined;
            
            const { page, pages } = lastPage.pagination;
            return page < pages ? page + 1 : undefined;
        },
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
        enabled: !!userId,
    });

    // Function to manually trigger a refresh
    const refreshData = () => {
        refetch();
        queryClient.invalidateQueries({ queryKey: ["overview"] });
    };

    // Combine all pages of transactions into a single array
    const transactions = useMemo(() => {
        return data?.pages.flatMap((page) => page.data || page) || [];
    }, [data]);

    const table = useReactTable({
        data: transactions || emptyData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        state: {
            sorting,
            columnFilters,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    const categoriesOptions = useMemo(() => {
        const categoriesMap = new Map();
        transactions?.forEach((transaction) => {
            categoriesMap.set(transaction.category, {
                value: transaction.category,
                label: `${transaction.categoryIcon} ${transaction.category}`,
            });
        });
        const uniqueCategories = new Set(categoriesMap.values());
        return Array.from(uniqueCategories);
    }, [transactions]);

    const restoreTransactionData = () => {
        // Invalidate the query to trigger a refetch
        queryClient.invalidateQueries({
            queryKey: ["transactions", from, to]
        });
    };

    const generateStreamingTransactions = async () => {
        toast.loading("Generating transactions in real-time...", {
            id: "generate-transactions",
            duration: Infinity,
        });

        setIsGenerating(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/transactions/generate?userId=${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer your-secure-api-key'
                },
                body: JSON.stringify({
                    count: 100000,
                    delayMs: 10,
                })
            });

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("Failed to get response reader");
            }

            let done = false;
            const newTransactions = []; // Track all new transactions

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;

                if (value) {
                    const text = new TextDecoder().decode(value);
                    const lines = text.split('\n').filter(Boolean);

                    for (const line of lines) {
                        const data = JSON.parse(line);

                        if (data.error) {
                            toast.error(`Generation error: ${data.error}`, {
                                id: "generate-transactions"
                            });
                            break;
                        }

                        if (data.complete) {
                            toast.success(`Generated ${data.total || 20} transactions!`, {
                                id: "generate-transactions"
                            });
                            break;
                        }

                        // Update progress toast
                        toast.loading(`Generating transactions: ${data.progress}%`, {
                            id: "generate-transactions"
                        });

                        // If there's a new transaction, update the UI
                        if (data.lastTransaction) {
                            const transactionDate = new Date(data.lastTransaction.date);
                            const fromDate = new Date(from);
                            const toDate = new Date(to);

                            // Only update UI if within date range
                            if (transactionDate >= fromDate && transactionDate <= toDate) {
                                // 1. Update transaction table
                                updateTransactionTable(data.lastTransaction);

                                // 2. Update balance stats
                                updateBalanceStats(data.lastTransaction);

                                // 3. Update history charts
                                updateHistoryData(data.lastTransaction);

                                // 4. Update category stats
                                updateCategoryStats(data.lastTransaction);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            toast.error(`Failed to generate transactions: ${error instanceof Error ? error.message : String(error)}`, {
                id: "generate-transactions"
            });
        } finally {
            setIsGenerating(false);

            // Final refresh to ensure all components are up-to-date
            setTimeout(() => {
                // Force a complete refresh of all stats
                queryClient.refetchQueries({
                    queryKey: ["overview", "stats"],
                    type: 'all'
                });

                // Explicit refresh for StatsCards
                queryClient.refetchQueries({
                    queryKey: ["overview", "stats", from, to],
                    exact: true
                });

                // Explicit refresh for CategoriesStats
                queryClient.refetchQueries({
                    queryKey: ["overview", "stats", "categories", from, to],
                    exact: true
                });

                // Add explicit refresh for History data - both timeframes
                queryClient.refetchQueries({
                    queryKey: ["overview", "history"],
                    type: 'all'
                });

                // Get current history state from session storage to refresh exact view
                const currentStateStr = sessionStorage.getItem('historyState');
                if (currentStateStr) {
                    try {
                        const { timeframe, period } = JSON.parse(currentStateStr);
                        queryClient.refetchQueries({
                            queryKey: ["overview", "history", timeframe, period],
                            exact: true
                        });
                    } catch (e) {
                        console.error('Error refreshing history data', e);
                    }
                }

                toast.success("All statistics updated", {
                    id: "stats-update",
                    duration: Infinity
                });
            }, 500); // Increased timeout for better reliability
        }
    };

    // Helper functions for cleaner organization

    // Define a type for the transaction object used in update functions
    type TransactionUpdateItem = {
        id?: string;
        date: string | Date;
        type: "income" | "expense";
        amount: number;
        category: string;
        categoryIcon?: string;
        description?: string;
    };

    function updateTransactionTable(transaction: TransactionUpdateItem) {
        // Format the amount before adding to the table
        const formattedTransaction = {
            ...transaction,
            formattedAmount: new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2
            }).format(transaction.amount)
        };
        
        // Update the transaction data in the cache
        queryClient.setQueryData(["transactions", from, to, userId], (oldData: any) => {
            if (!oldData || !oldData.pages || !oldData.pages.length) {
                // If there's no existing data, create a new structure
                return {
                    pages: [{
                        data: [formattedTransaction],
                        pagination: { page: 1, pages: 1, total: 1 }
                    }]
                };
            }

            // Create updated first page with the new transaction at the top
            const updatedFirstPage = {
                ...oldData.pages[0],
                data: [formattedTransaction, ...oldData.pages[0].data],
                pagination: {
                    ...oldData.pages[0].pagination,
                    total: (oldData.pages[0].pagination?.total || 0) + 1
                }
            };

            return {
                ...oldData,
                pages: [updatedFirstPage, ...oldData.pages.slice(1)]
            };
        });

        // Track as a new transaction for animation
        setNewTransactions(prev => [...prev, formattedTransaction]);
        
        // Clear animation after delay
        setTimeout(() => {
            setNewTransactions(prev => prev.filter(t => t.id !== transaction.id));
        }, 2000);

        // Check if we're offline before refreshing related stats
        if (!isOnline) {
            // When offline, only mark as stale without triggering refetches
            queryClient.invalidateQueries({
                queryKey: ["transactions", from, to, userId],
                exact: true,
                refetchType: 'none'
            });
        } else {
            // Original refetch behavior for online mode
            setTimeout(() => {
                queryClient.invalidateQueries({
                    queryKey: ["transactions", from, to, userId],
                    exact: true,
                    refetchType: 'none'
                });
            }, 0);
            
            // Update other stats/queries
            updateBalanceStats(transaction);
            updateCategoryStats(transaction);
        }
    }

    function updateBalanceStats(transaction: TransactionUpdateItem) {
        // Update balance and expense/income stats
        queryClient.setQueryData(
            ["overview", "stats", from, to],
            (oldData: any) => {
                if (!oldData) return oldData;

                const updatedStats = { ...oldData };
                const isExpense = transaction.type === "expense";
                const amount = transaction.amount;

                if (isExpense) {
                    updatedStats.expense = (updatedStats.expense || 0) + amount;
                } else {
                    updatedStats.income = (updatedStats.income || 0) + amount;
                }

                // Calculate updated balance
                updatedStats.balance = (updatedStats.income || 0) - (updatedStats.expense || 0);

                return updatedStats;
            }
        );

        // Add this critical part - force immediate update just like in History
        notifyManager.schedule(() => {
            queryClient.invalidateQueries({
                queryKey: ["overview", "stats", from, to],
                exact: true,
                refetchType: 'none'
            });

            setTimeout(() => {
                queryClient.refetchQueries({
                    queryKey: ["overview", "stats", from, to],
                    exact: true
                });
            }, 10);
        });
    }

    // 1. Update the updateCategoryStats function
    function updateCategoryStats(transaction: TransactionUpdateItem) {
        const categoryStats = queryClient.getQueryData([
            "overview", "stats", "categories", from, to
        ]);

        if (categoryStats && Array.isArray(categoryStats)) {
            const updatedCategoryStats = [...categoryStats];
            const isExpense = transaction.type === "expense";
            const category = transaction.category;
            const categoryIcon = transaction.categoryIcon || "💰";
            const amount = transaction.amount;

            // Find if this category exists
            const categoryIndex = updatedCategoryStats.findIndex(stat =>
                stat.category === category && stat.type === transaction.type
            );

            if (categoryIndex >= 0) {
                // Update existing category
                updatedCategoryStats[categoryIndex] = {
                    ...updatedCategoryStats[categoryIndex],
                    _sum: {
                        amount: (updatedCategoryStats[categoryIndex]._sum?.amount || 0) + amount
                    }
                };
            } else {
                // Add new category
                updatedCategoryStats.push({
                    category: category,
                    categoryIcon: categoryIcon,
                    type: transaction.type,
                    _sum: {
                        amount: amount
                    }
                });
            }

            // Update the cache
            queryClient.setQueryData(
                ["overview", "stats", "categories", from, to],
                updatedCategoryStats
            );

            // Force immediate update
            notifyManager.schedule(() => {
                queryClient.invalidateQueries({
                    queryKey: ["overview", "stats", "categories", from, to],
                    exact: true,
                    refetchType: 'none'
                });

                // Add this - direct refresh right after
                setTimeout(() => {
                    queryClient.refetchQueries({
                        queryKey: ["overview", "stats", "categories", from, to],
                        exact: true
                    });
                }, 10);
            });
        }
    }

    function updateHistoryData(transaction: TransactionUpdateItem) {
        const transactionDate = new Date(transaction.date);
        const transactionYear = transactionDate.getFullYear();
        const transactionMonth = transactionDate.getMonth();
        const transactionDay = transactionDate.getDate();
        const isExpense = transaction.type === "expense";
        const amount = transaction.amount;

        // Update monthly history data
        const monthlyPeriod = { month: transactionMonth, year: transactionYear };
        queryClient.setQueryData(
            ["overview", "history", "month", monthlyPeriod],
            (oldData: any) => {
                if (!oldData || !Array.isArray(oldData)) return oldData;

                const updatedData = [...oldData];
                const dayIndex = updatedData.findIndex(item =>
                    item.day === transactionDay
                );

                if (dayIndex >= 0) {
                    // Update existing day
                    updatedData[dayIndex] = {
                        ...updatedData[dayIndex],
                        expense: isExpense
                            ? (updatedData[dayIndex].expense || 0) + amount
                            : updatedData[dayIndex].expense || 0,
                        income: !isExpense
                            ? (updatedData[dayIndex].income || 0) + amount
                            : updatedData[dayIndex].income || 0
                    };
                } else {
                    // Add new day entry
                    updatedData.push({
                        day: transactionDay,
                        month: transactionMonth,
                        year: transactionYear,
                        expense: isExpense ? amount : 0,
                        income: !isExpense ? amount : 0
                    });
                }

                return updatedData;
            }
        );

        // Update yearly history data
        const yearlyPeriod = { year: transactionYear };
        queryClient.setQueryData(
            ["overview", "history", "year", yearlyPeriod],
            (oldData: any) => {
                if (!oldData || !Array.isArray(oldData)) return oldData;

                const updatedData = [...oldData];
                const monthIndex = updatedData.findIndex(item =>
                    item.month === transactionMonth && item.year === transactionYear
                );

                if (monthIndex >= 0) {
                    // Update existing month
                    updatedData[monthIndex] = {
                        ...updatedData[monthIndex],
                        expense: isExpense
                            ? (updatedData[monthIndex].expense || 0) + amount
                            : updatedData[monthIndex].expense || 0,
                        income: !isExpense
                            ? (updatedData[monthIndex].income || 0) + amount
                            : updatedData[monthIndex].income || 0
                    };
                } else {
                    // Add new month entry
                    updatedData.push({
                        month: transactionMonth,
                        year: transactionYear,
                        expense: isExpense ? amount : 0,
                        income: !isExpense ? amount : 0
                    });
                }

                return updatedData;
            }
        );
    }

    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

    useEffect(() => {
        if (!hasNextPage || isFetchingNextPage) return;

        const handleScroll = () => {
            const scrollPosition = window.scrollY;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;

            // If user has scrolled 70% down the page, prefetch next page
            if (scrollPosition > 0 && (scrollPosition + windowHeight) / documentHeight > 0.5) {
                console.log("Prefetching next page of transactions");
                fetchNextPage();
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Add this effect to listen for new transactions

    useEffect(() => {
        // Listen for new transactions added from other components
        const handleNewTransaction = (event: any) => {
            const { transaction } = event.detail;
            if (transaction) {
                // Use the same function we use in other parts of the app
                updateTransactionTable(transaction);
                
                // Only update relevant stats when online
                if (isOnline) {
                    updateBalanceStats(transaction);
                    updateCategoryStats(transaction);
                    updateHistoryData(transaction);
                }
            }
        };
        
        window.addEventListener('newTransaction', handleNewTransaction);
        
        return () => {
            window.removeEventListener('newTransaction', handleNewTransaction);
        };
    }, [isOnline]);

    // Add a new useEffect for handling transaction updates

    useEffect(() => {
        // Listen for transaction updates from other components
        const handleUpdateTransaction = (event: any) => {
            const { transaction } = event.detail;
            if (transaction) {
                // Update the transaction in the table
                updateExistingTransaction(transaction);
                
                // Only update relevant stats when online
                if (isOnline) {
                    // These might need adjustment based on how your stats depend on transaction changes
                    updateBalanceStats(transaction);
                    updateCategoryStats(transaction);
                    updateHistoryData(transaction);
                }
            }
        };
        
        window.addEventListener('updateTransaction', handleUpdateTransaction);
        
        return () => {
            window.removeEventListener('updateTransaction', handleUpdateTransaction);
        };
    }, [isOnline]);

    // Add this new helper function for updating existing transactions
    function updateExistingTransaction(transaction: TransactionUpdateItem) {
        // Update the transaction data in the cache
        queryClient.setQueryData(["transactions", from, to, userId], (oldData: any) => {
            if (!oldData || !oldData.pages || !oldData.pages.length) {
                return oldData;
            }

            // Update transaction in all pages
            const updatedPages = oldData.pages.map((page: any) => {
                const updatedData = page.data.map((t: any) => 
                    t.id === transaction.id ? transaction : t
                );
                
                return {
                    ...page,
                    data: updatedData
                };
            });

            return {
                ...oldData,
                pages: updatedPages
            };
        });

        // Check if we're offline before refreshing related stats
        if (!isOnline) {
            // When offline, only mark as stale without triggering refetches
            queryClient.invalidateQueries({
                queryKey: ["transactions", from, to, userId],
                exact: true,
                refetchType: 'none'
            });
        } else {
            // Original refetch behavior for online mode
            setTimeout(() => {
                queryClient.invalidateQueries({
                    queryKey: ["transactions", from, to, userId],
                    exact: true,
                    refetchType: 'none'
                });
            }, 0);
        }
    }

    // Add this memoized rows to improve performance
    const memoizedRows = useMemo(() => {
        return table.getRowModel().rows.map((row) => {
            const isNewTransaction = newTransactions.some(t => t.id === row.original?.id);
            const isPendingSync = row.original?._pendingAdd || row.original?._pendingUpdate;
            
            // Add null check before calling startsWith
            const isTempTransaction = row.original?.id 
                ? row.original.id.startsWith('temp-') 
                : false;
            
            return (
                <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    data-pending={isPendingSync ? "true" : "false"}
                    data-temp={isTempTransaction ? "true" : "false"}
                    className={`
                        ${isNewTransaction ? "animate-in slide-in-from-top-2 duration-300" : ""} 
                        ${isPendingSync ? "bg-yellow-50/30" : ""}
                        ${isTempTransaction ? "bg-amber-50/20" : ""}
                        ${isPendingSync || isTempTransaction ? "relative" : ""}
                    `}
                >
                    {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="transition-colors duration-200">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                    ))}
                    {isPendingSync && (
                        <style jsx>{`
                            tr[data-pending="true"]::after {
                                content: "";
                                position: absolute;
                                right: 4px;
                                top: 4px;
                                height: 8px;
                                width: 8px;
                                border-radius: 9999px;
                                background-color: rgb(250 204 21);
                                animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                            }
                            @keyframes pulse {
                                0%, 100% {
                                    opacity: 1;
                                }
                                50% {
                                    opacity: 0.5;
                                }
                            }
                        `}</style>
                    )}
                </TableRow>
            );
        });
    }, [table.getRowModel().rows, newTransactions]);

    // Add a network status listener in TransactionTable
    useEffect(() => {
        const handleNetworkChange = (event: any) => {
            if (event.detail.status === 'online') {
                // When coming back online, check for pending transactions to sync
                const pendingOperations = offlineStorage.getPendingOperations();
                if (pendingOperations.length > 0) {
                    toast.success(`Connected to internet. Syncing ${pendingOperations.length} pending changes...`);
                    // Start sync process
                    if (userId) {
                        syncService.synchronize(userId);
                    } else {
                        syncService.synchronize();
                    }
                }
                
                // Force table refresh
                queryClient.invalidateQueries({ queryKey: ["transactions"] });
            }
        };
        
        window.addEventListener('networkStatusChanged', handleNetworkChange);
        return () => window.removeEventListener('networkStatusChanged', handleNetworkChange);
    }, []);

    // Add this with your other useEffect hooks
    useEffect(() => {
        // Listen for transaction deletions from other components
        const handleDeleteTransaction = (event: any) => {
            const { transactionId } = event.detail;
            if (transactionId) {
                // Update the transaction table by removing the deleted transaction
                queryClient.setQueryData(["transactions", from, to, userId], (oldData: any) => {
                    if (!oldData || !oldData.pages || !oldData.pages.length) {
                        return oldData;
                    }

                    // Filter out the deleted transaction from all pages
                    const updatedPages = oldData.pages.map((page: any) => ({
                        ...page,
                        data: page.data.filter((t: any) => t.id !== transactionId),
                        pagination: {
                            ...page.pagination,
                            total: (page.pagination?.total || 0) - 1
                        }
                    }));

                    return {
                        ...oldData,
                        pages: updatedPages
                    };
                });
            }
        };
        
        window.addEventListener('deleteTransaction', handleDeleteTransaction);
        
        return () => {
            window.removeEventListener('deleteTransaction', handleDeleteTransaction);
        };
    }, [userId, from, to, queryClient]);

    return (
        <div className='w-full'>
            <SkeletonWrapper isLoading={isFetching && !isFetchingNextPage}>
                
                <div className="flex flex-wrap items-end justify-between gap-2 py-4">
                    <div className="flex gap-2">
                        
                        {table.getColumn("category") && (
                            <DataTableFacetedFilter
                                title="Category"
                                column={table.getColumn("category")}
                                options={categoriesOptions}
                            />
                        )}
                        {table.getColumn("type") && (
                            <DataTableFacetedFilter
                                title="Type"
                                column={table.getColumn("type")}
                                options={[
                                    { label: "Income", value: "income" },
                                    { label: "Expense", value: "expense" },
                                ]}
                            />
                        )}
                    </div>
                    <div className='flex flex-wrap gap-2'>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={generateStreamingTransactions}
                        disabled={isGenerating || !isOnline}
                        className="mr-2"
                        title={!isOnline ? "This feature requires server connection" : ""}
                    >
                        {isGenerating ? (
                            <>
                                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
                                Generating...
                            </>
                        ) : !isOnline ? (
                            'Server Offline: Generate Real Transactions'
                        ) : (
                            'Generate Real Transactions'
                        )}
                    </Button>
                        <DataTableViewOptions table={table} />
                    </div>
                </div>
                <SkeletonWrapper isLoading={isFetching && !isFetchingNextPage}>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => {
                                            return (
                                                <TableHead key={header.id}>
                                                    {header.isPlaceholder
                                                        ? null
                                                        : flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext()
                                                        )}
                                                </TableHead>
                                            )
                                        })}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {!data || !data.pages || data.pages.length === 0 || 
                                (data.pages[0].data && data.pages[0].data.length === 0) ? (
                                    <TableRow>
                                        <TableCell colSpan={columns.length} className="text-center py-10 text-muted-foreground">
                                            <p>No transactions found for this period.</p>
                                            <Button 
                                                variant="outline" 
                                                onClick={() => refetch()} 
                                                className="mt-4"
                                            >
                                                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    <>
                                        {memoizedRows}
                                        {/* Replace this busy loading indicator */}
                                        {hasNextPage && (
                                            <TableRow ref={ref}>
                                                <TableCell colSpan={columns.length} className="h-12 text-center">
                                                    {isFetchingNextPage ? (
                                                        <div className="h-8 flex justify-center items-center">
                                                            <div className="animate-pulse text-xs text-muted-foreground">
                                                                Loading more...
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    {/* Replace pagination controls with a status indicator */}
                    <div className="flex items-center justify-between space-x-2 py-4">
                        <div className="flex-1 text-sm text-muted-foreground">
                            Showing {transactions.length} of {
                                // Use the actual length of transactions rather than relying on pagination metadata
                                data?.pages.reduce((total, page) =>
                                    total + (Array.isArray(page.data) ? page.data.length : 0), 0) || 0
                            } entries
                        </div>
                        {/* Optional button to manually load more */}
                        {hasNextPage && (
                            <Button
                                variant="outline"
                                onClick={() => fetchNextPage()}
                                disabled={isFetchingNextPage}
                            >
                                {isFetchingNextPage ? "Loading more..." : "Load more"}
                            </Button>
                        )}
                    </div>
                </SkeletonWrapper>
            </SkeletonWrapper>
        </div>
    )
}

export default TransactionTable

function RowActions({ transaction }: { transaction: TransactionHistoryRow }) {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showUpdateDialog, setShowUpdateDialog] = useState(false);

    return (
        <>
            <DeleteTransactionDialog open={showDeleteDialog} setOpen={setShowDeleteDialog} transactionId={transaction.id} />
            <UpdateTransactionDialog open={showUpdateDialog} setOpen={setShowUpdateDialog} transaction={transaction} />

            {/* Add flex container with justify-end to align content to the right */}
            <div className="flex justify-end px-6">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant={"ghost"} className='h-8 w-8 p-0'>
                            <span className='sr-only'>Open menu</span>
                            <MoreHorizontal className='h-4 w-4' />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setShowUpdateDialog(true)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => setShowDeleteDialog(true)}
                            className="text-red-600"
                        >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </>
    );
}

// Helper function to update current history period
// This will be used within the component where queryClient is available
const updateCurrentHistoryPeriod = (queryClient: any, transaction: any) => {
    // Get current timeframe and period from History component's stored state
    const currentStateStr = typeof window !== 'undefined' ? sessionStorage.getItem('historyState') : null;
    let currentTimeframe = 'month';
    let currentPeriod = { month: new Date().getMonth(), year: new Date().getFullYear() };

    if (currentStateStr) {
        try {
            const currentState = JSON.parse(currentStateStr);
            currentTimeframe = currentState.timeframe || currentTimeframe;
            currentPeriod = currentState.period || currentPeriod;
        } catch (e) {
            console.error('Error parsing history state', e);
        }
    }

    // Update the currently viewed period directly
    queryClient.setQueryData(
        ["overview", "history", currentTimeframe, currentPeriod],
        (oldData: any) => {
            if (!oldData || !Array.isArray(oldData)) return oldData;

            // Update logic similar to your monthly/yearly updates...
            // Modify based on whether we're looking at months or days
            const updatedData = [...oldData];

            // Logic to find and update the right entry
            // This will vary depending on if currentTimeframe is 'month' or 'year'

            return updatedData;
        }
    );
};

/* 
  NOTE: This is example code that should be moved inside the generateStreamingTransactions 
  function where you have access to the queryClient instance.
  
  The following is a standalone example of how to update history data when processing
  a new transaction.
*/

// Example of how to update history data inside the generateStreamingTransactions function
const updateHistoryWithNewTransaction = (queryClient: { getQueryData: (arg0: any[]) => any; setQueryData: (arg0: (string | { month: number; year: number; })[] | (string | { year: number; })[], arg1: any[]) => void; invalidateQueries: (arg0: { queryKey: any[] | (string | { month: number; year: number; })[] | (string | { year: number; })[]; exact: boolean; refetchType: string; }) => void; }, data: { lastTransaction: { date: string | number | Date; type: string; amount: any; }; }, from: any, to: any) => {
    // Get current timeframe and period from History component via sessionStorage
    const currentStateStr = typeof window !== 'undefined' ? sessionStorage.getItem('historyState') : null;
    let currentTimeframe = 'month'; // Default fallback
    let currentPeriod = {
        month: new Date().getMonth(),
        year: new Date().getFullYear()
    };

    if (currentStateStr) {
        try {
            const currentState = JSON.parse(currentStateStr);
            currentTimeframe = currentState.timeframe || currentTimeframe;
            currentPeriod = currentState.period || currentPeriod;
        } catch (e) {
            console.error('Error parsing history state', e);
        }
    }

    // Get transaction info
    const txDate = new Date(data.lastTransaction.date);
    const txYear = txDate.getFullYear();
    const txMonth = txDate.getMonth();
    const txDay = txDate.getDate();
    const isExpense = data.lastTransaction.type === "expense";
    const amount = data.lastTransaction.amount;

    // First handle monthly view
    if (currentTimeframe === 'month') {
        // If we're viewing monthly data and this transaction belongs to that month
        if (txYear === currentPeriod.year && txMonth === currentPeriod.month) {
            // Get the current monthly data for the viewed period
            const monthlyData = queryClient.getQueryData([
                "overview", "history", "month", currentPeriod
            ]);

            if (monthlyData && Array.isArray(monthlyData)) {
                const updatedMonthlyData = [...monthlyData];

                // Find entry for this day
                const dayIndex = updatedMonthlyData.findIndex(entry =>
                    entry.day === txDay
                );

                if (dayIndex >= 0) {
                    // Update existing day entry
                    updatedMonthlyData[dayIndex] = {
                        ...updatedMonthlyData[dayIndex],
                        expense: isExpense
                            ? (updatedMonthlyData[dayIndex].expense || 0) + amount
                            : updatedMonthlyData[dayIndex].expense || 0,
                        income: !isExpense
                            ? (updatedMonthlyData[dayIndex].income || 0) + amount
                            : updatedMonthlyData[dayIndex].income || 0
                    };
                } else {
                    // Add new day entry
                    updatedMonthlyData.push({
                        day: txDay,
                        month: txMonth,
                        year: txYear,
                        expense: isExpense ? amount : 0,
                        income: !isExpense ? amount : 0
                    });
                }

                // Update the cache with modified data
                queryClient.setQueryData(
                    ["overview", "history", "month", currentPeriod],
                    updatedMonthlyData
                );

                // Force immediate update
                notifyManager.schedule(() => {
                    queryClient.invalidateQueries({
                        queryKey: ["overview", "history", "month", currentPeriod],
                        exact: true,
                        refetchType: 'none'
                    });
                });
            }
        }
    }

    // Then handle yearly view
    if (currentTimeframe === 'year') {
        // If we're viewing yearly data and this transaction belongs to that year
        if (txYear === currentPeriod.year) {
            // Get the current yearly data
            const yearlyData = queryClient.getQueryData([
                "overview", "history", "year", { year: currentPeriod.year }
            ]);

            if (yearlyData && Array.isArray(yearlyData)) {
                const updatedYearlyData = [...yearlyData];

                // Find entry for this month
                const monthIndex = updatedYearlyData.findIndex(entry =>
                    entry.month === txMonth && entry.year === txYear
                );

                if (monthIndex >= 0) {
                    // Update existing month entry
                    updatedYearlyData[monthIndex] = {
                        ...updatedYearlyData[monthIndex],
                        expense: isExpense
                            ? (updatedYearlyData[monthIndex].expense || 0) + amount
                            : (updatedYearlyData[monthIndex].expense || 0),
                        income: !isExpense
                            ? (updatedYearlyData[monthIndex].income || 0) + amount
                            : (updatedYearlyData[monthIndex].income || 0)
                    };
                } else {
                    // Add new month entry
                    updatedYearlyData.push({
                        month: txMonth,
                        year: txYear,
                        expense: isExpense ? amount : 0,
                        income: !isExpense ? amount : 0
                    });
                }

                // Update the cache
                queryClient.setQueryData(
                    ["overview", "history", "year", { year: currentPeriod.year }],
                    updatedYearlyData
                );

                // Force immediate update
                notifyManager.schedule(() => {
                    queryClient.invalidateQueries({
                        queryKey: ["overview", "history", "year", { year: currentPeriod.year }],
                        exact: true,
                        refetchType: 'none'
                    });
                });
            }
        }
    }

    // Also update the category stats regardless of date range
    const categoryStats = queryClient.getQueryData([
        "overview", "stats", "categories", from, to
    ]);

    if (categoryStats && Array.isArray(categoryStats)) {
        // Your existing category stats update code
        // ...

        // Force immediate update with notifyManager
        notifyManager.schedule(() => {
            queryClient.invalidateQueries({
                queryKey: ["overview", "stats", "categories", from, to],
                exact: true,
                refetchType: 'none'
            });
        });
    }
}
