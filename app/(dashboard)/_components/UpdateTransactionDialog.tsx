"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import React, { useEffect } from "react";
import { toast } from "sonner";
import CategoryPicker from "./CategoryPicker";
import { DialogClose } from "@radix-ui/react-dialog";
import { Switch } from "@/components/ui/switch";
import { TransactionType } from "@/lib/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/constants";
import { useAuth } from "@clerk/nextjs";
import { z } from "zod";
import { useNetwork } from "../_context/NetworkStatusProvider";
import { offlineStorage } from "@/lib/offlineStorage";
import { CloudOff } from "lucide-react";

const UpdateTransactionSchema = z.object({
    amount: z.coerce.number().min(0, {
        message: "Amount must be greater than 0",
    }),
    category: z.string().min(1, {
        message: "Please select a category",
    }),
    description: z.string().optional(),
    type: z.enum(["income", "expense"]),
});

type UpdateTransactionFormValues = z.infer<typeof UpdateTransactionSchema>;

interface Props {
    open: boolean;
    setOpen: (open: boolean) => void;
    transaction: any;
}

export default function UpdateTransactionDialog({ open, setOpen, transaction }: Props) {
    const { userId } = useAuth();
    const { isOnline } = useNetwork();
    const queryClient = useQueryClient();

    const form = useForm<UpdateTransactionFormValues>({
        resolver: zodResolver(UpdateTransactionSchema),
        defaultValues: {
            amount: 0,
            category: "",
            description: "",
            type: "expense",
        },
    });

    // Set form values when transaction changes
    useEffect(() => {
        if (transaction) {
            form.setValue("amount", transaction.amount);
            form.setValue("category", transaction.category);
            form.setValue("description", transaction.description || "");
            form.setValue("type", transaction.type);
        }
    }, [transaction, form]);

    const updateMutation = useMutation({
        mutationFn: async (values: UpdateTransactionFormValues) => {
            if (!userId || !transaction?.id) {
                throw new Error("Missing required data");
            }

            const toastId = `update-transaction-${Date.now()}`;
            toast.loading("Updating transaction...", { id: toastId });

            try {
                // Always handle temp transactions in offline mode regardless of network state
                if (!isOnline || transaction.id.startsWith('temp-')) {
                    // Handle offline transaction update
                    const formatter = new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                    });

                    // Get category icon
                    const cachedCategories = offlineStorage.getCachedCategories(userId);
                    const category = cachedCategories.find(c => c.name === values.category);
                    const categoryIcon = category?.icon || transaction.categoryIcon || "💰";

                    // Updated transaction with formatting
                    const updatedTransaction = {
                        ...transaction,
                        ...values,
                        categoryIcon,
                        formattedAmount: values.type === 'expense'
                            ? `-${formatter.format(values.amount)}`
                            : formatter.format(values.amount)
                    };

                    // Dispatch custom event for table update
                    const updateTransactionEvent = new CustomEvent('updateTransaction', { 
                        detail: { transaction: updatedTransaction } 
                    });
                    window.dispatchEvent(updateTransactionEvent);

                    // Force immediate cache update
                    const dashboardContext = JSON.parse(localStorage.getItem('dashboardContext') || '{}');
                    const from = dashboardContext.from ? new Date(dashboardContext.from) : new Date();
                    const to = dashboardContext.to ? new Date(dashboardContext.to) : new Date();

                    queryClient.setQueryData(["transactions", from, to, userId], (oldData: any) => {
                        if (!oldData || !oldData.pages || !oldData.pages.length) {
                            return oldData;
                        }

                        const updatedPages = oldData.pages.map((page: any) => {
                            const updatedData = page.data.map((t: any) => 
                                t.id === updatedTransaction.id ? updatedTransaction : t
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

                    // Update in local storage
                    offlineStorage.updateCachedTransaction(transaction.id, updatedTransaction, userId);

                    // Only store pending operation if it's a real transaction (not temp)
                    if (!transaction.id.startsWith('temp-')) {
                        // Store pending operation for later sync
                        offlineStorage.storePendingOperation(
                            'update',
                            `/api/transactions/${transaction.id}`,
                            'PUT',
                            { ...values, id: transaction.id },
                            userId
                        );
                    }

                    setOpen(false);
                    toast.success("Transaction updated (offline mode)", { id: toastId });
                    return updatedTransaction;
                }

                // Add this check before making the API call
                // Always treat temporary IDs as offline updates
                if (transaction.id.startsWith('temp-')) {
                    console.log(`Transaction ${transaction.id} is temporary, updating locally only`);
                    // Handle as if offline  
                    const updatedTransaction = {
                        ...transaction,
                        ...values,
                        _pendingUpdate: true
                    };
                    
                    offlineStorage.updateCachedTransaction(transaction.id, updatedTransaction, userId);
                    
                    // Store pending operation with special flag
                    offlineStorage.storePendingOperation(
                        'update',
                        `/api/transactions/${transaction.id}`,
                        'PUT',
                        { ...values, id: transaction.id, _isTemporary: true },
                        userId
                    );
                    
                    toast.success("Temporary transaction updated", { id: toastId });
                    return updatedTransaction;
                }

                // Online transaction update - only for non-temporary transactions
                console.log(`Updating transaction: ${transaction.id} at ${API_BASE_URL}/api/transactions/${transaction.id}`);
                
                // Add debugging to see what URL is being constructed
                console.log(`Attempting to update transaction at: ${API_BASE_URL}/api/transactions/${transaction.id}?userId=${userId}`);

                // Ensure the URL is properly encoded, especially if transaction.id might contain special characters
                const response = await fetch(`${API_BASE_URL}/api/transactions/${transaction.id}?userId=${userId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer your-secure-api-key'
                    },
                    body: JSON.stringify(values)
                });

                

                if (!response.ok) {
                    let errorText = "";
                    try {
                        // Try to parse as JSON first
                        errorText = await response.text();
                        console.log(`Response status: ${response.status}, content: ${errorText.substring(0, 150)}...`);
                        
                        // Check if response is HTML
                        if (errorText.trim().startsWith("<!DOCTYPE") || 
                            errorText.trim().startsWith("<html") ||
                            errorText.includes("<head>") ||
                            errorText.includes("<body>")) {
                            
                            console.warn(`Server returned HTML for transaction ${transaction.id} - treating as offline update`);
                            toast.error("API endpoint not found, updating locally", { id: toastId });
                            
                            // Handle as if offline
                            const updatedTransaction = {
                                ...transaction,
                                ...values,
                                _pendingUpdate: true
                            };
                            
                            offlineStorage.updateCachedTransaction(transaction.id, updatedTransaction, userId);
                            
                            // Add this transaction to the sync queue for later
                            offlineStorage.storePendingOperation(
                                'update',
                                `/api/transactions/${transaction.id}`,
                                'PUT',
                                { ...values, id: transaction.id },
                                userId
                            );
                            
                            return updatedTransaction;
                        }
                    } catch (parseError) {
                        console.error("Error parsing server response:", parseError);
                    }
                    
                    // If transaction not found, fall back to offline mode
                    if (response.status === 404) {
                        toast.error("Transaction not found on server, updating locally", { id: toastId });
                        
                        // Handle as if offline
                        const updatedTransaction = {
                            ...transaction,
                            ...values,
                            _pendingUpdate: true
                        };
                        
                        offlineStorage.updateCachedTransaction(transaction.id, updatedTransaction, userId);
                        return updatedTransaction;
                    }
                    
                    throw new Error(`Failed to update transaction: ${response.status} - ${errorText}`);
                }

                const data = await response.json();
                toast.success("Transaction updated", { id: toastId });
                return data;
            } catch (error: any) {
                console.error("Error updating transaction:", error);
                toast.error(`Failed to update transaction: ${error.message}`, { id: toastId });
                throw error;
            }
        },
        onSuccess: (data) => {
            // Get current date range from the dashboard
            const dashboardContext = JSON.parse(localStorage.getItem('dashboardContext') || '{}');
            const from = dashboardContext.from ? new Date(dashboardContext.from) : new Date();
            const to = dashboardContext.to ? new Date(dashboardContext.to) : new Date();
            
            // Add this to notify the TransactionTable component about the updated transaction
            const updateTransactionEvent = new CustomEvent('updateTransaction', { 
                detail: { transaction: data } 
            });
            window.dispatchEvent(updateTransactionEvent);
            
            // Update transaction table with proper query key
            queryClient.setQueryData(["transactions", from, to, userId], (oldData: any) => {
                if (!oldData || !oldData.pages || !oldData.pages.length) {
                    return oldData;
                }

                // Create updated pages with the modified transaction
                const updatedPages = oldData.pages.map((page: any) => {
                    // Update the transaction in this page's data array if it exists
                    const updatedData = page.data.map((t: any) => 
                        t.id === data.id ? data : t
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

            // Only invalidate queries if we're online
            if (isOnline) {
                // When online, refresh all data
                queryClient.invalidateQueries({ queryKey: ["transactions"] });
                queryClient.invalidateQueries({ queryKey: ["overview"] });
            } else {
                // When offline, only update the transaction table UI
                // without triggering full refetches of overview/history
                queryClient.invalidateQueries({ 
                    queryKey: ["transactions", from, to, userId],
                    refetchType: 'none' // Don't actually refetch, just mark as stale
                });
            }

            // Close dialog
            setOpen(false);
        },
        onError: (error) => {
            console.error("Error updating transaction:", error);
            setOpen(false);
        }
    });

    function onSubmit(values: UpdateTransactionFormValues) {
        updateMutation.mutate(values);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Update Transaction</DialogTitle>
                    <DialogDescription>
                        Make changes to your transaction.
                    </DialogDescription>
                </DialogHeader>
                
                {!isOnline && (
                    <div className="flex items-center bg-yellow-50 p-2 rounded-md text-yellow-700 text-sm">
                        <CloudOff className="h-4 w-4 mr-2" />
                        <span>You are offline. These changes will sync when you're back online.</span>
                    </div>
                )}
                
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {/* Replace the switch with a simple display of the transaction type */}
                        <div className="flex items-center justify-between rounded-lg border p-3 mb-2 bg-muted/30">
                            <div className="space-y-0.5">
                                <p className="text-sm font-medium">Transaction Type</p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                                form.watch("type") === "income" 
                                    ? "bg-green-100 text-green-800" 
                                    : "bg-red-100 text-red-800"
                            }`}>
                                {form.watch("type") === "income" ? "Income" : "Expense"}
                            </div>
                        </div>

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
                            name="category"
                            render={({ field: { onChange, value } }) => (
                                <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <FormControl>
                                        <CategoryPicker
                                            type={form.watch("type") as TransactionType}
                                            onChange={onChange}
                                            defaultValue={value}
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
                                disabled={updateMutation.isPending}
                            >
                                {updateMutation.isPending ? "Updating..." : "Update Transaction"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}