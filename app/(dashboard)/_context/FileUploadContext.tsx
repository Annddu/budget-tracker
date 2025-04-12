"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "sonner";
import { STORAGE_CONFIG, getOptimalChunkSize } from "@/lib/fileStorage";
import { API_BASE_URL } from "@/lib/constants";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";

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
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const savedState = sessionStorage.getItem("fileUploadState");
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setUploadState(state => ({
          ...state,
          progress: parsed.progress,
          isUploading: parsed.isUploading,
          category: parsed.category,
          description: parsed.description,
        }));

        if (parsed.isUploading) {
          toast.info("Your previous upload was interrupted. Please re-select the file and try again.");
          setUploadState(state => ({ ...state, isUploading: false }));
        }
      } catch (error) {
        console.error("Error restoring upload state:", error);
      }
    }
  }, []);

  useEffect(() => {
    const stateToSave = {
      ...uploadState,
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
    if (!uploadState.file || uploadState.isUploading || !userId) return;

    setUploadState(state => ({ ...state, isUploading: true, progress: 0 }));
    const toastId = `upload-${Date.now()}`;
    toast.loading("Preparing upload...", { id: toastId });

    try {
      const worker = createUploadWorker();
      setWorker(worker);

      if (!worker) {
        throw new Error("Failed to create upload worker");
      }

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
            toast.success("File uploaded successfully!", { id: toastId });
            queryClient.invalidateQueries({ queryKey: ["files"] });
            if (worker) worker.terminate();
            setWorker(null);
            break;

          case 'error':
          case 'chunk-error':
          case 'completion-error':
            console.error(`Upload error: ${message.error}`);
            toast.error(`Upload failed: ${message.error}`, { id: toastId });
            setUploadState(state => ({ ...state, isUploading: false }));
            if (worker) worker.terminate();
            setWorker(null);
            break;

          case 'cancelled':
            toast.info("Upload cancelled", { id: toastId });
            setUploadState(state => ({ ...state, isUploading: false, progress: 0 }));
            if (worker) worker.terminate();
            setWorker(null);
            break;
        }
      };

      const arrayBuffer = await uploadState.file.arrayBuffer();
      const optimalChunkSize = getOptimalChunkSize(uploadState.file.size);

      worker.postMessage({
        action: 'upload',
        file: arrayBuffer,
        fileName: uploadState.file.name,
        fileType: uploadState.file.type || 'application/octet-stream',
        category: uploadState.category,
        description: uploadState.description,
        chunkSize: optimalChunkSize,
        userId: userId,
        apiBaseUrl: API_BASE_URL
      });

    } catch (error) {
      console.error("Upload failed:", error);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : String(error)}`, { id: toastId });
      setUploadState(state => ({ ...state, isUploading: false }));
    }
  };

  const cancelUpload = () => {
    if (worker) {
      worker.postMessage({ action: 'cancel' });
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