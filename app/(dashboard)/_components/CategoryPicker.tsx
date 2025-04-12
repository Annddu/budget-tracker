"use client";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { TransactionType } from "@/lib/types";
import { Category } from "@prisma/client";
import { Popover, PopoverTrigger } from "@radix-ui/react-popover";
import React, { useEffect } from "react";
import CreateCategoryDialog from "./CreateCategoryDialog";
import { CommandGroup } from "cmdk";
import { Check, ChevronsUpDown, CloudOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCategories } from "../_hooks/useCategories";
import { useNetwork } from "../_context/NetworkStatusProvider";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

interface Props {
    type: TransactionType;
    onChange: (value: string) => void;
    defaultValue?: string;
}

function CategoryPicker({ type, onChange, defaultValue }: Props) {
    const [open, setOpen] = React.useState(false);
    const [value, setValue] = React.useState(defaultValue || "");
    const { isOnline } = useNetwork();
    
    // Use the custom hook for categories
    const categoriesQuery = useCategories(type);

    useEffect(() => {
        if (!value) return;
        onChange(value);
    }, [value, onChange]);

    useEffect(() => {
        if (defaultValue) {
            setValue(defaultValue);
        }
    }, [defaultValue]);

    const selectedCategory = categoriesQuery.data?.find(
        (category: Category) => category.name === value
    );

    return <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
            <Button
                variant={"outline"}
                role="combobox"
                aria-expanded={open}
                className="w-[200px] justify-between"
            >
                {selectedCategory ? (
                    <CategoryRow category={selectedCategory} />
                ) : (
                    "Select a category"
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
            <Command onSubmit={e => {
                e.preventDefault();
            }}>
                <CommandInput placeholder="Search category..." />
                {!isOnline && (
                    <div className="flex items-center p-2 text-xs text-yellow-700 bg-yellow-50">
                        <CloudOff className="h-3 w-3 mr-1" />
                        <span>Using cached categories</span>
                    </div>
                )}
                {isOnline && (
                    <>
                        <CreateCategoryDialog type={type} />
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs" 
                            onClick={() => {
                                const queryClient = useQueryClient();
                                queryClient.invalidateQueries({ queryKey: ["categories"] });
                                toast.success("Categories refreshed");
                            }}
                        >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Refresh
                        </Button>
                    </>
                )}
                <CommandEmpty>
                    <p>Category not found</p>
                    {isOnline ? (
                        <p className="text-xs text-muted-foreground">
                            Tip: Create a new category
                        </p>
                    ) : (
                        <p className="text-xs text-yellow-700">
                            Can't create categories offline
                        </p>
                    )}
                </CommandEmpty>
                <CommandGroup>
                    <CommandList>
                        {
                            categoriesQuery.data && categoriesQuery.data.map((category: Category) => (
                                <CommandItem key={category.name} onSelect={() => {
                                    setValue(category.name);
                                    setOpen((prev) => !prev);
                                }}
                                >
                                    <CategoryRow category={category} />
                                    <Check className={cn(
                                        "mr-2 w-4 h-4 opacity-0",
                                        value === category.name && "opacity-100"
                                    )} />
                                </CommandItem>
                            ))
                        }
                    </CommandList>
                </CommandGroup>
            </Command>
        </PopoverContent>
    </Popover>
}

export default CategoryPicker;

function CategoryRow({ category }: { category: Category }) {
    return (
        <div className="flex items-center gap-2">
            <span role="img">{category.icon}</span>
            <span>{category.name}</span>
        </div>
    )
}