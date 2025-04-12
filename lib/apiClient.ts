import { API_BASE_URL } from './constants';
import { offlineStorage } from './offlineStorage';

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  userId?: string;
  offlineSupport?: boolean; // Flag to enable offline support
  cacheKey?: string; // Key to use for caching GET requests
}

/**
 * Unified API client for making fetch requests to backend with offline support
 */
export async function fetchApi(endpoint: string, options: FetchOptions = {}) {
  const { 
    method = 'GET', 
    body, 
    headers = {}, 
    params = {},
    userId,
    offlineSupport = true,
    cacheKey
  } = options;
  
  // Add userId to params if provided
  if (userId) {
    params.userId = userId;
  }
  
  // Build query string
  const queryString = Object.keys(params).length 
    ? '?' + new URLSearchParams(params).toString() 
    : '';
  
  // Full URL with endpoint and query params
  const url = `${API_BASE_URL}${endpoint}${queryString}`;
  
  // Default headers + custom headers
  const requestHeaders = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-secure-api-key',
    ...headers
  };
  
  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
  };
  
  // Add body for non-GET requests
  if (body && method !== 'GET') {
    requestOptions.body = JSON.stringify(body);
  }
  
  // For offline GET requests with cache support
  const useCache = cacheKey && method === 'GET';
  
  try {
    // Check if we're online (browser API)
    const isOnline = navigator.onLine;
    
    // Attempt server request if online
    if (isOnline) {
      try {
        const response = await fetch(url, requestOptions);
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Cache successful GET responses
        if (useCache) {
          await offlineStorage.cacheResponse(cacheKey, data);
        }
        
        return data;
      } catch (error) {
        // Server might be down despite navigator.onLine being true
        if (offlineSupport) {
          // For write operations (POST, PUT, DELETE)
          if (method !== 'GET' && userId) {
            switch (method) {
              case 'POST':
                const addId = await offlineStorage.storeTransaction('add', body, undefined);
                console.log(`Stored offline transaction: ${addId}`);
                return { id: addId, _offlineGenerated: true };
                
              case 'PUT':
                const updateId = await offlineStorage.storeTransaction(
                  'update', 
                  body, 
                  body.id || params.id
                );
                console.log(`Stored offline update: ${updateId}`);
                return { id: updateId, _offlineGenerated: true };
                
              case 'DELETE':
                const deleteId = await offlineStorage.storeTransaction(
                  'delete',
                  { userId },
                  params.id
                );
                console.log(`Stored offline delete: ${deleteId}`);
                return { id: deleteId, _offlineGenerated: true };
            }
          }
          
          // For read operations (GET)
          if (useCache) {
            console.log(`Attempting to load cached data for: ${cacheKey}`);
            const cachedData = await offlineStorage.getCachedResponse(cacheKey);
            
            if (cachedData) {
              console.log(`Using cached data for: ${cacheKey}`);
              return cachedData;
            }
          }
        }
        
        // Re-throw if we can't handle offline or no cached data
        throw error;
      }
    } else if (offlineSupport) {
      // We're definitely offline
      console.log("Offline mode active");
      
      // For write operations
      if (method !== 'GET' && userId) {
        switch (method) {
          case 'POST':
            const addId = await offlineStorage.storeTransaction('add', body, undefined);
            console.log(`Stored offline transaction: ${addId}`);
            return { id: addId, _offlineGenerated: true };
            
          case 'PUT':
            const updateId = await offlineStorage.storeTransaction(
              'update', 
              body, 
              body.id || params.id
            );
            console.log(`Stored offline update: ${updateId}`);
            return { id: updateId, _offlineGenerated: true };
            
          case 'DELETE':
            const deleteId = await offlineStorage.storeTransaction(
              'delete',
              { userId },
              params.id
            );
            console.log(`Stored offline delete: ${deleteId}`);
            return { id: deleteId, _offlineGenerated: true };
        }
      }
      
      // For read operations
      if (useCache) {
        console.log(`Attempting to load cached data for: ${cacheKey}`);
        const cachedData = await offlineStorage.getCachedResponse(cacheKey);
        
        if (cachedData) {
          console.log(`Using cached data for: ${cacheKey}`);
          return cachedData;
        }
      }
    }
    
    // If we get here, we're offline with no offline support or cache
    throw new Error("You are offline and no cached data is available");
    
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
}