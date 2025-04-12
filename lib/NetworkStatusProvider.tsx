"use client";

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { toast } from 'sonner';
import { API_BASE_URL } from './constants';
import { syncService } from './syncService';

type NetworkStatus = 'online' | 'offline' | 'server-down';

interface NetworkContextType {
  status: NetworkStatus;
  isOnline: boolean;
  lastChecked: Date | null;
}

const NetworkContext = createContext<NetworkContextType>({
  status: 'online',
  isOnline: true,
  lastChecked: null
});

export function useNetworkStatus() {
  return useContext(NetworkContext);
}

export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<NetworkStatus>('online');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // API endpoint to ping server
  const SERVER_PING_URL = '/api/ping';

  // Add a consistent toast ID for connection checks
  const CONNECTION_CHECK_TOAST_ID = "connection-check-toast";

  // Add a helper for server down scenarios
  const handleServerDown = (silent = false) => {
    if (status !== 'server-down') {
      if (!silent) {
        toast.error("Server is unreachable. Working in offline mode.", {
          id: CONNECTION_CHECK_TOAST_ID
        });
      }
      setStatus('server-down');
    } else {
      // Dismiss loading toast if in silent mode
      if (silent) {
        toast.dismiss(CONNECTION_CHECK_TOAST_ID);
      }
    }
  };

  // Improve the checkServer function
  const checkServer = async (silent = false) => {
    try {
      if (!silent) {
        toast.loading("Checking server connection...", {
          id: CONNECTION_CHECK_TOAST_ID,
        });
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${API_BASE_URL}/api/ping`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Authorization': 'Bearer your-secure-api-key'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        if (status !== 'online') {
          toast.success("Connection restored. Syncing data...", {
            id: CONNECTION_CHECK_TOAST_ID
          });
          setStatus('online');
          
          // Sync data after successful connection
          syncService.synchronize().then(/* your existing code */);
        } else if (!silent) {
          toast.success("Connected to server", {
            id: CONNECTION_CHECK_TOAST_ID,
          });
        } else {
          // If silent check and already online, just dismiss any pending toast
          toast.dismiss(CONNECTION_CHECK_TOAST_ID);
        }
      } else {
        handleServerDown(silent);
      }
    } catch (error) {
      handleServerDown(silent);
    }
    
    setLastChecked(new Date());
  };

  // Fix the handleOnline function
  const handleOnline = () => {
    // First dismiss any existing toast
    toast.dismiss(CONNECTION_CHECK_TOAST_ID);
    
    // Only show new toast and check server if we weren't already online
    if (status !== 'online') {
      toast.loading("Checking connection...", { 
        id: CONNECTION_CHECK_TOAST_ID,
        duration: 3000 // Auto-dismiss after 3 seconds as fallback
      });
      
      // Set a timeout to dismiss the toast if checkServer doesn't handle it
      setTimeout(() => toast.dismiss(CONNECTION_CHECK_TOAST_ID), 5000);
      
      // Check server status
      checkServer();
      
      // Dispatch network status change event
      window.dispatchEvent(new CustomEvent('networkStatusChanged', { 
        detail: { status: 'online' } 
      }));
    }
  };

  // Check server initially and set up interval
  useEffect(() => {
    // Initial check
    checkServer();
    
    // Set up regular checks
    const intervalId = setInterval(checkServer, 30000); // Check every 30 seconds
    
    // Browser online/offline events
    const handleOffline = () => {
      toast.error("Network connection lost. Working in offline mode.");
      setStatus('offline');
      setLastChecked(new Date());
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [status]);

  return (
    <NetworkContext.Provider value={{ 
      status, 
      isOnline: status === 'online',
      lastChecked 
    }}>
      {children}
    </NetworkContext.Provider>
  );
}