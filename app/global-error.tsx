"use client";
 
import { useEffect } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
 
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global error:", error);
  }, [error]);
 
  return (
    <html>
      <body>
        <ErrorBoundary error={error} reset={reset} />
      </body>
    </html>
  );
}