"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useForm } from "react-hook-form";
import { useTheme } from "next-themes";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Category } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CreateCategorySchema, CreateCategorySchemaType } from "@/schema/categories";
import { API_BASE_URL } from "@/lib/constants";
import data from "@emoji-mart/data";
import Picker from '@emoji-mart/react';
import { DialogClose } from "@radix-ui/react-dialog";
import { CircleOff } from "lucide-react";


interface EditCategoryDialogProps {
    category: Category; // This should include an id field
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }

export default function EditCategoryDialog({ category, open, onOpenChange }: EditCategoryDialogProps) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const theme = useTheme();
  
  const form = useForm<CreateCategorySchemaType>({
    resolver: zodResolver(CreateCategorySchema),
    defaultValues: {
      name: category.name,
      icon: category.icon,
      type: category.type as "income" | "expense",
    },
  });

  // Reset form when category changes
  useEffect(() => {
    if (category) {
      form.reset({
        name: category.name,
        icon: category.icon,
        type: category.type as "income" | "expense",
      });
    }
  }, [category, form]);

  const mutation = useMutation({
    mutationFn: async (values: CreateCategorySchemaType) => {
      if (!userId) {
        throw new Error("User ID not available");
      }

      try {
        // The route.js file has PUT handler at /api/categories, not at /api/categories/[id]
        const response = await fetch(
          `${API_BASE_URL}/api/categories?userId=${userId}&name=${encodeURIComponent(category.name)}&type=${encodeURIComponent(category.type)}`, 
          {
            method: 'PUT',  // This method is correct
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer your-secure-api-key'  // Add this line
            },
            body: JSON.stringify(values)
          }
        );

        // For debugging - log the full response details
        console.log("Response status:", response.status);
        console.log("Response headers:", Object.fromEntries([...response.headers.entries()]));

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Update failed:", response.status, errorText);
          throw new Error(`Failed to update category: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        console.error("Error in update request:", error);
        throw error;
      }
    },
    onSuccess: async (data) => {
      toast.success(`Category updated!`);
      
      // Refresh categories data
      await queryClient.invalidateQueries({
        queryKey: ["categories"],
      });
      
      // Also refresh transactions as they may reference this category
      await queryClient.invalidateQueries({
        queryKey: ["transactions"],
      });
      
      // Also refresh overview stats
      await queryClient.invalidateQueries({
        queryKey: ["overview"],
      });
      
      // Notify other components about the update
      const updateEvent = new CustomEvent('categoryUpdated', { 
        detail: { category: data } 
      });
      window.dispatchEvent(updateEvent);
      
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error updating category:", error);
      toast.error(`Update failed: ${error instanceof Error ? error.message : "Unknown error"}`, {
        id: "update-category",
      });
    },
  });

  const onSubmit = (values: CreateCategorySchemaType) => {
    toast.loading("Updating category...", {
      id: "update-category",
    });
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Edit {category.type} category
          </DialogTitle>
          <DialogDescription>
            Update this category's details.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                          className="h-[100px] w-full"
                        >
                          {form.watch("icon") ? (
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-5xl" role="img">
                                {field.value}
                              </span>
                              <p className="text-xs text-muted-foreground">
                                Click to Change
                              </p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <CircleOff className="h-[48px] w-[48px]" />
                              <p className="text-xs text-muted-foreground">
                                Click to select
                              </p>
                            </div>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full">
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
              type="button"
              variant={"secondary"}
              onClick={() => {
                form.reset();
              }}
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={form.handleSubmit(onSubmit)}
            disabled={mutation.isPending}
          >
            {!mutation.isPending && "Save changes"}
            {mutation.isPending && <Loader2 className="animate-spin" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}