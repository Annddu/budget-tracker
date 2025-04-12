"use client";

import { useState, useEffect, useMemo, JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DownloadIcon, FileIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { API_BASE_URL } from '@/lib/constants';
import { useAuth } from '@clerk/nextjs';
import { useNetwork } from '../_context/NetworkStatusProvider';
import { offlineStorage } from '@/lib/offlineStorage';

type FileItem = {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: string;
  fileType: string;
  category: string;
  description: string | null;
  uploadedAt: string;
  downloadCount: number;
  isComplete: boolean;
  chunks?: number;
  totalChunks?: number;
};

export default function FilesList() {
  const [category, setCategory] = useState<string>("all");
  const { userId } = useAuth();
  const { status, isOnline } = useNetwork();

  // Track locally deleted files
  const [locallyDeletedFileIds, setLocallyDeletedFileIds] = useState<string[]>([]);

  // Load locally deleted files on component mount
  useEffect(() => {
    if (userId) {
      const deletedFiles = offlineStorage.getDeletedFileIds(userId);
      setLocallyDeletedFileIds(deletedFiles);
    }
  }, [userId]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["files", category, userId],
    queryFn: async () => {
      if (!userId) return Promise.reject("No user ID available");

      const categoryParam = category !== "all" ? `&category=${category}` : "";
      try {
        console.log(`Attempting to fetch files from: ${API_BASE_URL}/api/files?userId=${userId}${categoryParam}`);

        try {
          const response = await fetch(`${API_BASE_URL}/api/files?userId=${userId}${categoryParam}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer your-secure-api-key'
            }
          });
          return response.json();
        }
        catch (error) {
          console.log("Network error:", error);
          return [];
        }
      } catch (error) {
        console.log("Error fetching files:", error);
        if (error instanceof TypeError && error.message.includes('fetch')) {
          console.log("Network error: Unable to reach the server.");
        }
        console.log("Error fetching files:", error);
      }
    },
    enabled: !!userId,
    retry: 2,
    retryDelay: 1000,
  });

  const downloadFile = async (fileId: string) => {
    if (!isOnline) {
      toast.error("Cannot download files while offline");
      return;
    }

    try {
      toast.loading("Preparing download...", { id: "download" });

      const downloadUrl = `${API_BASE_URL}/api/files/download/${fileId}?userId=${userId}`;
      console.log("Downloading from:", downloadUrl);

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer your-secure-api-key'
        }
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();

      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition ? /filename="(.+)"/.exec(contentDisposition) : null;
      const filename = filenameMatch ? filenameMatch[1] : `download-${fileId}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Download complete", { id: "download" });
      refetch();
    } catch (error) {
      console.error("Download error:", error);
      toast.error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: "download" });
    }
  };

  const deleteFile = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) {
      return;
    }

    try {
      const toastId = `delete-file-${fileId}`;
      toast.loading("Deleting file...", { id: toastId });

      if (!isOnline) {
        if (!userId) {
          throw new Error("User ID required");
        }
        
        offlineStorage.storePendingOperation(
          'delete',
          `/api/files/${fileId}`,
          'DELETE',
          { id: fileId, userId },
          userId
        );

        offlineStorage.storeDeletedFileId(fileId, userId);

        setLocallyDeletedFileIds(prev => [...prev, fileId]);

        toast.success("File marked for deletion when back online", { id: toastId });
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/files/${fileId}?userId=${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer your-secure-api-key'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      toast.success("File deleted successfully", { id: toastId });
      refetch();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete file");
    }
  };

  const formatFileSize = (sizeStr: string) => {
    const size = parseInt(sizeStr);
    const units = ["B", "KB", "MB", "GB"];
    let unitIndex = 0;
    let fileSize = size;

    while (fileSize >= 1024 && unitIndex < units.length - 1) {
      fileSize /= 1024;
      unitIndex++;
    }

    return `${fileSize.toFixed(2)} ${units[unitIndex]}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const displayedFiles = useMemo(() => {
    if (!data?.files) return [];
    return data.files.filter((file: { id: string; }) => !locallyDeletedFileIds.includes(file.id));
  }, [data?.files, locallyDeletedFileIds]);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Your Files</CardTitle>
        <Select
          value={category}
          onValueChange={setCategory}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="documents">Documents</SelectItem>
            <SelectItem value="images">Images</SelectItem>
            <SelectItem value="videos">Videos</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : isError ? (
          <div className="text-center py-10 text-red-500">
            Failed to load files. Please try again.
          </div>
        ) : displayedFiles?.length > 0 ? (
          <div className="space-y-4">
            {displayedFiles.map((file: FileItem) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <FileIcon className="h-8 w-8 text-blue-500" />
                  <div>
                    <h3 className="font-medium">{file.originalName}</h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span>{formatFileSize(file.fileSize)}</span>
                      <span>•</span>
                      <span>{formatDate(file.uploadedAt)}</span>
                      <Badge variant="outline">{file.category}</Badge>
                      {!isOnline && (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Offline</Badge>
                      )}
                      {file.isComplete ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700">Complete</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                          Processing ({file.chunks}/{file.totalChunks})
                        </Badge>
                      )}
                    </div>
                    {file.description && (
                      <p className="text-sm text-gray-600 mt-1">{file.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadFile(file.id)}
                    disabled={!isOnline || !file.isComplete}
                    title={!isOnline ? "Cannot download files while offline" : ""}
                  >
                    <DownloadIcon className="h-4 w-4 mr-1" />
                    {!isOnline ? "Offline" : (file.isComplete ? "Download" : "Processing...")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => deleteFile(file.id)}
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            <FileIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No files found</p>
            <p className="text-sm mt-2">
              {category !== "all" ? "Try selecting a different category" : "Upload your first file to get started"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}