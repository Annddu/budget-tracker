// Create a new helper file to access the query client from outside components

import { QueryClient } from '@tanstack/react-query';

// Initialize a shared query client reference
let queryClientInstance: QueryClient | null = null;

// Function to set the query client instance (call this from your main app layout)
export function setQueryClient(client: QueryClient) {
  queryClientInstance = client;
}

// Function to get the query client instance from anywhere
export function getQueryClient(): QueryClient | null {
  return queryClientInstance;
}