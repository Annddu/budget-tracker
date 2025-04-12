"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/constants';
import { useDataRefresh } from '@/lib/hooks/useDataRefresh';
import { syncService } from '@/lib/syncService';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchCategories } from '../_hooks/useCategories';
// Add this import
import { useAuth } from '@clerk/nextjs';

type NetworkStatus = 'online' | 'offline' | 'server-down';

interface NetworkContextType {
  status: NetworkStatus;
  isOnline: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<NetworkStatus>('online');
  const { refreshAllData } = useDataRefresh();
  const queryClient = useQueryClient();
  // Add this line to get userId
  const { userId } = useAuth();

  // Computed property for easier checks
  const isOnline = status === 'online';

  // Prefetch categories when online status changes
  useEffect(() => {
    if (isOnline && userId) {
      // First invalidate to ensure we don't use stale data
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      
      // Use setTimeout to ensure the invalidation completes
      setTimeout(() => {
        prefetchCategories(userId, queryClient);
      }, 500);
    }
  }, [isOnline, userId, queryClient]);

  // Check network status
  useEffect(() => {
    // Initial check
    if (navigator.onLine) {
      checkServer(true); // Silent initial check
    } else {
      setStatus('offline');
      toast.error("You are offline. Changes will be synced when connection is restored.");
    }

    // Set up event listeners for online/offline
    const handleOnline = () => {
      setStatus('online');
      
      // CHANGE: Use ID and add auto-dismiss
      const toastId = "connection-detected-toast";
      toast.dismiss(toastId);
      
      toast.loading("Checking connection...", { 
        id: toastId,
        duration: 3000  // Auto-dismiss after 3 seconds
      });
      
      // Force dismiss with timeout as backup
      setTimeout(() => toast.dismiss(toastId), 3500);
      
      checkServer();
      
      // Force refresh UI when coming back online
      window.dispatchEvent(new CustomEvent('networkStatusChanged', { 
        detail: { status: 'online' } 
      }));
    };

    const handleOffline = () => {
      setStatus('offline');
      toast.error("You are offline. Changes will be synced when connection is restored.");
      window.dispatchEvent(new CustomEvent('networkStatusChanged', { 
        detail: { status: 'offline' } 
      }));
    };

    // Check server status every 15 seconds when online
    const intervalId = setInterval(() => {
      if (navigator.onLine) {
        checkServer(true); // Silent check
      }
    }, 5000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, []);

  // Also add progressive checking when server is down
  useEffect(() => {
    let reconnectIntervalId: NodeJS.Timeout;
    
    // If server is down, start checking more frequently
    if (status === 'server-down') {
      reconnectIntervalId = setInterval(() => {
        console.log("Checking if server is back...");
        checkServer(true);
      }, 5000); // Check every 5 seconds when down
    }
    
    return () => {
      if (reconnectIntervalId) {
        clearInterval(reconnectIntervalId);
      }
    };
  }, [status]);

  // Server health check
  const checkServer = async (silent = false) => {
    try {
      if (!silent) {
        toast.loading("Checking server connection...", {
          id: "server-check",
        });
      }
      
      try {
        // Add a timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced timeout
        
        // Clear any cached result using cache: 'no-store'
        const response = await fetch(`${API_BASE_URL}/api/ping?nocache=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            'Authorization': 'Bearer your-secure-api-key'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          // Server is back up!
          if (status !== 'online') {
            console.log("Server connection restored!");
            setStatus('online');
            toast.success("Connection restored! Syncing changes...", {
              id: "server-check",
            });
            
            // Add these lines to force refresh categories when coming back online
            if (userId) {
              // Force refresh by invalidating instead of just prefetching
              queryClient.invalidateQueries({ queryKey: ["categories"] });
              setTimeout(() => {
                prefetchCategories(userId, queryClient);
              }, 500);
            }
            
            // Sync offline changes when reconnected - add file sync
            syncService.synchronize().then(success => {
              if (success) {
                // Refresh all data after successful sync
                refreshAllData();
                
                // Explicitly refresh files list
                queryClient.invalidateQueries({ queryKey: ["files"] });
              }
            });
          } else if (!silent) {
            toast.success("Connected to server", {
              id: "server-check",
            });
          }
          return true;
        } else {
          handleServerDown(silent);
          return false;
        }
      } catch (fetchError) {
        // This is expected when server is down, so don't log as error
        // Just update status silently
        if (!silent) {
          console.log("Server unreachable - working offline");
        }
        handleServerDown(silent);
        return false;
      }
    } catch (error) {
      console.error("Unexpected error during server check:", error);
      handleServerDown(silent);
      return false;
    }
  };

  const handleServerDown = (silent = false) => {
    if (status !== 'server-down') {
      setStatus('server-down');
      if (!silent) {
        toast.error("Server is unreachable. Working in offline mode.", {
          id: "server-check",
        });
      }
    } else if (!silent) {
      toast.error("Server is still unreachable.", {
        id: "server-check",
      });
    }
  };

  return (
    <NetworkContext.Provider value={{ status, isOnline }}>
      {children}
    </NetworkContext.Provider>
  );
}