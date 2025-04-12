"use client";

import { useNetworkStatus } from '@/lib/NetworkStatusProvider';
import { Badge } from '@/components/ui/badge';
import { WifiOff, ServerOff } from 'lucide-react';

export function OfflineIndicator() {
  const { status } = useNetworkStatus();
  
  if (status === 'online') {
    return null;
  }
  
  return (
    <Badge variant="outline" className={
      status === 'offline' 
        ? "bg-red-100 text-red-800 border-red-200" 
        : "bg-amber-100 text-amber-800 border-amber-200"
    }>
      {status === 'offline' ? (
        <div className="flex items-center gap-1">
          <WifiOff size={14} />
          <span>Offline</span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <ServerOff size={14} />
          <span>Server Unavailable</span>
        </div>
      )}
    </Badge>
  );
}