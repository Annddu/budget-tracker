// This will be our Web Worker file

// Custom type for messages from the main thread
type UploadMessage = {
  action: 'upload';
  file: ArrayBuffer;
  fileName: string;
  fileType: string;
  category: string;
  description: string;
  chunkSize: number;
} | {
  action: 'cancel';
};

// Handle messages from the main thread
self.onmessage = async (event: MessageEvent<UploadMessage>) => {
  const message = event.data;
  
  if (message.action === 'cancel') {
    self.postMessage({ type: 'cancelled' });
    return;
  }
  
  if (message.action === 'upload') {
    try {
      await uploadFile(
        message.file, 
        message.fileName,
        message.fileType,
        message.category,
        message.description,
        message.chunkSize
      );
    } catch (error) {
      self.postMessage({ 
        type: 'error', 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
};

async function uploadFile(
  fileBuffer: ArrayBuffer, 
  fileName: string,
  fileType: string,
  category: string,
  description: string,
  chunkSize: number
) {
  const fileSize = fileBuffer.byteLength;
  const totalChunks = Math.ceil(fileSize / chunkSize);
  
  // Post initial message
  self.postMessage({ 
    type: 'start', 
    totalChunks, 
    fileSize 
  });
  
  let fileId: string | null = null;
  
  // Upload chunks
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(fileSize, start + chunkSize);
    const chunkBuffer = fileBuffer.slice(start, end);
    
    try {
      // Create form data
      const formData = new FormData();
      
      if (chunkIndex === 0) {
        formData.append("fileName", fileName);
        formData.append("fileType", fileType);
        formData.append("fileSize", fileSize.toString());
        formData.append("totalChunks", totalChunks.toString());
        formData.append("category", category);
        formData.append("description", description);
      } else {
        formData.append("fileId", fileId!);
      }
      
      formData.append("chunkIndex", chunkIndex.toString());
      formData.append("totalChunks", totalChunks.toString());
      
      // Convert ArrayBuffer to Blob for the chunk
      const chunkBlob = new Blob([chunkBuffer], { type: fileType });
      formData.append("chunk", chunkBlob);
      
      // Send chunk
      self.postMessage({ 
        type: 'uploading-chunk', 
        chunkIndex, 
        totalChunks 
      });
      
      // Upload with retry
      let retries = 0;
      const MAX_RETRIES = 3;
      let success = false;
      
      while (retries < MAX_RETRIES && !success) {
        try {
          const response = await fetch("/api/files/upload-chunk", {
            method: "POST",
            body: formData
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
          }
          
          const result = await response.json();
          
          if (chunkIndex === 0) {
            fileId = result.fileId;
            self.postMessage({ 
              type: 'file-id-received', 
              fileId 
            });
          }
          
          success = true;
        } catch (error) {
          retries++;
          if (retries >= MAX_RETRIES) throw error;
          
          // Wait before retry with exponential backoff
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries)));
          self.postMessage({ 
            type: 'retry-chunk', 
            chunkIndex, 
            attempt: retries 
          });
        }
      }
      
      // Report progress
      self.postMessage({ 
        type: 'chunk-complete', 
        chunkIndex, 
        progress: Math.floor(((chunkIndex + 1) / totalChunks) * 100) 
      });
    } catch (error) {
      self.postMessage({ 
        type: 'chunk-error', 
        chunkIndex, 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  // Verify file completion
  if (fileId) {
    try {
      const response = await fetch(`/api/files/complete/${fileId}`);
      const result = await response.json();
      
      if (result.success) {
        self.postMessage({ 
          type: 'complete', 
          fileId 
        });
      } else {
        throw new Error(result.error || "File completion failed");
      }
    } catch (error) {
      self.postMessage({ 
        type: 'completion-error', 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}