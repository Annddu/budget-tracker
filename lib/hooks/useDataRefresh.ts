import { useQueryClient } from '@tanstack/react-query';

export function useDataRefresh() {
  const queryClient = useQueryClient();
  
  return {
    refreshAllData: () => {
      // Invalidate all major data queries
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['history-data'] });
      queryClient.invalidateQueries({ queryKey: ['history-periods'] });
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      
      console.log('All data refreshed after server reconnection');
    }
  };
}