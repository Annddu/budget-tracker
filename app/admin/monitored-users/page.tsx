"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type MonitoredUser = {
  id: string;
  userId: string;
  reason: string;
  firstDetected: string;
  lastActivity: string;
  severity: number;
  isActive: boolean;
};

export default function MonitoredUsersPage() {
  const { userId } = useAuth();
  const [monitoredUsers, setMonitoredUsers] = useState<MonitoredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Check if user is admin
  useEffect(() => {
    if (!userId) return;
    
    async function checkAdminStatus() {
      try {
        const response = await fetch('/api/admin/check-status');
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        } else {
          setIsAdmin(false);
        }
      } catch (e) {
        setIsAdmin(false);
      }
    }
    
    checkAdminStatus();
  }, [userId]);
  
  // Fetch monitored users
  useEffect(() => {
    if (!userId || !isAdmin) return;
    
    async function fetchMonitoredUsers() {
      setLoading(true);
      try {
        const response = await fetch('/api/admin/monitored-users');
        
        if (!response.ok) {
          throw new Error('Failed to fetch monitored users');
        }
        
        const data = await response.json();
        setMonitoredUsers(data);
        setError(null);
      } catch (e) {
        console.error(e);
        setError('Failed to load monitored users');
      } finally {
        setLoading(false);
      }
    }
    
    fetchMonitoredUsers();
    
    // Refresh data every minute
    const interval = setInterval(fetchMonitoredUsers, 60000);
    return () => clearInterval(interval);
  }, [userId, isAdmin]);
  
  // Handle dismissing a flagged user
  const dismissUser = async (id: string) => {
    try {
      const response = await fetch('/api/admin/monitored-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          monitoredUserId: id,
          action: 'dismiss',
          notes: 'Dismissed by admin'
        })
      });
      
      if (response.ok) {
        setMonitoredUsers(users => users.filter(user => user.id !== id));
      } else {
        setError('Failed to dismiss user');
      }
    } catch (e) {
      console.error(e);
      setError('Failed to dismiss user');
    }
  };
  
  if (!isAdmin) {
    return (
      <div className="p-4">
        <Card>
          <CardContent>
            <p className="text-center py-8">You don't have permission to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Monitored Users</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : monitoredUsers.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-center py-8">No suspicious activity detected</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {monitoredUsers.map(user => (
            <Card key={user.id}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">
                    User ID: {user.userId}
                    <Badge className="ml-2" variant={
                      user.severity >= 4 ? "destructive" : 
                      user.severity >= 3 ? "outline" : "secondary"
                    }>
                      Severity {user.severity}
                    </Badge>
                  </CardTitle>
                  <Button 
                    onClick={() => dismissUser(user.id)} 
                    variant="outline" 
                    size="sm"
                  >
                    Dismiss
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm mb-2">
                  <span className="font-semibold">First detected:</span>{' '}
                  {new Date(user.firstDetected).toLocaleString()}
                </div>
                <div className="text-sm mb-4">
                  <span className="font-semibold">Last activity:</span>{' '}
                  {new Date(user.lastActivity).toLocaleString()}
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                  <p className="font-semibold text-sm">Reason flagged:</p>
                  <p className="text-sm whitespace-pre-wrap">{user.reason}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}