import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/constants';
import { useAuth } from '@clerk/nextjs';
import { offlineStorage } from '@/lib/offlineStorage';
import { useNetwork } from '../_context/NetworkStatusProvider';
import { useEffect } from 'react';
import { TransactionType } from '@/lib/types';

// Hook to fetch and cache categories
export function useCategories(type?: TransactionType) {
    const { userId } = useAuth();
    const { isOnline } = useNetwork();
    const queryClient = useQueryClient();

    // Query to fetch categories
    const categoriesQuery = useQuery({
        queryKey: ["categories", type, userId],
        queryFn: async () => {
            if (!userId) return [];

            try {
                // If offline, try to use cached categories
                if (!isOnline) {
                    const cachedCategories = offlineStorage.getCachedCategories(userId);
                    const filteredCategories = type
                        ? cachedCategories.filter((cat: any) => cat.type === type)
                        : cachedCategories;

                    console.log(`Using ${filteredCategories.length} cached categories`);
                    return filteredCategories;
                }

                // If online, fetch from server
                const typeParam = type ? `&type=${type}` : '';
                let res;
                try {
                    res = await fetch(`${API_BASE_URL}/api/categories?userId=${userId}${typeParam}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer your-secure-api-key'
                        }
                    });
                }
                catch (error) {
                    console.log("Error fetching categories:", error);
                    return [];
                }

                if (!res.ok) {
                    throw new Error(`Failed to fetch categories: ${res.status}`);
                }

                const categories = await res.json();

                // Cache categories for offline use
                if (!type) {
                    offlineStorage.cacheCategories(categories, userId);
                }

                return categories;
            } catch (error) {
                console.error("Error fetching categories:", error);

                // If failed and offline, try to use cached categories
                if (!isOnline) {
                    const cachedCategories = offlineStorage.getCachedCategories(userId);
                    return type
                        ? cachedCategories.filter((cat: any) => cat.type === type)
                        : cachedCategories;
                }

                return [];
            }
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 10, // 10 minutes
        gcTime: 1000 * 60 * 60,    // 1 hour
    });

    // Prefetch all categories when online to ensure they're available offline
    useEffect(() => {
        if (isOnline && userId && !type) {
            // Prefetch all categories if not already done
            queryClient.prefetchQuery({
                queryKey: ["categories", undefined, userId],
                queryFn: async () => {
                    const res = await fetch(`${API_BASE_URL}/api/categories?userId=${userId}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer your-secure-api-key'
                        }
                    });

                    const categories = await res.json();
                    offlineStorage.cacheCategories(categories, userId);
                    return categories;
                },
            });
        }
    }, [isOnline, userId, queryClient, type]);

    return categoriesQuery;
}

// Export prefetch function for use in other components
export const prefetchCategories = async (userId: string, queryClient: any) => {
    if (!userId) return;

    try {
        // Force prefetch both types separately with unique query keys
        console.log("Prefetching categories for offline use");
        
        // First fetch all categories
        const response = await fetch(`${API_BASE_URL}/api/categories?userId=${userId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer your-secure-api-key'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch categories: ${response.status}`);
        }

        const categories = await response.json();
        
        // Cache all categories
        queryClient.setQueryData(["categories", undefined, userId], categories);
        offlineStorage.cacheCategories(categories, userId);
        
        // Also cache expense and income categories separately
        const expenseCategories = categories.filter((cat: { type: string; }) => cat.type === 'expense');
        const incomeCategories = categories.filter((cat: { type: string; }) => cat.type === 'income');
        
        queryClient.setQueryData(["categories", "expense", userId], expenseCategories);
        queryClient.setQueryData(["categories", "income", userId], incomeCategories);
        
        console.log(`Successfully prefetched ${categories.length} categories (${expenseCategories.length} expense, ${incomeCategories.length} income)`);
        return categories;
    } catch (error) {
        console.error("Error prefetching categories:", error);
    }
};