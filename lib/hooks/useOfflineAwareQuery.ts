import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useNetwork } from '@/app/(dashboard)/_context/NetworkStatusProvider';

export function useOfflineAwareQuery<TData, TError = unknown>(
  queryKey: unknown[],
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError, TData>, 'queryKey' | 'queryFn'>
): UseQueryResult<TData, TError> {
  const { isOnline } = useNetwork();
  
  return useQuery({
    queryKey,
    queryFn,
    ...options,
    // Only refetch if we're online
    enabled: isOnline && (options?.enabled !== false),
    // Fix the retry option type
    retry: (failureCount, error) => {
      // Don't retry if we're offline
      if (!isOnline) return false;
      
      // Don't retry too many times for connection errors
      if (error instanceof TypeError && 
          error.message.includes('fetch') && 
          failureCount > 1) {
        return false;
      }
      
      // Handle options.retry properly based on its type
      if (options?.retry !== undefined) {
        if (typeof options.retry === 'function') {
          // Convert the result to boolean to satisfy TypeScript
          return Boolean(options.retry(failureCount, error));
        } else if (typeof options.retry === 'boolean') {
          return options.retry;
        } else if (typeof options.retry === 'number') {
          // If retry is a number, return true if we haven't reached the limit
          return failureCount < options.retry;
        }
      }
      
      // Default retry logic
      return failureCount < 3;
    }
  });
}