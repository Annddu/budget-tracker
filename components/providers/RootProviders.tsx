"use client";

import { ThemeProvider } from "next-themes";
import { ClerkProvider } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { NetworkProvider } from "@/app/(dashboard)/_context/NetworkStatusProvider";
import { FileUploadProvider } from "@/app/(dashboard)/_context/FileUploadContext";
import { toast } from "sonner"; // Add this import

export function RootProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  
  // Create QueryClient without the onError handlers first
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Reduce retries when server is down
        retry: (failureCount, error) => {
          // Don't retry connection refused errors more than once
          if (error instanceof TypeError && 
              error.message.includes('fetch') && 
              failureCount > 1) {
            return false;
          }
          return failureCount < 3;
        },
        // Increase retry delay to avoid hammering server
        retryDelay: attemptIndex => Math.min(1000 * (2 ** attemptIndex), 30000),
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 60 * 24, // 24 hours
        refetchOnWindowFocus: false,
        // Disable automatic refetching when network is reconnected
        refetchOnReconnect: false
      },
      mutations: {
        onError: (error: any) => {
          console.error("Mutation error:", error);
          toast.error("Failed to save changes. Will retry when online.");
        }
      }
    }
  }));

  // Set up global error handler for queries after initialization
  useEffect(() => {
    // Set up global error handler for queries
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.state.status === 'error') {
        const error = event.query.state.error;
        console.error("Query error:", error);
        
        // Look for connection errors - these can have many forms
        if (
          error instanceof TypeError && 
          (error.message.includes('fetch') || error.message.includes('network') || error.name === 'TypeError')
        ) {
          // Only show the toast once to avoid spamming the user
          const queryKey = event.query.queryKey.join('-');
          const toastId = `network-error-${queryKey}`;
          
          toast.error("Working offline - changes will sync when connection is restored", {
            id: toastId,
            duration: 3000
          });
        }
      }
    });
    
    // Clean up subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ClerkProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          enableColorScheme={mounted}
        >
          <NetworkProvider>
            <FileUploadProvider>
              {children}
              <Toaster position="top-right" />
            </FileUploadProvider>
          </NetworkProvider>
        </ThemeProvider>
        {mounted && <ReactQueryDevtools />}
      </QueryClientProvider>
    </ClerkProvider>
  );
}