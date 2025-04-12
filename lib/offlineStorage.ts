import Dexie from 'dexie';

// Define database schema
export interface OfflineTransaction {
  id: string;  // Temporary local ID
  originalId?: string; // Server ID if this is an update
  action: 'add' | 'update' | 'delete';
  data: any;
  timestamp: number;
  synced: number; // 0 for false, 1 for true
}

export interface CachedResponse {
  key: string;
  data: any;
  timestamp: number;
}

class OfflineDatabase extends Dexie {
  transactions!: Dexie.Table<OfflineTransaction, string>;
  cache!: Dexie.Table<CachedResponse, string>;

  constructor() {
    super('BudgetTrackerOfflineDB');

    // Explicitly typing this to Dexie to access version method
    (this as Dexie).version(1).stores({
      transactions: 'id, action, timestamp, synced',
      cache: 'key, timestamp'
    });

    this.transactions = (this as Dexie).table('transactions');
    this.cache = (this as Dexie).table('cache');
  }
}

export const offlineDb = new OfflineDatabase();

type PendingOperation = {
  id: string;
  operation: 'create' | 'update' | 'delete';
  endpoint: string;
  method: string;
  data: any;
  timestamp: number;
  userId: string;
};

// Helper functions for offline storage
export const offlineStorage = {
  async storeTransaction(action: 'add' | 'update' | 'delete', data: any, originalId?: string): Promise<string> {
    const id = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await offlineDb.transactions.add({
      id,
      originalId,
      action,
      data,
      timestamp: Date.now(),
      synced: 0
    });

    return id;
  },

  async getUnsynced(): Promise<OfflineTransaction[]> {
    return await offlineDb.transactions
      .where('synced')
      .equals(0)
      .toArray();
  },

  async markAsSynced(id: string): Promise<void> {
    await offlineDb.transactions
      .where('id')
      .equals(id)
      .modify({ synced: 1 });
  },

  async clearSynced(): Promise<void> {
    await offlineDb.transactions
      .where('synced')
      .equals(1)
      .delete();
  },

  // Cache API responses for offline use
  async cacheResponse(key: string, data: any): Promise<void> {
    await offlineDb.cache.put({
      key,
      data,
      timestamp: Date.now()
    });
  },

  async getCachedResponse(key: string): Promise<any> {
    const cached = await offlineDb.cache
      .where('key')
      .equals(key)
      .first();

    return cached?.data;
  },

  async clearCache(): Promise<void> {
    await offlineDb.cache.clear();
  },

  // Store pending operations
  storePendingOperation: (operation: 'create' | 'update' | 'delete', endpoint: string, method: string, data: any, userId: string): string => {
    const operationId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const pendingOperations = JSON.parse(localStorage.getItem('pendingOperations') || '[]');

    pendingOperations.push({
      id: operationId,
      operation,
      endpoint,
      method,
      data,
      timestamp: Date.now(),
      userId
    });

    localStorage.setItem('pendingOperations', JSON.stringify(pendingOperations));
    console.log(`Stored ${operation} operation for offline sync: ${operationId}`);
    return operationId;
  },

  // Get all pending operations
  getPendingOperations: (): PendingOperation[] => {
    return JSON.parse(localStorage.getItem('pendingOperations') || '[]');
  },

  // Remove a pending operation after it's been processed
  removePendingOperation: (id: string): void => {
    const pendingOperations = JSON.parse(localStorage.getItem('pendingOperations') || '[]');
    const filtered = pendingOperations.filter((op: PendingOperation) => op.id !== id);
    localStorage.setItem('pendingOperations', JSON.stringify(filtered));
  },

  // Cache categories for offline use
  cacheCategories: (categories: any[], userId: string): void => {
    try {
      localStorage.setItem(`categories-${userId}`, JSON.stringify(categories));
      console.log(`Cached ${categories.length} categories for offline use`);
    } catch (error) {
      console.error("Error caching categories:", error);
    }
  },

  // Get cached categories
  getCachedCategories: (userId: string): any[] => {
    try {
      return JSON.parse(localStorage.getItem(`categories-${userId}`) || '[]');
    } catch (error) {
      console.error("Error getting cached categories:", error);
      return [];
    }
  },

  // Cache transactions for offline use
  cacheTransactions: (transactions: any[], userId: string): void => {
    localStorage.setItem(`transactions-${userId}`, JSON.stringify(transactions));
  },

  // Get cached transactions
  getCachedTransactions: (userId: string | null | undefined): any[] => {
    return JSON.parse(localStorage.getItem(`transactions-${userId}`) || '[]');
  },

  // Add temporary ID to a new transaction
  addTempTransaction: (transaction: any, userId: string): any => {
    try {
      const transactions = JSON.parse(localStorage.getItem(`transactions-${userId}`) || '[]');

      // Create a temporary ID with a special prefix so we can identify it later
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newTransaction = {
        ...transaction,
        id: tempId,
        _isTemp: true,
        _pendingAdd: true
      };

      // Add to local storage
      transactions.push(newTransaction);
      localStorage.setItem(`transactions-${userId}`, JSON.stringify(transactions));

      return newTransaction;
    } catch (error) {
      console.error("Error adding temp transaction:", error);
      throw error;
    }
  },

  // Update a transaction in the local cache
  updateCachedTransaction: (id: string, updatedData: any, userId: string): void => {
    try {
      const transactions = JSON.parse(localStorage.getItem(`transactions-${userId}`) || '[]');
      const index = transactions.findIndex((t: any) => t.id === id);

      if (index !== -1) {
        // Mark as pending update if it's not a temporary transaction
        const isPendingAdd = transactions[index]._pendingAdd === true;

        transactions[index] = {
          ...transactions[index],
          ...updatedData,
          _pendingUpdate: !isPendingAdd, // Don't mark as pending update if it's already pending add
          _lastUpdated: Date.now()
        };

        localStorage.setItem(`transactions-${userId}`, JSON.stringify(transactions));
      }
    } catch (error) {
      console.error("Error updating cached transaction:", error);
    }
  },

  // Delete a transaction from the local cache
  deleteCachedTransaction: (id: string, userId: string): void => {
    // 1. Remove from the main transactions cache
    const transactions = JSON.parse(localStorage.getItem(`transactions-${userId}`) || '[]');
    const filtered = transactions.filter((t: any) => t.id !== id);
    localStorage.setItem(`transactions-${userId}`, JSON.stringify(filtered));

    // 2. Also remove from any date-specific caches that might exist
    // Find all keys in localStorage that might contain transaction data
    const keysToCheck = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('transactions') && key.includes(userId)) {
        keysToCheck.push(key);
      }
    }

    // Update each potential cache
    keysToCheck.forEach(key => {
      try {
        const cacheData = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(cacheData)) {
          const updatedCache = cacheData.filter((t: any) => t.id !== id);
          localStorage.setItem(key, JSON.stringify(updatedCache));
        } else if (cacheData.pages) {
          // Handle React Query cache format
          const updatedPages = cacheData.pages.map((page: any) => ({
            ...page,
            data: page.data.filter((t: any) => t.id !== id)
          }));
          cacheData.pages = updatedPages;
          localStorage.setItem(key, JSON.stringify(cacheData));
        }
      } catch (e) {
        console.error(`Error updating cache for key ${key}:`, e);
      }
    });

    // 3. Add to a "deleted transactions" list to ensure it stays deleted
    // This helps when merging data later
    const deletedTransactions = JSON.parse(
      localStorage.getItem(`deleted-transactions-${userId}`) || '[]'
    );
    if (!deletedTransactions.includes(id)) {
      deletedTransactions.push(id);
      localStorage.setItem(
        `deleted-transactions-${userId}`,
        JSON.stringify(deletedTransactions)
      );
    }
  },

  // Get all pending transaction operations (add/update)
  getPendingTransactionOperations: (userId: string): any[] => {
    try {
      const transactions = JSON.parse(localStorage.getItem(`transactions-${userId}`) || '[]');
      return transactions.filter((t: any) => t._pendingAdd || t._pendingUpdate);
    } catch (error) {
      console.error("Error getting pending transaction operations:", error);
      return [];
    }
  },

  // Clear pending status after successful sync
  clearPendingStatus: (id: string, userId: string): void => {
    try {
      const transactions = JSON.parse(localStorage.getItem(`transactions-${userId}`) || '[]');
      const index = transactions.findIndex((t: any) => t.id === id);

      if (index !== -1) {
        delete transactions[index]._pendingAdd;
        delete transactions[index]._pendingUpdate;
        localStorage.setItem(`transactions-${userId}`, JSON.stringify(transactions));
      }
    } catch (error) {
      console.error("Error clearing pending status:", error);
    }
  },

  // Store deleted file IDs
  storeDeletedFileId: (fileId: string, userId: string): void => {
    const deletedFiles = JSON.parse(
      localStorage.getItem(`deleted-files-${userId}`) || '[]'
    );

    if (!deletedFiles.includes(fileId)) {
      deletedFiles.push(fileId);
      localStorage.setItem(`deleted-files-${userId}`, JSON.stringify(deletedFiles));
    }
  },

  // Get deleted file IDs
  getDeletedFileIds: (userId: string): string[] => {
    return JSON.parse(localStorage.getItem(`deleted-files-${userId}`) || '[]');
  },

  // Remove a file ID from the deleted list (after successful sync)
  removeDeletedFileId: (fileId: string, userId: string): void => {
    const deletedFiles = JSON.parse(
      localStorage.getItem(`deleted-files-${userId}`) || '[]'
    );

    const updatedDeletedFiles = deletedFiles.filter((id: string) => id !== fileId);
    localStorage.setItem(`deleted-files-${userId}`, JSON.stringify(updatedDeletedFiles));
  },

  // Add this helper function to standardize date handling for offline storage

  // Convert any date representation to a standardized format for comparison
  standardizeDate: (date: Date | string): Date => {
    if (typeof date === 'string') {
      return new Date(date);
    }
    return new Date(date);
  },

  // When filtering transactions in offline mode, use this to compare dates
  filterTransactionsByDateRange: (transactions: any[], from: Date, to: Date): any[] => {
    // Ensure we're working with date objects for comparison bounds
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    return transactions.filter(tx => {
      // Parse the transaction date consistently
      const txDate = new Date(tx.date);
      // Compare only the date portions
      return txDate >= fromDate && txDate <= toDate;
    });
  },

  // Add these helper functions to prevent duplication

  removeCachedTransaction: (id: string, userId: string): void => {
    try {
      const transactions = JSON.parse(localStorage.getItem(`transactions-${userId}`) || '[]');
      const filteredTransactions = transactions.filter((t: any) => t.id !== id);
      localStorage.setItem(`transactions-${userId}`, JSON.stringify(filteredTransactions));
      console.log(`Removed transaction ${id} from cache`);
    } catch (error) {
      console.error("Error removing cached transaction:", error);
    }
  },

  addCachedTransaction: (transaction: any, userId: string): void => {
    try {
      const transactions = JSON.parse(localStorage.getItem(`transactions-${userId}`) || '[]');
      // Check for duplicates before adding
      const existingIndex = transactions.findIndex((t: any) => t.id === transaction.id);

      if (existingIndex >= 0) {
        // Update existing transaction instead of adding
        transactions[existingIndex] = transaction;
      } else {
        // Add new transaction
        transactions.push(transaction);
      }

      localStorage.setItem(`transactions-${userId}`, JSON.stringify(transactions));
      console.log(`Added transaction ${transaction.id} to cache`);
    } catch (error) {
      console.error("Error adding cached transaction:", error);
    }
  }
};