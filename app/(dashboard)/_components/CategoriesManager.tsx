"use client";

import React, { useState } from 'react';
import { TransactionType } from '@/lib/types';
import { useCategories } from '../_hooks/useCategories';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/constants';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CreateCategoryDialog from './CreateCategoryDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import EditCategoryDialog from './EditCategoryDialog';
import { useNetwork } from '../_context/NetworkStatusProvider';
import { Category as PrismaCategory } from '@prisma/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Trash } from 'lucide-react';

// Add these imports at the top of your file
import {
  ColumnDef,
  SortingState,
  getSortedRowModel,
  getCoreRowModel,
  flexRender,
  useReactTable
} from "@tanstack/react-table";
import { DataTableColumnHeader } from '@/components/datatable/ColumnHeader';
import { cn } from '@/lib/utils';

// Define the Category type that includes the id property
type Category = PrismaCategory & { id: string };

// Add this to your CategoriesManager.tsx file
function GenerateCategoriesButton({ type }: { type: TransactionType }) {
  const { userId } = useAuth();
  const { isOnline } = useNetwork();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const handleGenerateCategories = async () => {
    if (!userId || !isOnline) return;
    
    setIsGenerating(true);
    const toastId = "generate-categories";
    toast.loading("Generating 100,000 categories...", {
      id: toastId,
    });
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/categories/generate?userId=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer your-secure-api-key'
        },
        body: JSON.stringify({
          count: 100000,
          type
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      
      toast.success(`Generated ${result.total} categories!`, {
        id: toastId
      });
      
      // Refresh categories data
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      
    } catch (error) {
      console.error("Error generating categories:", error);
      toast.error(`Failed: ${error instanceof Error ? error.message : String(error)}`, {
        id: toastId
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleGenerateCategories}
      disabled={isGenerating || !isOnline}
    >
      {isGenerating ? (
        <>
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
          Generating...
        </>
      ) : (
        'Generate 100K Categories'
      )}
    </Button>
  );
}

export default function CategoriesManager() {
  const [activeTab, setActiveTab] = useState<TransactionType>("expense");
  const [page, setPage] = useState(1);
  const pageSize = 10; // Number of items per page
  
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const { isOnline } = useNetwork();
  
  // Updated hook call with pagination
  const categoriesQuery = useCategories(activeTab, page, pageSize);
  
  // Get categories and pagination data
  const categories = categoriesQuery.data?.data || [];
  const pagination = categoriesQuery.data?.pagination || { 
    total: 0, pages: 1, page: 1, pageSize
  };

  // Function to handle page changes
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Delete category mutation
  const deleteMutation = useMutation({
    mutationFn: async (category: { name: string, type: string }) => {
      if (!userId) throw new Error("User ID not available");
      
      // Add explicit loading toast
      const toastId = `delete-category-${category.name}`;
      toast.loading("Deleting category...", { id: toastId });
      
      try {
        // Make API call with name and type parameters
        const response = await fetch(
          `${API_BASE_URL}/api/categories?userId=${userId}&name=${encodeURIComponent(category.name)}&type=${encodeURIComponent(category.type)}`, 
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer your-secure-api-key'
            }
          }
        );
        
        const responseText = await response.text();
        console.log("API response:", response.status, responseText);
        
        if (!response.ok) {
          throw new Error(`Failed to delete category: ${response.status} - ${responseText}`);
        }
        
        // Try to parse response as JSON if possible
        let jsonResponse;
        try {
          jsonResponse = JSON.parse(responseText);
        } catch (e) {
          jsonResponse = { success: true };
        }
        
        toast.success("Category deleted successfully", { id: toastId });
        return jsonResponse;
      } catch (error: any) {
        console.error("Error in delete mutation:", error);
        toast.error(`Failed to delete: ${error.message}`, { id: toastId });
        throw error;
      }
    },
    onSuccess: () => {
      // Refresh all relevant data
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      
      setCategoryToDelete(null);
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      console.error("Delete mutation error:", error);
      toast.error(`Error deleting category: ${error.message}`);
      setCategoryToDelete(null);
    }
  });

  const handleEditCategory = (category: Category) => {
    setCategoryToEdit(category);
    setIsEditDialogOpen(true);
  };

  return (
    <>
      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={(e) => {
                e.preventDefault(); // Prevent default action
                console.log("Delete button clicked:", categoryToDelete);
                
                if (categoryToDelete) {
                  deleteMutation.mutate({
                    name: categoryToDelete.name,
                    type: categoryToDelete.type
                  });
                } else {
                  console.error("No category to delete");
                  toast.error("No category selected for deletion");
                }
                
                // Dialog will be closed in onSuccess
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit category dialog */}
      {categoryToEdit && (
        <EditCategoryDialog 
          category={categoryToEdit}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        />
      )}
      
      <div className="w-full">
        <Tabs defaultValue="expense" onValueChange={(value) => {
          setActiveTab(value as TransactionType);
          setPage(1); // Reset to first page when changing tabs
        }}>
          <TabsList className="mb-4">
            <TabsTrigger value="expense">Expenses</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
          </TabsList>
          
          <TabsContent value="expense">
            <div className="flex justify-between mb-4">
              <CreateCategoryDialog type="expense" />
              <GenerateCategoriesButton type="expense" />
            </div>
            <CategoriesTable 
              categories={categories}
              isLoading={categoriesQuery.isLoading}
              pagination={pagination}
              onPageChange={handlePageChange}
              onEdit={handleEditCategory}
              onDelete={(category) => {
                setCategoryToDelete(category);
                setIsDeleteDialogOpen(true);
              }}
              isOnline={isOnline}
            />
          </TabsContent>
          
          <TabsContent value="income">
            <div className="flex justify-between mb-4">
              <CreateCategoryDialog type="income" />
              <GenerateCategoriesButton type="income" />  {/* Add this */}
            </div>
            <CategoriesTable 
              categories={categories}  
              isLoading={categoriesQuery.isLoading}
              pagination={pagination}
              onPageChange={handlePageChange}
              onEdit={handleEditCategory}
              onDelete={(category) => {
                setCategoryToDelete(category);
                setIsDeleteDialogOpen(true);
              }}
              isOnline={isOnline}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

// Update CategoriesTable props interface
interface CategoriesTableProps {
  categories: Category[];
  isLoading: boolean;
  pagination: {
    total: number;
    pages: number;
    page: number;
    pageSize: number;
  };
  onPageChange: (page: number) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  isOnline: boolean;
}

function CategoriesTable({ 
  categories, 
  isLoading, 
  pagination, 
  onPageChange, 
  onEdit, 
  onDelete, 
  isOnline 
}: CategoriesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  
  const columns: ColumnDef<Category>[] = [
    {
      accessorKey: "icon",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Icon" />,
      cell: ({ row }) => <div className="text-base">{row.getValue("icon")}</div>,
    },
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
    },
    {
      id: "actions",
      enableSorting: false,
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => (
        <CategoryRowActions 
          category={row.original}
          onEdit={onEdit} 
          onDelete={onDelete} 
          isOnline={isOnline}
        />
      ),
    },
  ];
  
  const table = useReactTable({
    data: categories,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  
  return (
    <div className="w-full">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className={cn(header.id === "actions" ? "w-[70px]" : "")}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="h-8 hover:bg-muted/50 data-[state=selected]:bg-muted transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No categories found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Add pagination controls */}
      <div className="flex items-center justify-between space-x-2 py-4">
        <div className=" text-sm text-muted-foreground">
          Showing {categories.length} of {pagination.total} categories
        </div>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(Math.max(1, pagination.page - 1));
                }}
                aria-disabled={pagination.page <= 1}
              />
            </PaginationItem>
            
            {/* First page */}
            {pagination.page > 2 && (
              <PaginationItem>
                <PaginationLink 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(1);
                  }}
                >
                  1
                </PaginationLink>
              </PaginationItem>
            )}
            
            {/* Ellipsis */}
            {pagination.page > 3 && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}
            
            {/* Previous page */}
            {pagination.page > 1 && (
              <PaginationItem>
                <PaginationLink 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(pagination.page - 1);
                  }}
                >
                  {pagination.page - 1}
                </PaginationLink>
              </PaginationItem>
            )}
            
            {/* Current page */}
            <PaginationItem>
              <PaginationLink isActive href="#">
                {pagination.page}
              </PaginationLink>
            </PaginationItem>
            
            {/* Next page */}
            {pagination.page < pagination.pages && (
              <PaginationItem>
                <PaginationLink 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(pagination.page + 1);
                  }}
                >
                  {pagination.page + 1}
                </PaginationLink>
              </PaginationItem>
            )}
            
            {/* Ellipsis */}
            {pagination.page < pagination.pages - 2 && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}
            
            {/* Last page */}
            {pagination.page < pagination.pages - 1 && (
              <PaginationItem>
                <PaginationLink 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(pagination.pages);
                  }}
                >
                  {pagination.pages}
                </PaginationLink>
              </PaginationItem>
            )}
            
            <PaginationItem>
              <PaginationNext 
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(Math.min(pagination.pages, pagination.page + 1));
                }}
                aria-disabled={pagination.page >= pagination.pages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}

// Add this new component for row actions
function CategoryRowActions({ category, onEdit, onDelete, isOnline }: { 
  category: Category, 
  onEdit: (category: Category) => void, 
  onDelete: (category: Category) => void, 
  isOnline: boolean 
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={!isOnline}>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onEdit(category)}>
          <Pencil className="mr-2 h-4 w-4" />
          <span>Edit</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDelete(category)} className="text-red-600 focus:text-red-600">
          <Trash className="mr-2 h-4 w-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}