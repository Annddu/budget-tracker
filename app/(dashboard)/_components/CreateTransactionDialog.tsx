"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import CategoryPicker from "./CategoryPicker";
import { DialogClose } from "@radix-ui/react-dialog";
import { TransactionType } from "@/lib/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/constants";
import { useAuth } from "@clerk/nextjs";
import { z } from "zod";
import { offlineStorage } from "@/lib/offlineStorage";
import { useNetwork } from "../_context/NetworkStatusProvider";
import { CloudOff } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const TransactionSchema = z.object({
    amount: z.coerce.number().min(0, {
        message: "Amount must be greater than 0",
    }),
    category: z.string().min(1, {
        message: "Please select a category",
    }),
    description: z.string().optional(),
    type: z.enum(["income", "expense"]),
    date: z.date().default(new Date()) // Add this line
});

type TransactionFormValues = z.infer<typeof TransactionSchema>;

interface CreateTransactionDialogProps {
    label: string;
    type: 'income' | 'expense';
    buttonClassName?: string;
}

export default function CreateTransactionDialog({ 
    label, 
    type, 
    buttonClassName 
}: CreateTransactionDialogProps) {
    const [open, setOpen] = useState(false);
    const { userId } = useAuth();
    const { isOnline } = useNetwork();
    const queryClient = useQueryClient();
    const [forceUpdateCounter, forceUpdate] = useState(0);

    const form = useForm<TransactionFormValues>({
        resolver: zodResolver(TransactionSchema),
        defaultValues: {
            amount: 0,
            category: "",
            description: "",
            type: type,
            date: new Date(),
        },
    });

    useEffect(() => {
        if (open) {
            form.setValue("type", type);
        }
    }, [open, type, form]);

    useEffect(() => {
        const handleNetworkChange = (event: any) => {
            if (event.detail.status === 'online') {
                // Force re-render to update UI when network comes back
                forceUpdate(prev => prev + 1);
            }
        };
        
        window.addEventListener('networkStatusChanged', handleNetworkChange);
        return () => window.removeEventListener('networkStatusChanged', handleNetworkChange);
    }, []);

    const addMutation = useMutation({
        mutationFn: async (values: TransactionFormValues) => {
            if (!userId) {
                throw new Error("User ID not available");
            }

            const toastId = `add-transaction-${Date.now()}`;
            toast.loading("Adding transaction...", { id: toastId });

            try {
                if (!isOnline) {
                    const formatter = new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                    });

                    const cachedCategories = offlineStorage.getCachedCategories(userId);
                    const category = cachedCategories.find(c => c.name === values.category);
                    const categoryIcon = category?.icon || "💰";

                    const now = new Date();
                    const nowISO = now.toISOString();
                    const newTransaction = {
                        ...values,
                        date: nowISO,
                        userId,
                        formattedAmount: values.type === 'expense'
                            ? `-${formatter.format(values.amount)}`
                            : formatter.format(values.amount),
                        categoryIcon
                    };

                    const tempTransaction = offlineStorage.addTempTransaction(newTransaction, userId);

                    offlineStorage.storePendingOperation(
                        'create',
                        '/api/transactions',
                        'POST',
                        values,
                        userId
                    );

                    // Dispatch custom event for table update
                    const newTransactionEvent = new CustomEvent('newTransaction', { 
                        detail: { transaction: tempTransaction } 
                    });
                    window.dispatchEvent(newTransactionEvent);

                    setOpen(false);
                    toast.success("Transaction added (offline mode)", { id: toastId });
                    return tempTransaction;
                }

                const response = await fetch(`${API_BASE_URL}/api/transactions?userId=${userId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer your-secure-api-key'
                    },
                    body: JSON.stringify(values)
                });

                if (!response.ok) {
                    throw new Error(`Failed to add transaction: ${response.status}`);
                }

                const data = await response.json();
                toast.success("Transaction added", { id: toastId });
                return data;
            } catch (error: any) {
                console.error("Error adding transaction:", error);
                toast.error(`Failed to add transaction: ${error.message}`, { id: toastId });
                throw error;
            }
        },
        onSuccess: (data) => {
            // Get current date range from the dashboard
            const dashboardContext = JSON.parse(localStorage.getItem('dashboardContext') || '{}');
            const from = dashboardContext.from ? new Date(dashboardContext.from) : new Date();
            const to = dashboardContext.to ? new Date(dashboardContext.to) : new Date();
            
            // IMPORTANT: Only dispatch event for ONLINE transactions
            // Offline transactions already dispatched an event in mutationFn
            if (isOnline) {
                // Add this to notify the TransactionTable component about the new transaction
                const newTransactionEvent = new CustomEvent('newTransaction', { 
                    detail: { transaction: data } 
                });
                window.dispatchEvent(newTransactionEvent);
                
                // ONLY update query data for ONLINE transactions
                // For offline, this was handled by the event listener in TransactionTable
                queryClient.setQueryData(["transactions", from, to, userId], (oldData: any) => {
                    // Your existing update logic...
                });
                
                // When online, refresh all data
                queryClient.invalidateQueries({ queryKey: ["transactions"] });
                queryClient.invalidateQueries({ queryKey: ["overview"] });
            } else {
                // When offline, only update the transaction table UI without direct cache manipulation
                // Just mark as stale without triggering refetches
                queryClient.invalidateQueries({ 
                    queryKey: ["transactions", from, to, userId],
                    refetchType: 'none' // Don't actually refetch, just mark as stale
                });
            }

            // Reset form and close dialog
            form.reset({
                amount: 0,
                category: "",
                description: "",
                type: type,
                date: new Date(),
            });
            
            // Dialog should already be closed from mutationFn if offline
            if (isOnline) {
                setOpen(false);
            }
        },
        onError: (error) => {
            console.error("Failed to add transaction:", error);
            setOpen(false);
        }
    });

    function onSubmit(values: TransactionFormValues) {
        addMutation.mutate(values);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className={buttonClassName}>
                    {label}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        Add {type === "income" ? "Income" : "Expense"}
                    </DialogTitle>
                    <DialogDescription>
                        Add a new {type} transaction to your budget tracker.
                    </DialogDescription>
                </DialogHeader>
                
                {!isOnline && (
                    <div className="flex items-center bg-yellow-50 p-2 rounded-md text-yellow-700 text-sm">
                        <CloudOff className="h-4 w-4 mr-2" />
                        <span>You are offline. This transaction will sync when you're back online.</span>
                    </div>
                )}
                
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Enter amount"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Date</FormLabel>
                                    <FormControl>
                                        <div className="grid gap-2">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "justify-start text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {field.value ? format(field.value, "PPP") : "Select date"}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value}
                                                        onSelect={field.onChange}
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field: { onChange, value } }) => (
                                <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <FormControl>
                                        <CategoryPicker
                                            type={form.watch("type") as TransactionType}
                                            onChange={onChange}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Description" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline" type="button" className="mr-2">Cancel</Button>
                            </DialogClose>
                            <Button 
                                type="submit" 
                                disabled={addMutation.isPending}
                                variant={type === "income" ? "default" : "destructive"}
                                className={type === "income" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                            >
                                {addMutation.isPending ? "Adding..." : `Add ${type === "income" ? "Income" : "Expense"}`}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}