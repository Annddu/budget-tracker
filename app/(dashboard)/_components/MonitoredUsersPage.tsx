"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/constants";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";

interface MonitoredUser {
    id: string;
    userId: string;
    reason: string;
    firstDetected: string;
    lastActivity: string;
    severity: number;
    isActive: boolean;
}

export default function MonitoredUsersPage() {
    const [monitoredUsers, setMonitoredUsers] = useState<MonitoredUser[]>([]);
    const [loading, setLoading] = useState(true);
    const { getToken, userId } = useAuth();

    useEffect(() => {
        const fetchMonitoredUsers = async () => {
            try {
                setLoading(true);
                console.log("Fetching monitored users...");

                // Get token without specifying template
                const token = await getToken();
                console.log("Got auth token:", token ? "✓" : "✗");

                const response = await fetch(`${API_BASE_URL}/api/admin/monitored-users?userId=${userId}`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer your-secure-api-key'
                    }
                });

                console.log("Response status:", response.status);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Error response:", errorText);
                    throw new Error(`Failed to fetch monitored users: ${response.status}`);
                }

                const data = await response.json();
                console.log("Received data:", data);
                setMonitoredUsers(data);
            } catch (error) {
                console.error("Error fetching monitored users:", error);
                toast.error("Failed to load monitored users");
            } finally {
                setLoading(false);
            }
        };

        fetchMonitoredUsers();

        // Refresh data periodically
        const interval = setInterval(fetchMonitoredUsers, 60000);
        return () => clearInterval(interval);
    }, [getToken, userId]);

    const dismissUser = async (id: string) => {
        try {
            const token = await getToken();
            const response = await fetch(`${API_BASE_URL}/api/admin/monitored-users`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": token ? `Bearer ${token}` : ""
                },
                body: JSON.stringify({
                    action: "dismiss",
                    monitoredUserId: id,
                    notes: "Dismissed from admin dashboard"
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to dismiss user: ${response.status}`);
            }

            setMonitoredUsers(prev => prev.filter(user => user.id !== id));
            toast.success("User removed from monitoring");
        } catch (error) {
            console.error("Error dismissing user:", error);
            toast.error("Failed to dismiss user");
        }
    };

    const getSeverityColor = (severity: number) => {
        switch (severity) {
            case 1: return "bg-yellow-100 text-yellow-800 border-yellow-400";
            case 2: return "bg-orange-100 text-orange-800 border-orange-400";
            case 3: return "bg-orange-100 text-orange-900 border-orange-500";
            case 4: return "bg-red-100 text-red-800 border-red-400";
            case 5: return "bg-red-100 text-red-900 border-red-500";
            default: return "bg-gray-100 text-gray-800 border-gray-300";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Monitored Users</h2>
                <Badge variant="outline" className={
                    monitoredUsers.length > 0 ? "bg-red-100 text-red-800 border-red-300" : ""
                }>
                    {monitoredUsers.length} user{monitoredUsers.length !== 1 ? 's' : ''} flagged
                </Badge>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
            ) : monitoredUsers.length === 0 ? (
                <Card>
                    <CardContent className="pt-6 pb-6">
                        <p className="text-center text-muted-foreground">No suspicious activity detected</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {monitoredUsers.map(user => (
                        <Card key={user.id} className="border-l-4" style={{
                            borderLeftColor: getSeverityColor(user.severity).split(' ')[2].replace('border-', 'var(--')
                        }}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        User ID: <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded dark:bg-gray-800">
                                            {user.userId}
                                        </span>
                                        <Badge className={getSeverityColor(user.severity)}>
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
                                <div className="grid gap-3">
                                    <div className="text-sm">
                                        <span className="font-medium">First detected:</span>{' '}
                                        {new Date(user.firstDetected).toLocaleString()}
                                    </div>
                                    <div className="text-sm">
                                        <span className="font-medium">Last activity:</span>{' '}
                                        {new Date(user.lastActivity).toLocaleString()}
                                    </div>
                                    <div className="mt-2 p-3 bg-gray-50 rounded-md dark:bg-gray-800">
                                        <div className="font-medium mb-1">Reason flagged:</div>
                                        <div className="text-sm whitespace-pre-wrap">{user.reason}</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}