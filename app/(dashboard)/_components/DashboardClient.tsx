"use client";

import React, { Suspense } from 'react';
import { useNetwork } from '../_context/NetworkStatusProvider';
import Overview from '../_components/Overview';

// Loading spinner component
const LoadingSpinner = () => {
  return (
    <div className="flex justify-center items-center p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
};

export default function DashboardClient({ userSettings }: { userSettings: any }) {
  const { status } = useNetwork();
  const isReconnecting = status === 'offline' || status === 'server-down';
  
  return (
    <>
      {isReconnecting && (
        <div className="fixed bottom-4 right-4 bg-amber-100 text-amber-800 p-2 rounded-md shadow-md">
          Working offline - data may not be current
        </div>
      )}
      
      <Suspense fallback={<LoadingSpinner />}>
        <Overview userSettings={userSettings} />
      </Suspense>
    </>
  );
}