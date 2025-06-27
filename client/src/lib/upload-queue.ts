interface QueuedUpload {
  id: string;
  blob: Blob;
  filename: string;
  examId: number;
  submissionId?: number;
  sessionId?: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  type: 'video' | 'screen';
}

interface UploadStatus {
  isOnline: boolean;
  isUploading: boolean;
  queueSize: number;
  lastSync: number;
}

class UploadQueue {
  private queue: QueuedUpload[] = [];
  private isProcessing = false;
  private statusCallbacks: ((status: UploadStatus) => void)[] = [];
  private retryTimeouts: Map<string, number> = new Map();
  
  constructor() {
    this.loadQueueFromStorage();
    this.setupNetworkMonitoring();
    this.startPeriodicSync();
  }

  // Add upload to queue
  addToQueue(
    blob: Blob, 
    filename: string, 
    examId: number, 
    submissionId?: number,
    sessionId?: string,
    type: 'video' | 'screen' = 'video'
  ): string {
    const id = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const upload: QueuedUpload = {
      id,
      blob,
      filename,
      examId,
      submissionId,
      sessionId,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 5,
      type
    };

    this.queue.push(upload);
    this.saveQueueToStorage();
    this.notifyStatusChange();
    
    // Try immediate upload if online
    if (navigator.onLine) {
      this.processQueue();
    }
    
    return id;
  }

  // Process upload queue
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    this.notifyStatusChange();

    while (this.queue.length > 0 && navigator.onLine) {
      const upload = this.queue[0];
      
      try {
        await this.uploadFile(upload);
        this.queue.shift(); // Remove successful upload
        this.clearRetryTimeout(upload.id);
        console.log(`Successfully uploaded: ${upload.filename}`);
      } catch (error) {
        console.error(`Upload failed for ${upload.filename}:`, error);
        await this.handleUploadFailure(upload);
        break; // Stop processing on failure
      }
    }

    this.isProcessing = false;
    this.saveQueueToStorage();
    this.notifyStatusChange();
  }

  // Upload single file
  private async uploadFile(upload: QueuedUpload): Promise<void> {
    const formData = new FormData();
    formData.append('video', upload.blob, upload.filename);
    formData.append('examId', upload.examId.toString());
    if (upload.submissionId) {
      formData.append('submissionId', upload.submissionId.toString());
    }
    if (upload.sessionId) {
      formData.append('sessionId', upload.sessionId);
    }
    formData.append('type', upload.type);
    
    console.log(`Uploading: ${upload.filename} with sessionId: ${upload.sessionId}`);

    const response = await fetch('/api/upload-proctoring-video', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }
  }

  // Handle upload failure with exponential backoff
  private async handleUploadFailure(upload: QueuedUpload): Promise<void> {
    upload.retryCount++;
    
    if (upload.retryCount >= upload.maxRetries) {
      console.error(`Max retries exceeded for ${upload.filename}, removing from queue`);
      this.queue.shift();
      return;
    }

    // Exponential backoff: 2^retryCount seconds (max 5 minutes)
    const backoffTime = Math.min(Math.pow(2, upload.retryCount) * 1000, 300000);
    
    console.log(`Retrying upload ${upload.filename} in ${backoffTime/1000} seconds (attempt ${upload.retryCount}/${upload.maxRetries})`);
    
    const timeoutId = window.setTimeout(() => {
      this.processQueue();
    }, backoffTime);
    
    this.retryTimeouts.set(upload.id, timeoutId);
  }

  // Network monitoring
  private setupNetworkMonitoring(): void {
    window.addEventListener('online', () => {
      console.log('Network connection restored, processing upload queue');
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      console.log('Network connection lost, uploads will queue locally');
      this.notifyStatusChange();
    });
  }

  // Periodic sync every 30 seconds
  private startPeriodicSync(): void {
    setInterval(() => {
      if (navigator.onLine && this.queue.length > 0) {
        this.processQueue().catch(error => {
          console.error('Queue processing error:', error);
        });
      }
    }, 30000);
  }

  // Storage management
  private saveQueueToStorage(): void {
    try {
      const queueData = this.queue.map(upload => ({
        ...upload,
        blob: undefined // Don't store blob in localStorage
      }));
      localStorage.setItem('proctoring_upload_queue', JSON.stringify(queueData));
    } catch (error) {
      console.error('Failed to save queue to storage:', error);
    }
  }

  private loadQueueFromStorage(): void {
    try {
      const queueData = localStorage.getItem('proctoring_upload_queue');
      if (queueData) {
        // Note: Blobs cannot be restored from localStorage
        // This is for metadata tracking only
        console.log('Upload queue metadata loaded from storage');
      }
    } catch (error) {
      console.error('Failed to load queue from storage:', error);
    }
  }

  // Status management
  private notifyStatusChange(): void {
    const status: UploadStatus = {
      isOnline: navigator.onLine,
      isUploading: this.isProcessing,
      queueSize: this.queue.length,
      lastSync: Date.now()
    };

    this.statusCallbacks.forEach(callback => callback(status));
  }

  // Public API
  onStatusChange(callback: (status: UploadStatus) => void): () => void {
    this.statusCallbacks.push(callback);
    
    // Return cleanup function
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusCallbacks.splice(index, 1);
      }
    };
  }

  getStatus(): UploadStatus {
    return {
      isOnline: navigator.onLine,
      isUploading: this.isProcessing,
      queueSize: this.queue.length,
      lastSync: Date.now()
    };
  }

  clearQueue(): void {
    this.queue = [];
    this.retryTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.retryTimeouts.clear();
    this.saveQueueToStorage();
    this.notifyStatusChange();
  }

  // Update submission ID for uploads with matching session ID
  updateSubmissionId(sessionId: string, submissionId: number): void {
    let updated = false;
    this.queue.forEach(upload => {
      if (upload.sessionId === sessionId && !upload.submissionId) {
        upload.submissionId = submissionId;
        updated = true;
        console.log(`Updated upload ${upload.filename} with submission ID: ${submissionId}`);
      }
    });
    
    if (updated) {
      this.saveQueueToStorage();
      this.notifyStatusChange();
      // Re-process queue to upload with updated submission ID
      this.processQueue();
    }
  }

  private clearRetryTimeout(uploadId: string): void {
    const timeoutId = this.retryTimeouts.get(uploadId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.retryTimeouts.delete(uploadId);
    }
  }
}

export const uploadQueue = new UploadQueue();
export type { UploadStatus, QueuedUpload };