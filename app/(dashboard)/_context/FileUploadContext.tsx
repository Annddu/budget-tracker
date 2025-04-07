"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "sonner";
import { STORAGE_CONFIG, getOptimalChunkSize } from "@/lib/fileStorage";

// Add this code to use the worker
const createUploadWorker = () => {
  if (typeof window !== 'undefined') {
    return new Worker(new URL('@/lib/uploadWorker.ts', import.meta.url));
  }
  return null;
};

type UploadState = {
  file: File | null;
  progress: number;
  isUploading: boolean;
  category: string;
  description: string;
};

type FileUploadContextType = {
  uploadState: UploadState;
  setFile: (file: File | null) => void;
  setCategory: (category: string) => void;
  setDescription: (description: string) => void;
  startUpload: () => Promise<void>;
  cancelUpload: () => void;
};

const initialState: UploadState = {
  file: null,
  progress: 0,
  isUploading: false,
  category: "general",
  description: "",
};

const FileUploadContext = createContext<FileUploadContextType | undefined>(undefined);

export function FileUploadProvider({ children }: { children: ReactNode }) {
  const [uploadState, setUploadState] = useState<UploadState>(initialState);
  const [worker, setWorker] = useState<Worker | null>(null);

  // Restore state from sessionStorage when component mounts
  useEffect(() => {
    const savedState = sessionStorage.getItem("fileUploadState");
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        // We can't restore the actual File object from sessionStorage,
        // but we can restore other state values
        setUploadState(state => ({
          ...state,
          progress: parsed.progress,
          isUploading: parsed.isUploading,
          category: parsed.category,
          description: parsed.description,
        }));
        
        // If upload was in progress, show a message to the user
        if (parsed.isUploading) {
          toast.info("Your previous upload was interrupted. Please re-select the file and try again.");
          setUploadState(state => ({ ...state, isUploading: false }));
        }
      } catch (error) {
        console.error("Error restoring upload state:", error);
      }
    }
  }, []);

  // Save state to sessionStorage when it changes
  useEffect(() => {
    const stateToSave = {
      ...uploadState,
      // Don't save the actual File object
      file: uploadState.file ? {
        name: uploadState.file.name,
        size: uploadState.file.size,
        type: uploadState.file.type,
      } : null,
    };
    sessionStorage.setItem("fileUploadState", JSON.stringify(stateToSave));
  }, [uploadState]);

  const setFile = (file: File | null) => {
    setUploadState(state => ({ ...state, file }));
  };

  const setCategory = (category: string) => {
    setUploadState(state => ({ ...state, category }));
  };

  const setDescription = (description: string) => {
    setUploadState(state => ({ ...state, description }));
  };

  const startUpload = async () => {
    if (!uploadState.file) return;
    
    setUploadState(state => ({ ...state, isUploading: true, progress: 0 }));
    
    try {
      // Create a worker for this upload
      const worker = createUploadWorker();
      setWorker(worker);
      
      if (!worker) {
        throw new Error("Failed to create upload worker");
      }
      
      // Listen for worker messages
      worker.onmessage = (event) => {
        const message = event.data;
        
        switch (message.type) {
          case 'start':
            console.log(`Starting upload: ${message.totalChunks} chunks, ${message.fileSize} bytes`);
            break;
            
          case 'file-id-received':
            console.log(`File ID received: ${message.fileId}`);
            break;
            
          case 'chunk-complete':
            setUploadState(state => ({ ...state, progress: message.progress }));
            console.log(`Chunk ${message.chunkIndex + 1} uploaded successfully, progress: ${message.progress}%`);
            break;
            
          case 'complete':
            console.log(`Upload complete, fileId: ${message.fileId}`);
            setUploadState({
              file: null,
              progress: 0,
              isUploading: false,
              category: "general",
              description: "",
            });
            toast.success("File uploaded successfully!");
            if (worker) worker.terminate();
            setWorker(null);
            break;
            
          case 'error':
          case 'chunk-error':
          case 'completion-error':
            console.error(`Upload error: ${message.error}`);
            toast.error(`Upload failed: ${message.error}`);
            setUploadState(state => ({ ...state, isUploading: false }));
            if (worker) worker.terminate();
            setWorker(null);
            break;
            
          case 'cancelled':
            toast.info("Upload cancelled");
            setUploadState(state => ({ ...state, isUploading: false, progress: 0 }));
            if (worker) worker.terminate();
            setWorker(null);
            break;
        }
      };
      
      // Read the file as ArrayBuffer
      const arrayBuffer = await uploadState.file.arrayBuffer();
      
      // Calculate optimal chunk size
      const optimalChunkSize = getOptimalChunkSize(uploadState.file.size);
      
      // Start the upload
      worker.postMessage({
        action: 'upload',
        file: arrayBuffer,
        fileName: uploadState.file.name,
        fileType: uploadState.file.type || 'application/octet-stream',
        category: uploadState.category,
        description: uploadState.description,
        chunkSize: optimalChunkSize
      });
      
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
      setUploadState(state => ({ ...state, isUploading: false }));
    }
  };

  const cancelUpload = () => {
    if (worker) {
      worker.postMessage({ action: 'cancel' });
    }
  };

  const uploadLargeFile = async (signal: AbortSignal) => {
    const file = uploadState.file!;
    const chunkSize = STORAGE_CONFIG.chunkSize;
    const fileSize = file.size;
    const totalChunks = Math.ceil(fileSize / chunkSize);
    let uploadedChunks = 0;
    let failedAttempts = 0;
    const MAX_RETRIES = 3;
    
    try {
      let currentChunk = 0;
      let fileId = null;
      
      while (currentChunk < totalChunks) {
        const start = currentChunk * chunkSize;
        const end = Math.min(fileSize, start + chunkSize);
        const chunk = file.slice(start, end);
        
        const formData = new FormData();
        
        if (currentChunk === 0) {
          formData.append("fileName", file.name);
          formData.append("fileType", file.type || "application/octet-stream");
          formData.append("fileSize", fileSize.toString());
          formData.append("totalChunks", totalChunks.toString());
          formData.append("category", uploadState.category);
          formData.append("description", uploadState.description);
        } else {
          formData.append("fileId", fileId!);
        }
        
        formData.append("chunkIndex", currentChunk.toString());
        formData.append("totalChunks", totalChunks.toString());
        formData.append("chunk", chunk);
        
        try {
          console.log(`Uploading chunk ${currentChunk+1}/${totalChunks}, size: ${Math.round((end-start)/1024)}KB`);
          
          // Create a timeout promise to abort if taking too long
          const abortTimeout = setTimeout(() => {
            if (!signal.aborted) {
              console.log(`Chunk ${currentChunk+1} upload timed out, retrying...`);
              controller.abort();
            }
          }, 60000); // 60-second timeout
          
          const controller = new AbortController();
          const fetchSignal = controller.signal;
          
          // Combine the component signal and the timeout signal
          const response = await fetch("/api/files/upload-chunk", {
            method: "POST",
            body: formData,
            signal: fetchSignal
          });
          
          clearTimeout(abortTimeout);
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
          }
          
          const result = await response.json();
          
          if (currentChunk === 0) {
            fileId = result.fileId;
            console.log(`File ID received: ${fileId}`);
          }
          
          // Reset failed attempts counter on success
          failedAttempts = 0;
          
          // Update progress
          uploadedChunks++;
          const progressPercent = Math.floor((uploadedChunks / totalChunks) * 100);
          setUploadState(state => ({ ...state, progress: progressPercent }));
          
          // Move to next chunk
          currentChunk++;
          
        } catch (error) {
          console.error(`Error uploading chunk ${currentChunk+1}:`, error);
          
          failedAttempts++;
          
          if (failedAttempts >= MAX_RETRIES) {
            console.error(`Failed to upload chunk after ${MAX_RETRIES} attempts`);
            throw error;
          }
          
          // Wait before retrying
          await new Promise(r => setTimeout(r, 3000));
          console.log(`Retrying chunk ${currentChunk+1}/${totalChunks}, attempt ${failedAttempts}/${MAX_RETRIES}`);
          // Don't increment currentChunk so we retry the same chunk
        }
      }
      
      // Verify file completion
      try {
        const verifyResponse = await fetch(`/api/files/complete/${fileId}`);
        const verifyResult = await verifyResponse.json();
        
        if (!verifyResult.success) {
          console.warn("File completion warning:", verifyResult);
        }
      } catch (error) {
        console.error("Error verifying file completion:", error);
      }
      
      return { fileId };
    } catch (error) {
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      throw error;
    }
  };

  return (
    <FileUploadContext.Provider
      value={{
        uploadState,
        setFile,
        setCategory,
        setDescription,
        startUpload,
        cancelUpload,
      }}
    >
      {children}
    </FileUploadContext.Provider>
  );
}

export function useFileUpload() {
  const context = useContext(FileUploadContext);
  if (context === undefined) {
    throw new Error("useFileUpload must be used within a FileUploadProvider");
  }
  return context;
}