import { useQueryClient } from '@tanstack/react-query';

export function useDataRefresh() {
  const queryClient = useQueryClient();
  
  return {
    refreshAllData: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["history-data"] });
      queryClient.invalidateQueries({ queryKey: ["overview", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["overview", "history"] });
    },
    refreshTransactions: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    }
  };
}