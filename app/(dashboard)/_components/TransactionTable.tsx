"use client";
import { getTransactionsHistoryResponseType } from '@/app/api/transactions-history/route';
import { DateToUTCDate } from '@/lib/helpers';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react'
import {
    ColumnDef,
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
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
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { DropdownMenuContent, DropdownMenuLabel } from '@radix-ui/react-dropdown-menu';
import { TrashIcon } from '@radix-ui/react-icons';
import DeleteTransactionDialog from './DeleteTransactionDialog';
import UpdateTransactionDialog from './UpdateTransactionDialog';
import { MoreHorizontal, Pencil, Trash } from 'lucide-react';
import { DataTableFacetedFilter } from '@/components/datatable/FacetedFilters';
import { DataTableViewOptions } from '@/components/datatable/ColumnToggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
    from: Date;
    to: Date;
}

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
        cell: ({ row }) => <RowActions transaction={row.original} />,
    }
];

function TransactionTable({ from, to }: Props) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>
    ([]);
    const queryClient = useQueryClient();

    const history = useQuery<getTransactionsHistoryResponseType>({
        queryKey: ["transactions", from, to],
        queryFn: () =>
            fetch(
                `/api/transactions-history?from=${DateToUTCDate(
                    from
                )}&to=${DateToUTCDate(to)}`
            ).then((res) => res.json()),
        // Add this option to improve responsiveness
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // Function to manually trigger a refresh
    const refreshData = () => {
        history.refetch();
        queryClient.invalidateQueries({ queryKey: ["overview"] });
    };

    const table = useReactTable({
        data: history.data || emptyData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        initialState: {
            pagination: {
                pageSize: 5
            }
        },
        state: {
            sorting,
            columnFilters,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    })

    const categoriesOptions = useMemo(() => {
        const categoriesMap = new Map();
        history.data?.forEach((transaction) => {
            categoriesMap.set(transaction.category, {
                value: transaction.category,
                label: `${transaction.categoryIcon} ${transaction.category}`,
            });
        });
        const uniqueCategories = new Set(categoriesMap.values());
        return Array.from(uniqueCategories);
    }, [history.data]);

    // Add these functions in your TransactionTable component:
    const generateRandomTransactionData = () => {
        const categories = [
            { name: "Food", icon: "🍔" },
            { name: "Transportation", icon: "🚗" },
            { name: "Entertainment", icon: "🎬" },
            { name: "Shopping", icon: "🛍️" },
            { name: "Health", icon: "🏥" },
            { name: "Education", icon: "📚" },
            { name: "Salary", icon: "💰" },
            { name: "Investment", icon: "📈" }
        ];
        
        const transactions = Array.from({ length: 50 }, (_, i) => {
            const isExpense = Math.random() > 0.3;
            const categoryIndex = Math.floor(Math.random() * (isExpense ? 6 : 2) + (isExpense ? 0 : 6));
            const category = categories[Math.min(categoryIndex, categories.length - 1)];
            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * 30));
            const amount = Math.floor(Math.random() * (isExpense ? 500 : 5000) + 10);
            
            return {
                id: `demo-${i}`,
                amount: amount,
                formattedAmount: isExpense ? `-$${amount}` : `$${amount}`,
                type: isExpense ? "expense" : "income",
                category: category.name,
                categoryIcon: category.icon,
                description: isExpense 
                    ? ["Groceries", "Lunch", "Dinner", "Coffee", "Bus ticket", "Movie tickets"][Math.floor(Math.random() * 6)]
                    : ["Monthly salary", "Freelance work", "Dividend", "Bonus"][Math.floor(Math.random() * 4)],
                date: date
            };
        });
        
        // Sort by date, newest first
        transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
        
        // Update the query data directly
        queryClient.setQueryData(["transactions", from, to], transactions);
    };

    const restoreTransactionData = () => {
        // Invalidate the query to trigger a refetch
        queryClient.invalidateQueries({
            queryKey: ["transactions", from, to]
        });
    };

    return (
        <div className='w-full'>
            <div className="flex justify-end mb-4">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={generateRandomTransactionData}
                    className="mr-2"
                >
                    Generate Test Data
                </Button>
                
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={restoreTransactionData}
                >
                    Restore Data
                </Button>
            </div>
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
                                { label: "Income", value: "income"},
                                { label: "Expense", value: "expense"},
                            ]}
                        />
                    )}
                </div>
                <div className='flex flex-wrap gap-2'>
                    <DataTableViewOptions table={table} />
                </div>
            </div>
            <SkeletonWrapper isLoading={history.isFetching}>
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
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        No results.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="flex items-center justify-end space-x-2 py-4">
                    <div className="flex-1 text-sm text-muted-foreground">
                        Showing {table.getRowModel().rows.length} of{" "}
                        {history.data?.length || 0} entries
                    </div>
                    <div className="flex items-center space-x-2">
                        <Select
                            value={`${table.getState().pagination.pageSize}`}
                            onValueChange={(value) => {
                                table.setPageSize(Number(value))
                            }}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue placeholder={table.getState().pagination.pageSize} />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {[5, 10, 20, 30, 50].map((pageSize) => (
                                    <SelectItem key={pageSize} value={`${pageSize}`}>
                                        {pageSize}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            Next
                        </Button>
                    </div>
                </div>
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
                    <DropdownMenuItem
                        onClick={() => setShowUpdateDialog(true)}
                    >
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
        </>
    );
}