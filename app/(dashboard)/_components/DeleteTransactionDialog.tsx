import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { toast } from 'sonner';
import { useUser } from '@clerk/nextjs'; // Add this import

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
  transactionId: string;
}

function DeleteTransactionDialog({open, setOpen, transactionId}: Props) {
  const queryClient = useQueryClient();
  const { user } = useUser(); // Get current user from Clerk
  
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Call the API endpoint instead of the server action
      const response = await fetch(`/api/transactions?id=${id}&userId=${user?.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          // For external frontend: 'Authorization': 'Bearer your-secure-api-key'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete transaction");
      }
      
      return response.json();
    },
    onSuccess: async () => {
      toast.success("Transaction deleted successfully", {
        id: transactionId,
      });
  
      // Invalidate all related queries
      await queryClient.invalidateQueries({
        queryKey: ["transactions"],
      });
      
      // Also invalidate history and overview data
      await queryClient.invalidateQueries({
        queryKey: ["overview"],
      });
      
      // Close the dialog
      setOpen(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`, {
        id: transactionId,
      });
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
              toast.loading("Deleting transaction...", {
                id: transactionId,
              });
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