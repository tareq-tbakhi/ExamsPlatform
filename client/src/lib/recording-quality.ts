interface RecordingQuality {
  video: {
    width: number;
    height: number;
    frameRate: number;
    bitrate: number;
  };
  audio: {
    sampleRate: number;
    bitrate: number;
    channels: number;
  };
}

interface NetworkInfo {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | undefined;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

interface QualitySettings {
  high: RecordingQuality;
  medium: RecordingQuality;
  low: RecordingQuality;
  auto: RecordingQuality;
}

class RecordingQualityManager {
  private currentQuality: RecordingQuality;
  private qualitySettings: QualitySettings;
  private networkMonitorInterval: number | null = null;
  private storageUsage = 0;
  private maxStorageUsage = 500 * 1024 * 1024; // 500MB limit
  
  constructor() {
    this.qualitySettings = {
      high: {
        video: { width: 1280, height: 720, frameRate: 30, bitrate: 2500000 },
        audio: { sampleRate: 48000, bitrate: 128000, channels: 2 }
      },
      medium: {
        video: { width: 854, height: 480, frameRate: 24, bitrate: 1500000 },
        audio: { sampleRate: 44100, bitrate: 96000, channels: 2 }
      },
      low: {
        video: { width: 640, height: 360, frameRate: 15, bitrate: 800000 },
        audio: { sampleRate: 22050, bitrate: 64000, channels: 1 }
      },
      auto: {
        video: { width: 640, height: 480, frameRate: 20, bitrate: 1000000 },
        audio: { sampleRate: 44100, bitrate: 96000, channels: 2 }
      }
    };
    
    this.currentQuality = this.qualitySettings.auto;
    this.startNetworkMonitoring();
  }

  // Get optimal recording constraints based on network and device
  getVideoConstraints(): MediaTrackConstraints {
    const quality = this.getOptimalQuality();
    
    return {
      width: { ideal: quality.video.width },
      height: { ideal: quality.video.height },
      frameRate: { ideal: quality.video.frameRate, max: quality.video.frameRate },
      facingMode: "user"
    };
  }

  getAudioConstraints(): MediaTrackConstraints {
    const quality = this.getOptimalQuality();
    
    return {
      sampleRate: quality.audio.sampleRate,
      channelCount: quality.audio.channels,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    };
  }

  // Get screen recording constraints
  getScreenConstraints(): MediaStreamConstraints {
    const quality = this.getOptimalQuality();
    
    return {
      video: {
        width: { ideal: quality.video.width * 1.5 }, // Higher resolution for screen
        height: { ideal: quality.video.height * 1.5 },
        frameRate: { ideal: Math.min(quality.video.frameRate, 15) } // Lower framerate for screen
      },
      audio: true
    };
  }

  // Get MediaRecorder options with optimal settings
  getRecorderOptions(): MediaRecorderOptions {
    const quality = this.getOptimalQuality();
    
    // Determine best codec based on browser support
    const supportedMimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4'
    ];

    let mimeType = 'video/webm';
    for (const type of supportedMimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }

    return {
      mimeType,
      videoBitsPerSecond: quality.video.bitrate,
      audioBitsPerSecond: quality.audio.bitrate
    };
  }

  // Determine optimal quality based on network and device capabilities
  private getOptimalQuality(): RecordingQuality {
    const networkInfo = this.getNetworkInfo();
    const deviceCapabilities = this.getDeviceCapabilities();
    
    // Auto-adjust quality based on network speed
    if (networkInfo.effectiveType === 'slow-2g' || networkInfo.downlink < 0.5) {
      return this.qualitySettings.low;
    } else if (networkInfo.effectiveType === '2g' || networkInfo.downlink < 1.5) {
      return this.qualitySettings.low;
    } else if (networkInfo.effectiveType === '3g' || networkInfo.downlink < 3) {
      return this.qualitySettings.medium;
    } else if (networkInfo.saveData) {
      return this.qualitySettings.medium;
    } else if (deviceCapabilities.isMobile) {
      return this.qualitySettings.medium;
    }
    
    // Check storage usage
    if (this.storageUsage > this.maxStorageUsage * 0.8) {
      return this.qualitySettings.low;
    }
    
    return this.qualitySettings.auto;
  }

