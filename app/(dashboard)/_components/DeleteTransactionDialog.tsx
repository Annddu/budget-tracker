import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs'; // Change to useAuth
import { API_BASE_URL } from '@/lib/constants'; // Add this import
import { useNetwork } from '../_context/NetworkStatusProvider';
import { offlineStorage } from '@/lib/offlineStorage';

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
  transactionId: string;
}

export function DeleteTransactionDialog({ open, setOpen, transactionId }: Props) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const { isOnline } = useNetwork();
  // Define date range for transactions query
  const from = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const to = new Date().toISOString();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) {
        throw new Error("User ID required");
      }

      // Create a unique toast ID for this operation
      const toastId = `delete-${id}-${Date.now()}`;

      toast.loading("Deleting transaction...", {
        id: toastId,
      });

      try {
        // IMPORTANT: First get a copy of the current data to handle optimistic updates
        const currentData = queryClient.getQueryData(["transactions", from, to, userId]);

        // Apply optimistic update BEFORE the API call for both online and offline
        queryClient.setQueryData(["transactions", from, to, userId], (oldData: any) => {
          if (!oldData || !oldData.pages) return oldData;

          // Create a new pages array with the transaction removed from each page
          const newPages = oldData.pages.map((page: any) => ({
            ...page,
            data: page.data ? page.data.filter((t: any) => t.id !== id) : [],
            pagination: {
              ...page.pagination,
              total: (page.pagination?.total || 0) - 1
            }
          }));

          return {
            ...oldData,
            pages: newPages
          };
        });

        // If offline, handle it with offline storage
        if (!isOnline) {
          // Store the operation for later sync - match the API route format
          offlineStorage.storePendingOperation(
            'delete',
            `/api/transactions/`, // Changed to match API route
            'DELETE',
            { id, userId }, // Include userId in the payload
            userId
          );
          // After completing the offline operation (add, update, or delete)
          // Force refresh UI immediately
          window.dispatchEvent(new CustomEvent('forceTableRefresh'));

          // IMPORTANT: Add this to mark transaction as deleted in all cached queries
          // This ensures consistency across different query keys and date ranges
          queryClient.setQueriesData(
            { queryKey: ["transactions"] },
            (oldData: any) => {
              if (!oldData || !oldData.pages) return oldData;

              // Filter out the deleted transaction from all transaction queries
              const newPages = oldData.pages.map((page: any) => ({
                ...page,
                data: page.data ? page.data.filter((t: any) => t.id !== id) : [],
                pagination: {
                  ...page.pagination,
                  total: (page.pagination?.total || 0) - 1
                }
              }));

              return {
                ...oldData,
                pages: newPages
              };
            }
          );

          // Update local storage cache (this should remove it from future data loaded from storage)
          offlineStorage.deleteCachedTransaction(id, userId);

          // Dismiss loading toast and show success
          toast.success("Transaction deleted (offline mode)", {
            id: toastId
          });

          return { success: true, _offlineMode: true };
        }

        // Online mode - normal API call
        const response = await fetch(`${API_BASE_URL}/api/transactions/${id}?userId=${userId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer your-secure-api-key'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to delete: ${response.status}`);
        }

        // Success toast
        toast.success("Transaction deleted successfully", {
          id: toastId
        });

        return response.json();
      } catch (error: any) {
        // Error handling with toast
        toast.error(`Failed to delete: ${error.message}`, {
          id: toastId
        });
        throw error;
      }
    },
    onSuccess: (result) => {
      // Always invalidate transactions query to update UI, regardless of online status
      queryClient.invalidateQueries({ 
        queryKey: ["transactions"],
        refetchType: isOnline ? 'all' : 'none' // Don't refetch when offline
      });

      // Always update other related data that needs to be consistent
      queryClient.invalidateQueries({
        queryKey: ["overview"],
        refetchType: isOnline ? 'all' : 'none'
      });

      // ALWAYS ensure local cache is updated and event is fired
      // regardless of whether server is down or client is offline
      if (transactionId && userId) {
        // Update local cache directly
        offlineStorage.deleteCachedTransaction(transactionId, userId);
        
        // Notify UI components about the deleted transaction
        const deleteEvent = new CustomEvent('deleteTransaction', { 
          detail: { transactionId }
        });
        window.dispatchEvent(deleteEvent);
      }

      setOpen(false);
    },
    onError: (error) => {
      console.error("Failed to delete:", error);
    }
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your transaction.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              deleteMutation.mutate(transactionId);
            }}
          >
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteTransactionDialog;