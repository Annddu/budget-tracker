import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/constants';
import { useAuth } from '@clerk/nextjs';
import { offlineStorage } from '@/lib/offlineStorage';
import { useNetwork } from '../_context/NetworkStatusProvider';
import { useEffect, useCallback } from 'react';
import { TransactionType } from '@/lib/types';

// Hook to fetch and cache categories
export function useCategories(type: TransactionType, page = 1, pageSize = 10) {
    const { userId } = useAuth();
    const { isOnline } = useNetwork();

    return useQuery({
        queryKey: ["categories", type, page, pageSize, userId],
        queryFn: async () => {
            if (!userId) return { data: [], pagination: { total: 0, pages: 0, page: 1, pageSize } };

            const response = await fetch(
                `${API_BASE_URL}/api/categories?userId=${userId}&type=${type}&page=${page}&pageSize=${pageSize}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer your-secure-api-key'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch categories: ${response.status}`);
            }

            return response.json();
        },
        enabled: !!userId && isOnline,
    });
}

// Hook to prefetch categories
export function usePrefetchCategories() {
    const { userId } = useAuth();
    const queryClient = useQueryClient();
    const { isOnline } = useNetwork();

    const prefetchCategories = useCallback(async (type: TransactionType) => {
        if (!userId || !isOnline) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/categories?userId=${userId}&type=${type}`, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch categories: ${response.status}`);
            }

            const result = await response.json();

            // Check if result is the new format with pagination or the old array format
            const categoriesArray = Array.isArray(result) ? result : (result.data || []);

            // Now we can safely use filter on the array
            const expenseCategories = categoriesArray.filter((cat: { type: string; }) => cat.type === 'expense');
            const incomeCategories = categoriesArray.filter((cat: { type: string; }) => cat.type === 'income');

            // Store the categories with the pagination info
            queryClient.setQueryData(['categories', 'expense'], {
                data: expenseCategories,
                pagination: result.pagination || { total: expenseCategories.length, page: 1, pages: 1, pageSize: expenseCategories.length }
            });

            queryClient.setQueryData(['categories', 'income'], {
                data: incomeCategories,
                pagination: result.pagination || { total: incomeCategories.length, page: 1, pages: 1, pageSize: incomeCategories.length }
            });

        } catch (error) {
            console.error("Error prefetching categories:", error);
        }
    }, [userId, queryClient, isOnline]);

    return prefetchCategories;
}

// Export a standalone function that's compatible with existing code
export const prefetchCategories = async (
  userId: string | null | undefined, 
  queryClient: ReturnType<typeof useQueryClient>,
  isOnline: boolean = true
) => {
  if (!userId || !queryClient || !isOnline) return;
  
  try {
    // First fetch all categories
    const response = await fetch(`${API_BASE_URL}/api/categories?userId=${userId}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-secure-api-key'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.status}`);
    }

    const result = await response.json();
    
    // Check if result is the new format with pagination or the old array format
    const categoriesArray = Array.isArray(result) ? result : (result.data || []);
    
    // Now we can safely use filter on the array
    const expenseCategories = categoriesArray.filter((cat: { type: string; }) => cat.type === 'expense');
    const incomeCategories = categoriesArray.filter((cat: { type: string; }) => cat.type === 'income');
    
    // Store the categories with the pagination info
    queryClient.setQueryData(['categories', 'expense'], {
      data: expenseCategories,
      pagination: result.pagination || { total: expenseCategories.length, page: 1, pages: 1, pageSize: expenseCategories.length }
    });
    
    queryClient.setQueryData(['categories', 'income'], {
      data: incomeCategories,
      pagination: result.pagination || { total: incomeCategories.length, page: 1, pages: 1, pageSize: incomeCategories.length }
    });
    
  } catch (error) {
    console.error("Error prefetching categories:", error);
  }
};
