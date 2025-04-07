"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DownloadIcon, FileIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
  
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["files", category],
    queryFn: async () => {
      const categoryParam = category !== "all" ? `&category=${category}` : "";
      const response = await fetch(`/api/files?${categoryParam}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }
      
      return response.json();
    },
  });
  
  const downloadFile = async (fileId: string) => {
    try {
      window.open(`/api/files/download/${fileId}`, '_blank');
      toast.success("Download started");
      refetch(); // Refresh to update download count
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download file");
    }
  };
  
  const deleteFile = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) {
      return;
    }
    
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete file");
      }
      
      toast.success("File deleted successfully");
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
  
  return (
    <Card className="w-full max-w-4xl mx-auto">
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
        ) : data?.files?.length > 0 ? (
          <div className="space-y-4">
            {data.files.map((file: FileItem) => (
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
                      
                      {/* Add status indicator */}
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
                    disabled={!file.isComplete}
                  >
                    <DownloadIcon className="h-4 w-4 mr-1" />
                    {file.isComplete ? "Download" : "Processing..."}
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