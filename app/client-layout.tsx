"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setQueryClient } from "@/lib/queryClientHelper";
import { useEffect, useRef } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { RootProviders } from "@/components/providers/RootProviders";
import { Toaster } from "@/components/ui/sonner";

export function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const queryClientRef = useRef<QueryClient | null>(null);

  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient();
  }

  // Register the query client instance globally
  useEffect(() => {
    if (queryClientRef.current) {
      setQueryClient(queryClientRef.current);
    }
  }, []);

  return (
    <ClerkProvider>
      <QueryClientProvider client={queryClientRef.current}>
        <Toaster richColors position="bottom-right" />
        <RootProviders>{children}</RootProviders>
      </QueryClientProvider>
    </ClerkProvider>
  );
}