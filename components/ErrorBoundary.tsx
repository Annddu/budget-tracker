"use client";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { useState, useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check if browser is online
    setIsOnline(navigator.onLine);

    // Add event listeners for online/offline status changes
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex h-[80vh] items-center justify-center p-6">
      <Alert className="max-w-md">
        <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
        <AlertTitle className="text-lg font-semibold text-red-500">
          Something went wrong!
        </AlertTitle>
        <AlertDescription className="mt-4">
          <p className="mb-4">{error.message}</p>
          {!isOnline && (
            <p className="mb-4 text-amber-600 bg-amber-50 p-2 rounded">
              You appear to be offline. The app will automatically reconnect when your internet connection is restored.
            </p>
          )}
          <div className="mt-6 flex gap-4">
            <Button variant="outline" onClick={() => window.location.href = "/"}>
              Go Home
            </Button>
            <Button onClick={() => reset()}>Try Again</Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}