  // Get network information
  private getNetworkInfo(): NetworkInfo {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink || 1,
        rtt: connection.rtt || 100,
        saveData: connection.saveData || false
      };
    }
    
    // Fallback for browsers without Network Information API
    return {
      effectiveType: '4g',
      downlink: 2,
      rtt: 100,
      saveData: false
    };
  }

  // Detect device capabilities
  private getDeviceCapabilities() {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hasLowMemory = (navigator as any).deviceMemory && (navigator as any).deviceMemory < 4;
    const isSlowCPU = (navigator as any).hardwareConcurrency && (navigator as any).hardwareConcurrency < 4;
    
    return {
      isMobile,
      hasLowMemory,
      isSlowCPU,
      supportedCodecs: this.getSupportedCodecs()
    };
  }

  // Check supported video codecs
  private getSupportedCodecs(): string[] {
    const codecs = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8', 
      'video/webm;codecs=h264',
      'video/mp4;codecs=avc1',
      'video/mp4;codecs=h264'
    ];
    
    return codecs.filter(codec => MediaRecorder.isTypeSupported(codec));
  }

  // Monitor network changes and adjust quality
  private startNetworkMonitoring(): void {
    // Monitor network changes
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', () => {
        console.log('Network conditions changed, adjusting recording quality');
        this.currentQuality = this.getOptimalQuality();
      });
    }

    // Periodic quality assessment
    this.networkMonitorInterval = window.setInterval(() => {
      this.assessAndAdjustQuality();
    }, 30000); // Check every 30 seconds
  }

  // Assess current conditions and adjust quality
  private assessAndAdjustQuality(): void {
    const newQuality = this.getOptimalQuality();
    
    if (JSON.stringify(newQuality) !== JSON.stringify(this.currentQuality)) {
      console.log('Recording quality adjusted:', {
        from: this.currentQuality,
        to: newQuality
      });
      this.currentQuality = newQuality;
    }
  }

  // Track storage usage
  updateStorageUsage(bytesUsed: number): void {
    this.storageUsage += bytesUsed;
    
    if (this.storageUsage > this.maxStorageUsage) {
      console.warn('Storage usage approaching limit, reducing quality');
    }
  }

  // Get current quality settings
  getCurrentQuality(): RecordingQuality {
    return { ...this.currentQuality };
  }

  // Get quality recommendations
  getQualityRecommendation(): {
    recommended: keyof QualitySettings;
    reason: string;
    networkInfo: NetworkInfo;
  } {
    const networkInfo = this.getNetworkInfo();
    const deviceCaps = this.getDeviceCapabilities();
    
    let recommended: keyof QualitySettings = 'auto';
    let reason = 'Automatic quality based on current conditions';
    
    if (networkInfo.effectiveType === 'slow-2g' || networkInfo.downlink < 0.5) {
      recommended = 'low';
      reason = 'Poor network connection detected';
    } else if (deviceCaps.isMobile && deviceCaps.hasLowMemory) {
      recommended = 'medium';
      reason = 'Mobile device with limited memory';
    } else if (networkInfo.saveData) {
      recommended = 'medium';
      reason = 'Data saver mode enabled';
    } else if (this.storageUsage > this.maxStorageUsage * 0.8) {
      recommended = 'low';
      reason = 'Storage usage approaching limit';
    }
    
    return { recommended, reason, networkInfo };
  }

  // Cleanup
  destroy(): void {
    if (this.networkMonitorInterval) {
      clearInterval(this.networkMonitorInterval);
    }
  }
}

export const recordingQualityManager = new RecordingQualityManager();
export type { RecordingQuality, NetworkInfo, QualitySettings };