"use client";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CreateTransactionSchema, CreateTransactionSchemaType } from "@/schema/transation";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import CategoryPicker from "./CategoryPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DateToUTCDate } from "@/lib/helpers";
import { useUser } from "@clerk/nextjs"; // Add this import to get the current user

// Define the type that was previously in your server action
type UpdateTransactionParams = CreateTransactionSchemaType & {
  id: string;
};

interface Props {
    open: boolean;
    setOpen: (open: boolean) => void;
    transaction: any; // Update with your transaction type
}

function UpdateTransactionDialog({ open, setOpen, transaction }: Props) {
    const { user } = useUser(); // Add this to get the current user
    
    const form = useForm<CreateTransactionSchemaType>({
        resolver: zodResolver(CreateTransactionSchema),
        defaultValues: {
            type: transaction.type,
            date: new Date(transaction.date),
            description: transaction.description,
            amount: transaction.amount,
            category: transaction.category,
        }
    });

    const handleCategoryChange = useCallback((value: string) => {
        form.setValue("category", value);
    }, [form]);

    const queryClient = useQueryClient();

    // Update the mutation function to use the API
    const { mutate, isPending } = useMutation({
        mutationFn: async (values: UpdateTransactionParams) => {
            const response = await fetch(`/api/transactions?userId=${user?.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    // For external frontend: 'Authorization': 'Bearer your-secure-api-key'
                },
                body: JSON.stringify(values)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to update transaction");
            }

            return response.json();
        },
        // Rest of your mutation configuration remains the same
        onSuccess: async () => {
            toast.success("Transaction updated!", {
                id: "update-transaction",
            });

            // More comprehensive query invalidation with forced refetching
            await queryClient.refetchQueries({
                queryKey: ["transactions"],
            });

            await queryClient.refetchQueries({
                queryKey: ["overview"],
            });

            await queryClient.refetchQueries({
                queryKey: ["history-data"],
            });

            // Clear the entire cache for maximum reliability
            await queryClient.invalidateQueries();

            // Close the dialog after all updates are complete
            setOpen(false);
        },
        onError: (error) => {
            toast.error(`Failed to update transaction: ${error.message}`, {
                id: "update-transaction"
            });
        }
    });

    const onSubmit = useCallback((values: CreateTransactionSchemaType) => {
        // Check if category is selected
        if (!values.category) {
            toast.error("Please select a category");
            return;
        }

        toast.loading("Updating transaction...", {
            id: "update-transaction"
        });

        mutate({
            id: transaction.id,
            ...values,
            date: DateToUTCDate(values.date),
        });
    }, [mutate, transaction.id]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[495px]">
                <DialogHeader>
                    <DialogTitle>
                        Update{" "}
                        <span
                            className={cn(
                                "m-1",
                                transaction.type === "income" ? "text-emerald-500" : "text-rose-500"
                            )}
                        >transaction</span>
                    </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form className='space-y-4' onSubmit={form.handleSubmit(onSubmit)}>
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter description" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Transaction description (optional)
                                    </FormDescription>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount</FormLabel>
                                    <FormControl>
                                        <Input 
                                            type="number"
                                            placeholder="0"
                                            {...field}
                                            onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Transaction amount (required)
                                    </FormDescription>
                                </FormItem>
                            )}
                        />

                        <div className="flex items-start justify-between gap-2">
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Category<span className="text-red-500">*</span></FormLabel>
                                        <CategoryPicker 
                                            value={field.value}
                                            onChange={handleCategoryChange}
                                            type={form.getValues("type")}
                                        />
                                        {!field.value && (
                                            <p className="text-sm font-medium text-destructive">
                                                Category is required
                                            </p>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-[240px] pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? (
                                                            format(field.value, "PPP")
                                                        ) : (
                                                            <span>Pick a date</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) =>
                                                        date > new Date() || date < new Date("1900-01-01")
                                                    }
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormDescription>
                                            Select a date for the transaction
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </form>
                </Form>
                <DialogFooter>
                    <Button
                        type='button'
                        variant={"secondary"}
                        onClick={() => setOpen(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type='button'
                        onClick={form.handleSubmit(onSubmit)}
                        disabled={isPending}>
                        {!isPending && "Update"}
                        {isPending && <Loader2 className='animate-spin' />}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default UpdateTransactionDialog;