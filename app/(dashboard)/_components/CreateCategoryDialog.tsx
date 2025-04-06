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
import { CircleOff, Loader2, PlusSquare } from 'lucide-react';
import React, { useCallback } from 'react'
import { useForm } from 'react-hook-form';
import Picker from '@emoji-mart/react';
import data from "@emoji-mart/data";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Category } from '@prisma/client';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';

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

    const {mutate, isPending} = useMutation({
        mutationFn: async (values: CreateCategorySchemaType) => {
            // For Clerk authenticated version:
            const response = await fetch('/api/categories', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(values)
            });
            
            // For API key version (in your separated frontend):
            // const response = await fetch(`http://localhost:3000/api/categories?userId=${userId}`, {
            //   method: 'POST',
            //   headers: {
            //     'Content-Type': 'application/json',
            //     'Authorization': `Bearer your-secure-api-key`
            //   },
            //   body: JSON.stringify(values)
            // });
            
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.message || 'Failed to create category');
            }
            
            return response.json();
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
        onError: () => {
            toast.error("Something went wrong", {
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
                    variant={"ghost"}
                    className='flex border-separate items-center justify-start rounded-none border-b px-3 py-3 text-muted-foreground'
                >
                    <PlusSquare className='mr-2 h-4 w-4' />
                    Create new
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