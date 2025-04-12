import { offlineStorage } from './offlineStorage';
import { API_BASE_URL } from './constants';
import { toast } from 'sonner';
import { getQueryClient } from './queryClientHelper';

export const syncService = {
  syncPendingTransactions: async (userId: string): Promise<boolean> => {
    try {
      const pendingOperations = offlineStorage.getPendingOperations();
      const transactionOperations = pendingOperations.filter(op => 
        op.endpoint.includes('/api/transactions') && op.userId === userId
      );
      
      if (transactionOperations.length === 0) {
        return true;
      }
      
      // Create a tracking set for processed transactions to avoid duplicates
      const processedTransactionSignatures = new Set();
      const processedServerIds = new Set(); // Track all replaced transactions by category/amount/date for later deduplication
      
      const toastId = `sync-transactions-${Date.now()}`;
      toast.loading(`Syncing ${transactionOperations.length} transaction changes...`, {
        id: toastId
      });
      
      let successCount = 0;
      let failCount = 0;
      
      // Track which temp IDs have been replaced with real ones
      const replacedTempIds = new Map();
      
      // Process operations in sequence for consistency
      for (const operation of transactionOperations) {
        try {
          // Create a unique signature for this transaction to detect duplicates
          const transactionSignature = 
            `${operation.operation}-${operation.data.type}-${operation.data.amount}-${operation.data.category}-${operation.data.date || new Date().toISOString()}`;
          
          // Skip if we've already processed an identical transaction
          if (processedTransactionSignatures.has(transactionSignature)) {
            console.log(`Skipping duplicate transaction: ${transactionSignature}`);
            offlineStorage.removePendingOperation(operation.id);
            continue;
          }
          
          processedTransactionSignatures.add(transactionSignature);
          
          // Handle temporary IDs for update operations
          if (operation.operation === 'update' && operation.data.id && operation.data.id.startsWith('temp-')) {
            const realId = replacedTempIds.get(operation.data.id);
            if (!realId) {
              // If we have an update for a temp ID but haven't created it yet, skip for now
              console.log(`Skipping update to temp ID ${operation.data.id} - original not yet created`);
              continue;
            }
            // Use the real ID for the update
            operation.data.id = realId;
          }
          
          // Ensure description is never empty or undefined
          if (!operation.data.description || operation.data.description.trim() === '') {
            // Add a default description based on the transaction type and category
            operation.data.description = `${operation.data.type === 'income' ? 'Income' : 'Expense'} - ${operation.data.category}`;
            console.log(`Added default description to transaction: ${operation.data.description}`);
          }
          
          // Construct appropriate URL and make request
          let url;
          let method = operation.method;
          let body = operation.data;
          
          if (operation.operation === 'create') {
            url = `${API_BASE_URL}/api/transactions?userId=${userId}`;
          } else if (operation.operation === 'update') {
            url = `${API_BASE_URL}/api/transactions/${operation.data.id}?userId=${userId}`;
          } else {
            // For delete operations
            const idMatch = operation.endpoint.match(/\/api\/transactions\/(\w+)/);
            const id = idMatch ? idMatch[1] : operation.data.id;
            url = `${API_BASE_URL}/api/transactions/${id}?userId=${userId}`;
          }
          
          const response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer your-secure-api-key'
            },
            body: method !== 'DELETE' ? JSON.stringify(body) : undefined
          });
          
          if (response.ok) {
            // Operation succeeded
            offlineStorage.removePendingOperation(operation.id);
            
            // For create operations, update the temporary ID with the real one
            if (operation.operation === 'create') {
              const newTransaction = await response.json();
              
              if (newTransaction.id) {
                // Add the server ID to our processed set
                processedServerIds.add(newTransaction.id);
                
                // Find any temp transactions to replace
                const tempTransactions = offlineStorage.getCachedTransactions(userId);
                const tempTransaction = tempTransactions.find(t => 
                  t._pendingAdd && 
                  t.amount === operation.data.amount && 
                  t.category === operation.data.category &&
                  !replacedTempIds.has(t.id) // Don't process transactions already replaced
                );
                
                if (tempTransaction) {
                  console.log(`Replacing temp transaction ${tempTransaction.id} with server ID ${newTransaction.id}`);
                  
                  // Track that we replaced this temp ID with a real one
                  replacedTempIds.set(tempTransaction.id, newTransaction.id);
                  
                  // Remove the temp transaction
                  offlineStorage.removeCachedTransaction(tempTransaction.id, userId);
                  
                  // Add server version
                  const serverTransaction = {
                    ...newTransaction,
                    _isTemp: false,
                    _pendingAdd: false,
                    _pendingUpdate: false,
                    _replacedTempId: tempTransaction.id // Add this to track which temp ID it replaced
                  };
                  offlineStorage.addCachedTransaction(serverTransaction, userId);
                }
              }
            } else if (operation.operation === 'update') {
              // Clear pending status for update operations
              offlineStorage.clearPendingStatus(operation.data.id, userId);
            }
            
            successCount++;
          } else {
            const errorText = await response.text();
            console.error(`Failed to sync operation: ${operation.id}`, errorText);
            
            // Special handling for DELETE operations - treat "not found" as success
            if (operation.method === 'DELETE' && errorText.includes("Transaction not found")) {
              console.log(`Transaction was already deleted or doesn't exist, considering operation successful`);
              offlineStorage.removePendingOperation(operation.id);
              successCount++; // Count as success instead of failure
            } else {
              // For other failures, remove from queue and count as failure
              console.log(`Removing failed operation from queue: ${operation.id}`);
              offlineStorage.removePendingOperation(operation.id);
              failCount++;
            }
          }
        } catch (error) {
          console.error(`Error syncing operation ${operation.id}:`, error);
          failCount++;
        }
      }
      
      // Don't do a full cache refresh if we successfully processed operations
      if (successCount > 0) {
        // First, ensure all duplicates are fully removed from cache before refreshing UI
        const allCachedTransactions = offlineStorage.getCachedTransactions(userId);
        const finalTransactions = allCachedTransactions.filter(tx => {
          // Keep all transactions that aren't duplicates of server ones
          if (tx.id && processedServerIds.has(tx.id)) {
            // This is a server transaction we just processed - keep it
            return true;
          }
          
          // For temp transactions, check if we already have a server version
          if (tx._pendingAdd) {
            // See if this temp transaction was replaced (check by matching properties)
            const isReplaced = allCachedTransactions.some(otherTx => 
              otherTx._replacedTempId === tx.id || 
              (otherTx._isTemp === false && 
               otherTx.amount === tx.amount && 
               otherTx.category === tx.category &&
               otherTx.date === tx.date)
            );
            
            if (isReplaced) {
              console.log(`Filtering out already replaced transaction: ${tx.id}`);
              return false; // Filter out this duplicate
            }
          }
          
          return true; // Keep all other transactions
        });
        
        // Re-save the filtered transactions to ensure duplicates are gone
        offlineStorage.cacheTransactions(finalTransactions, userId);
        
        // Now it's safe to invalidate the queries
        const queryClient = getQueryClient();
        if (queryClient) {
          // Check if we're online before doing a full refresh
          const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
          
          if (isOnline) {
            // Only do a full invalidate when online
            queryClient.invalidateQueries({ 
              queryKey: ["transactions"],
              refetchType: 'active' // Only refetch active queries
            });
          } else {
            // When offline, just mark as stale without refetching
            queryClient.invalidateQueries({ 
              queryKey: ["transactions"],
              refetchType: 'none'
            });
          }
        }
      }

      // Better error reporting for failed syncs
      if (failCount > 0) {
        console.log(`Failed to sync ${failCount} operations. Will retry next time.`);
      }
      
      if (failCount === 0) {
        toast.success(`Successfully synced ${successCount} transaction changes!`, {
          id: toastId
        });
        return true;
      } else {
        toast.error(`Synced ${successCount} changes, but ${failCount} failed.`, {
          id: toastId
        });
        return false;
      }
    } catch (error) {
      console.error("Transaction sync error:", error);
      return false;
    }
  },

  synchronize: async (userId?: string): Promise<boolean> => {
    const toastId = `sync-${Date.now()}`;
    
    try {
      const pendingOperations = offlineStorage.getPendingOperations();
      
      if (pendingOperations.length === 0) {
        console.log("No pending operations to sync");
        return true;
      }
      
      console.log(`Syncing ${pendingOperations.length} pending operations`);
      toast.loading(`Syncing ${pendingOperations.length} changes...`, {
        id: toastId
      });
      
      // If userId wasn't provided, try to get it from the first pending operation
      if (!userId && pendingOperations.length > 0) {
        userId = pendingOperations[0].userId;
      }
      
      if (!userId) {
        console.error("No user ID available for synchronization");
        toast.error("Sync failed: User ID not available", { id: toastId });
        return false;
      }
      
      // First sync transactions to ensure entity consistency
      await syncService.syncPendingTransactions(userId);
      
      // Then sync other operations (files, etc.)
      let successCount = 0;
      let failCount = 0;
      
      // Process each operation in sequence to avoid conflicts
      for (const operation of pendingOperations) {
        try {
          // Skip transaction operations as they're handled by syncPendingTransactions 
          if (operation.endpoint.includes('/api/transactions')) {
            continue; // Skip as these are already processed by syncPendingTransactions
          }
          
          // Ensure description is never empty for any operation type
          if (operation.data && typeof operation.data === 'object') {
            // If operation has a description field that's empty
            if ('description' in operation.data && 
                (!operation.data.description || operation.data.description.trim() === '')) {
              
              // Try to generate a sensible default description
              let defaultDescription = 'Added automatically';
              
              // For categories
              if (operation.endpoint.includes('/api/categories') && operation.data.name) {
                defaultDescription = `Category: ${operation.data.name}`;
              }
              // For files
              else if (operation.endpoint.includes('/api/files') && operation.data.fileName) {
                defaultDescription = `File: ${operation.data.fileName}`;
              }
              
              console.log(`Adding default description to operation: ${defaultDescription}`);
              operation.data.description = defaultDescription;
            }
          }
          
          // Construct the full URL, ensuring userId is properly included
          const url = `${API_BASE_URL}${operation.endpoint}`;
          
          // Check if we need to add userId as a query parameter
          const needsUserId = !url.includes('userId=') && operation.userId;
          const finalUrl = needsUserId 
            ? `${url}${url.includes('?') ? '&' : '?'}userId=${operation.userId}` 
            : url;
          
          console.log(`Syncing operation to: ${finalUrl}`);
          
          const response = await fetch(finalUrl, {
            method: operation.method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer your-secure-api-key'
            },
            body: operation.method !== 'DELETE' ? JSON.stringify(operation.data) : undefined
          });
          
          if (response.ok) {
            // Operation succeeded, remove from pending list
            offlineStorage.removePendingOperation(operation.id);
            successCount++;
          } else {
            const errorText = await response.text();
            console.error(`Failed to sync operation: ${operation.id}`, errorText);
            
            // Remove failed operations from the pending queue
            console.log(`Removing failed operation from queue: ${operation.id}`);
            offlineStorage.removePendingOperation(operation.id);
            
            failCount++;
          }
        } catch (error) {
          console.error(`Error syncing operation ${operation.id}:`, error);
          failCount++;
        }
      }
      
      if (failCount === 0) {
        toast.success(`Successfully synced ${successCount} changes!`, {
          id: toastId
        });
        return true;
      } else {
        toast.error(`Synced ${successCount} changes, but ${failCount} failed.`, {
          id: toastId
        });
        return false;
      }
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Failed to sync changes. Will retry later.", {
        id: toastId
      });
      return false;
    }
  }
};

// In your syncService.ts or similar file
const processDeleteOperation = async (operation: any, userId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}${operation.endpoint}?userId=${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-secure-api-key'
      }
    });
    
    if (response.ok) {
      // Remove the operation from pending queue
      offlineStorage.removePendingOperation(operation.id);
      return true;
    } else if (response.status === 404) {
      console.log(`Transaction already deleted or not found, marking sync as successful`);
      offlineStorage.removePendingOperation(operation.id);
      return true;
    } else {
      console.error(`Failed to sync delete operation: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error("Error syncing delete operation:", error);
    return false;
  }
};