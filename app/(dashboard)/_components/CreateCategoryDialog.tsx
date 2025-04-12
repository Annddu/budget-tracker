"use client";

import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TransactionType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CreateCategorySchema, CreateCategorySchemaType } from '@/schema/categories';
import { zodResolver } from '@hookform/resolvers/zod';
import { DialogTitle } from '@radix-ui/react-dialog';
import { CircleOff, Loader2, PlusSquare, Plus } from 'lucide-react';
import React, { useCallback } from 'react'
import { useForm } from 'react-hook-form';
import Picker from '@emoji-mart/react';
import data from "@emoji-mart/data";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Category } from '@prisma/client';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { API_BASE_URL } from '@/lib/constants';
import { useAuth } from '@clerk/nextjs';

interface Props {
    type: TransactionType;
}

function CreateCategoryDialog({ type }: Props) {
    const [open, setOpen] = React.useState(false);
    const form = useForm<CreateCategorySchemaType>({
        resolver: zodResolver(CreateCategorySchema),
        defaultValues: {
            type,
            name: "",
            icon: "",
        },
    });

    const queryClient = useQueryClient();
    const theme = useTheme();
    const { userId } = useAuth();

    const { mutate, isPending } = useMutation({
        mutationFn: async (values: CreateCategorySchemaType) => {
            if (!userId) {
                throw new Error("User ID not available");
            }

            console.log("Creating category for userId:", userId);

            try {
                const response = await fetch(`${API_BASE_URL}/api/categories?userId=${userId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer your-secure-api-key'
                    },
                    body: JSON.stringify(values)
                });
                return response.json();
            }
            catch (error) {
                console.log("Error creating category:", error);
                return [];
            }
            
        },
        onSuccess: async (data: Category) => {
            form.reset({
                name: "",
                icon: "",
                type,
            });

            toast.success(`Category ${data.name} created!`, {
                id: "create-category",
            });

            await queryClient.invalidateQueries({
                queryKey: ["categories"],
            });

            setOpen((prev) => !prev);
        },
        onError: (error) => {
            console.error("Error creating category:", error);
            toast.error("Failed to create category", {
                id: "create-category",
            });
        },
    });

    const onSubmit = useCallback(
        (values: CreateCategorySchemaType) => {
            toast.loading("Creating category...", {
                id: "create-category",
            });
            mutate(values);
        },
        [mutate]
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 mb-2 bg-card hover:bg-muted"
                >
                    <Plus className="h-4 w-4" />
                    Create Category
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        Create
                        <span
                            className={cn("m-1",
                                type === "income" ? "text-emerald-500" : "text-rose-500")}
                        >
                            {type}
                        </span>
                        category
                    </DialogTitle>
                    <DialogDescription>
                        Categories are used to group transactions together.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}
                        className='space-y-8'>
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        This is the name of the category.
                                    </FormDescription>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="icon"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Icon</FormLabel>
                                    <FormControl>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className='h-[100px] w-full'
                                                >
                                                    {form.watch("icon") ? (
                                                        <div className='flex flex-col items-center gap-2'>
                                                            <span className='text-5xl' role='img'>
                                                                {field.value}
                                                            </span>
                                                            <p className='text-xs text-muted-foreground'>
                                                                Click to Change
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className='flex flex-col items-center gap-2'>
                                                            <CircleOff className='h-[48px] w-[48px]' />
                                                            <p className='text-xs text-muted-foreground'>
                                                                Click to select
                                                            </p>
                                                        </div>
                                                    )}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className='w-full'>
                                                <Picker
                                                    data={data}
                                                    theme={theme.resolvedTheme}
                                                    onEmojiSelect={(emoji: { native: string }) => {
                                                        field.onChange(emoji.native);
                                                    }}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </FormControl>
                                    {/* <Input defaultValue={""} {...field} /> */}
                                    <FormDescription>
                                        This is the icon that will be displayed next to the category name.
                                    </FormDescription>
                                </FormItem>
                            )}
                        />

                    </form>
                </Form>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button
                            type='button'
                            variant={"secondary"}
                            onClick={() => {
                                form.reset();
                            }}
                        >
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button
                        type='button'
                        onClick={form.handleSubmit(onSubmit)}
                        disabled={isPending}>
                        {!isPending && "Create"}
                        {isPending && <Loader2 className='animate-spin' />}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default CreateCategoryDialog