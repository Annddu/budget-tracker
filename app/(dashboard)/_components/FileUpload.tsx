"use client";

import { useRef, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFileUpload } from "../_context/FileUploadContext";
import { useNetwork } from '../_context/NetworkStatusProvider';
import { CloudOff } from 'lucide-react';

export default function FileUpload() {
  const { 
    uploadState, 
    setFile, 
    setCategory, 
    setDescription, 
    startUpload, 
    cancelUpload 
  } = useFileUpload();
  
  const { isOnline } = useNetwork();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const formatFileSize = (size: number) => {
    const units = ["B", "KB", "MB", "GB"];
    let unitIndex = 0;
    let fileSize = size;
    
    while (fileSize >= 1024 && unitIndex < units.length - 1) {
      fileSize /= 1024;
      unitIndex++;
    }
    
    return `${fileSize.toFixed(2)} ${units[unitIndex]}`;
  };

  const handleClearForm = () => {
    setFile(null);
    setCategory("general");
    setDescription("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload File</CardTitle>
        {!isOnline && (
          <div className="flex items-center mt-2 p-2 bg-yellow-50 rounded text-yellow-700 text-sm">
            <CloudOff className="h-4 w-4 mr-2" />
            <span>File uploads are disabled while offline</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file">Select File</Label>
          <Input
            id="file"
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={uploadState.isUploading || !isOnline}
          />
        </div>
        
        {uploadState.file && (
          <div className="text-sm">
            Selected: <strong>{uploadState.file.name}</strong> ({formatFileSize(uploadState.file.size)})
          </div>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={uploadState.category}
            onValueChange={setCategory}
            disabled={uploadState.isUploading}
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="documents">Documents</SelectItem>
              <SelectItem value="images">Images</SelectItem>
              <SelectItem value="videos">Videos</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            placeholder="Add a description for your file"
            value={uploadState.description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={uploadState.isUploading}
          />
        </div>
        
        {uploadState.isUploading && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Uploading...</span>
              <span>{uploadState.progress}%</span>
            </div>
            <Progress value={uploadState.progress} />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleClearForm}
          disabled={!uploadState.file || uploadState.isUploading}
        >
          Cancel
        </Button>
        {uploadState.isUploading ? (
          <Button 
            variant="destructive"
            onClick={cancelUpload}
          >
            Cancel Upload
          </Button>
        ) : (
          <Button 
            onClick={startUpload} 
            disabled={!uploadState.file || uploadState.isUploading || !isOnline}
            title={!isOnline ? "Cannot upload files while offline" : ""}
          >
            {!isOnline ? 'Server Offline' : 'Upload'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}