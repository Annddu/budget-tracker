import { useState, useCallback } from 'react';
import { useNetwork } from '@/app/(dashboard)/_context/NetworkStatusProvider';
import { fetchApi } from '@/lib/apiClient';
import { toast } from 'sonner';

export function useApi<T>() {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const { isOnline } = useNetwork();

  const request = useCallback(async (
    endpoint: string, 
    options: any = {}
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchApi(endpoint, {
        ...options,
        offlineSupport: true,
        cacheKey: `${endpoint}-${JSON.stringify(options.params || {})}`
      });
      
      setData(result);
      setLoading(false);
      
      // Check if this was from cache
      if (!isOnline && result._fromCache) {
        toast.info("Showing cached data while offline");
      }
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
      
      if (!navigator.onLine) {
        toast.error("You're offline. Some features may be limited.");
      } else if (!isOnline) {
        toast.error("Cannot connect to server. Working in offline mode.");
      }
      
      throw err;
    }
  }, [isOnline]);

  return { data, error, loading, request };
}