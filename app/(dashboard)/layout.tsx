"use client";
import Navbar from '@/components/Navbar'
import React from 'react'
import { DemoProvider } from '../context/DemoContext'
import { FileUploadProvider } from './_context/FileUploadContext';
import { useNetwork } from './_context/NetworkStatusProvider';
import { useDataRefresh } from '@/lib/hooks/useDataRefresh';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useNetwork();
  const { refreshAllData } = useDataRefresh();

  return (
    <DemoProvider>
      <FileUploadProvider>
        <div className='relative flex h-screen w-full flex-col'>
          {status !== 'online' && (
            <div className={`fixed top-0 left-0 right-0 p-2 text-center z-50 ${
              status === 'offline' 
                ? 'bg-yellow-500 text-white' 
                : 'bg-red-500 text-white animate-pulse'
            }`}>
              {status === 'offline' 
                ? "You are offline. Changes will sync when connection is restored." 
                : (
                  <div className="flex justify-center items-center gap-2">
                    <span>Server is unreachable. Working in offline mode. Reconnecting...</span>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="ml-2 bg-white/20 hover:bg-white/30"
                      onClick={refreshAllData}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" /> Refresh Data
                    </Button>
                  </div>
                )}
            </div>
          )}
          <Navbar />
          <div className='w-full'>{children}</div>
        </div>
      </FileUploadProvider>
    </DemoProvider>
  );
}