import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { uploadQueue, type UploadStatus } from "@/lib/upload-queue";
import { recordingQualityManager } from "@/lib/recording-quality";
import { multiMonitorDetector, type MonitorConfiguration } from "@/lib/multi-monitor-detection-fixed";
import { applicationMonitor, type ApplicationActivity } from "@/lib/application-monitor";
import { advancedLockdownManager, type SecurityViolation } from "@/lib/advanced-lockdown";

interface ProctoringManagerProps {
  isActive: boolean;
  onViolation: (violation: ViolationData) => void;
  examId: number;
  submissionId?: number;
  onSessionIdReady?: (sessionId: string) => void;
}

interface ViolationData {
  type: 'critical' | 'major' | 'minor';
  category: string;
  description: string;
  evidence?: any;
}

interface ProctoringState {
  videoRecording: boolean;
  screenRecording: boolean;
  browserLocked: boolean;
  violations: ViolationData[];
  uploadStatus: UploadStatus;
  recordingQuality: string;
  networkStatus: 'online' | 'offline' | 'poor';
  // Device Detection
  isMobile: boolean;
  deviceOrientation: 'portrait' | 'landscape';
  // Phase 2: Advanced Monitoring (adapted for mobile)
  monitorConfiguration: MonitorConfiguration | null;
  applicationMonitoring: boolean;
  audioMonitoring: boolean;
  multiMonitorDetected: boolean;
  applicationSwitches: number;
  // Phase 3: Browser Lockdown (mobile-friendly)
  fullscreenLocked: boolean;
  kioskModeActive: boolean;
  securityViolations: number;
  escapeAttempts: number;
  advancedBlocking: boolean;
}

// Generate unique session ID for each exam attempt
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export default function ProctoringManager({ 
  isActive, 
  onViolation, 
  examId, 
  submissionId,
  onSessionIdReady
}: ProctoringManagerProps) {
  // Generate unique session ID for this proctoring session
  const sessionIdRef = useRef<string>(generateSessionId());
  const { toast } = useToast();
  
  // Detect mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                   !!(navigator.maxTouchPoints && navigator.maxTouchPoints > 2);

  const [state, setState] = useState<ProctoringState>({
    videoRecording: false,
    screenRecording: false,
    browserLocked: false,
    violations: [],
    uploadStatus: {
      isOnline: true,
      isUploading: false,
      queueSize: 0,
      lastSync: Date.now()
    },
    recordingQuality: 'auto',
    networkStatus: 'online',
    // Device Detection
    isMobile: isMobile,
    deviceOrientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
    // Phase 2: Advanced Monitoring
    monitorConfiguration: null,
    applicationMonitoring: false,
    audioMonitoring: false,
    multiMonitorDetected: false,
    applicationSwitches: 0,
    // Phase 3: Browser Lockdown (adapted for mobile)
    fullscreenLocked: false,
    kioskModeActive: false,
    securityViolations: 0,
    escapeAttempts: 0,
    advancedBlocking: false
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const screenChunksRef = useRef<Blob[]>([]);

  // Initialize proctoring when exam starts
  useEffect(() => {
    if (isActive) {
      initializeProctoring();
      enableBrowserLockdown();
      setupUploadMonitoring();
      // Notify parent of session ID
      if (onSessionIdReady) {
        onSessionIdReady(sessionIdRef.current);
      }
    } else {
      stopProctoring();
      disableBrowserLockdown();
    }

    return () => {
      stopProctoring();
      disableBrowserLockdown();
    };
  }, [isActive]);

  // Setup upload queue monitoring
  const setupUploadMonitoring = () => {
    const unsubscribe = uploadQueue.onStatusChange((status) => {
      setState(prev => ({
        ...prev,
        uploadStatus: status,
        networkStatus: status.isOnline ? 'online' : 'offline'
      }));
    });

    return unsubscribe;
  };

  const startMobileMonitoring = async () => {
    console.log("Starting mobile-specific monitoring...");
    
    // Monitor orientation changes
    const handleOrientationChange = () => {
      const newOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
      setState(prev => ({ ...prev, deviceOrientation: newOrientation }));
      
      if (newOrientation === 'portrait') {
        reportViolation({
          type: 'minor',
          category: 'device_orientation',
          description: 'Device rotated to portrait mode - recommended to use landscape'
        });
      }
    };

    // Monitor app switching on mobile (limited capabilities)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportViolation({
          type: 'major',
          category: 'app_switch',
          description: 'App switched or minimized during exam'
        });
      }
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Store cleanup functions
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  };

  const initializeProctoring = async () => {
    console.log(`Starting ${isMobile ? 'mobile' : 'desktop'} proctoring for exam ${examId} with session ${sessionIdRef.current}`);
    try {
      // Phase 1: Core Recording Features (adapted for mobile)
      await startVideoRecording();
      
      // Start screen recording for all devices (mobile and desktop)
      try {
        await startScreenRecording();
        console.log("Screen recording started successfully");
      } catch (error) {
        console.warn("Screen recording failed, continuing with camera only:", error);
      }

      if (isMobile) {
        // Mobile: Focus on front camera and orientation monitoring
        console.log("Mobile device detected - using mobile-optimized proctoring");
        await startMobileMonitoring();
      } else {
        // Desktop: Full advanced monitoring
        // Phase 2: Advanced Monitoring
        await initializeMultiMonitorDetection();
        startApplicationMonitoring();
        // Phase 3: Complete Browser Lockdown
        activateAdvancedLockdown();
      }
      
      startEnhancedAudioMonitoring();
      
      setState(prev => ({
        ...prev,
        browserLocked: true,
        applicationMonitoring: !isMobile, // Disable for mobile
        audioMonitoring: true,
        fullscreenLocked: !isMobile, // Disable for mobile
        kioskModeActive: !isMobile, // Disable for mobile
        advancedBlocking: !isMobile // Disable for mobile
      }));

      toast({
        title: isMobile ? "Mobile Proctoring Active" : "Complete Proctoring System Active",
        description: isMobile ? 
          "Camera recording and audio monitoring enabled for mobile exam." :
          "All 3 phases enabled: Screen recording, advanced monitoring, and complete browser lockdown."
      });
    } catch (error) {
      console.error("Failed to initialize proctoring:", error);
      toast({
        title: "Proctoring Error",
        description: "Failed to start proctoring features. Please refresh and try again.",
        variant: "destructive"
      });
    }
  };

  const startVideoRecording = async () => {
    console.log(`Starting video recording with session: ${sessionIdRef.current}`);
    try {
      const videoConstraints = recordingQualityManager.getVideoConstraints();
      const audioConstraints = recordingQualityManager.getAudioConstraints();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: true
      });

      videoStreamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Start recording in 40-second chunks with optimized settings
      const recorderOptions = recordingQualityManager.getRecorderOptions();
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);

      mediaRecorderRef.current = mediaRecorder;
      videoChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        uploadVideoChunk();
      };

      mediaRecorder.start();
      
      // Record in 40-second chunks
      setInterval(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          setTimeout(() => {
            if (mediaRecorderRef.current?.state === 'inactive') {
              videoChunksRef.current = [];
              mediaRecorderRef.current.start();
            }
          }, 100);
        }
      }, 40000);

      setState(prev => ({ ...prev, videoRecording: true }));
    } catch (error) {
      console.error("Video recording failed:", error);
      reportViolation({
        type: 'critical',
        category: 'camera_access_denied',
        description: 'Camera access was denied or failed to initialize'
      });
    }
  };

  const startScreenRecording = async () => {
    try {
      const screenConstraints = recordingQualityManager.getScreenConstraints();
      const stream = await navigator.mediaDevices.getDisplayMedia(screenConstraints);

      screenStreamRef.current = stream;

      const recorderOptions = recordingQualityManager.getRecorderOptions();
      const screenRecorder = new MediaRecorder(stream, recorderOptions);

      screenRecorderRef.current = screenRecorder;
      screenChunksRef.current = [];

      screenRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          screenChunksRef.current.push(event.data);
        }
      };

      screenRecorder.onstop = () => {
        uploadScreenChunk();
      };

      screenRecorder.start();

      // Record screen in 40-second chunks
      setInterval(() => {
        if (screenRecorderRef.current?.state === 'recording') {
          screenRecorderRef.current.stop();
          setTimeout(() => {
            if (screenRecorderRef.current?.state === 'inactive') {
              screenChunksRef.current = [];
              screenRecorderRef.current.start();
            }
          }, 100);
        }
      }, 40000);

      setState(prev => ({ ...prev, screenRecording: true }));
    } catch (error) {
      console.error("Screen recording failed:", error);
      reportViolation({
        type: 'critical',
        category: 'screen_access_denied',
        description: 'Screen sharing was denied or failed to initialize'
      });
    }
  };

  // Face detection removed - focusing on screen activity and behavioral monitoring instead

  const enableBrowserLockdown = () => {
    // Prevent context menu
    document.addEventListener('contextmenu', preventDefaultEvent);
    
    // Prevent developer tools
    document.addEventListener('keydown', handleKeyDown);
    
    // Prevent copy/paste
    document.addEventListener('copy', preventDefaultEvent);
    document.addEventListener('paste', preventDefaultEvent);
    document.addEventListener('cut', preventDefaultEvent);
    
    // Detect tab switching
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    // Prevent selection
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
  };

  const disableBrowserLockdown = () => {
    document.removeEventListener('contextmenu', preventDefaultEvent);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('copy', preventDefaultEvent);
    document.removeEventListener('paste', preventDefaultEvent);
    document.removeEventListener('cut', preventDefaultEvent);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('blur', handleWindowBlur);
    window.removeEventListener('focus', handleWindowFocus);

    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
  };

  const preventDefaultEvent = (e: Event) => {
    e.preventDefault();
    reportViolation({
      type: 'minor',
      category: 'right_click',
      description: 'Attempted to use context menu'
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Prevent F12, Ctrl+Shift+I, Ctrl+U, etc.
    if (e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.shiftKey && e.key === 'C') ||
        (e.ctrlKey && e.key === 'u')) {
      e.preventDefault();
      reportViolation({
        type: 'major',
        category: 'developer_tools',
        description: `Attempted to open developer tools: ${e.key}`
      });
    }

    // Prevent copy/paste shortcuts
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'x')) {
      e.preventDefault();
      reportViolation({
        type: 'major',
        category: 'copy_paste',
        description: `Attempted to ${e.key === 'c' ? 'copy' : e.key === 'v' ? 'paste' : 'cut'}`
      });
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      reportViolation({
        type: 'major',
        category: 'tab_switch',
        description: 'Student switched to another tab or application'
      });
    }
  };

  const handleWindowBlur = () => {
    reportViolation({
      type: 'major',
      category: 'window_blur',
      description: 'Browser window lost focus'
    });
  };

  const handleWindowFocus = () => {
    // Log when window regains focus
    console.log('Window regained focus');
  };

  const uploadVideoChunk = async () => {
    if (videoChunksRef.current.length === 0) return;

    const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
    const uniqueId = submissionId || sessionIdRef.current;
    const filename = `camera_${examId}_${uniqueId}_${Date.now()}_chunk${Math.floor(Date.now() / 40000)}.webm`;
    
    // Debug logging - ensure session ID is used during exam
    console.log(`Camera upload - Using ID: ${uniqueId} (Session: ${sessionIdRef.current})`);
    
    // Track storage usage for quality optimization
    recordingQualityManager.updateStorageUsage(blob.size);
    
    // Add to offline upload queue (handles network failures automatically)
    const uploadId = uploadQueue.addToQueue(blob, filename, examId, submissionId, sessionIdRef.current, 'video');
    
    console.log(`Video chunk queued for upload: ${filename} (${(blob.size / 1024 / 1024).toFixed(2)}MB)`);
    
    // Reset chunk buffer
    videoChunksRef.current = [];
  };

  const uploadScreenChunk = async () => {
    if (screenChunksRef.current.length === 0) return;

    const blob = new Blob(screenChunksRef.current, { type: 'video/webm' });
    const uniqueId = submissionId || sessionIdRef.current;
    const filename = `screen_${examId}_${uniqueId}_${Date.now()}_chunk${Math.floor(Date.now() / 40000)}.webm`;
    
    // Debug logging - ensure session ID is used during exam
    console.log(`Screen upload - Using ID: ${uniqueId} (Session: ${sessionIdRef.current})`);
    
    // Track storage usage for quality optimization
    recordingQualityManager.updateStorageUsage(blob.size);
    
    // Add to offline upload queue (handles network failures automatically)
    const uploadId = uploadQueue.addToQueue(blob, filename, examId, submissionId, sessionIdRef.current, 'screen');
    
    console.log(`Screen chunk queued for upload: ${filename} (${(blob.size / 1024 / 1024).toFixed(2)}MB)`);
    
    // Reset chunk buffer
    screenChunksRef.current = [];
  };

  // Phase 2: Multi-Monitor Detection
  const initializeMultiMonitorDetection = async () => {
    try {
      const config = await multiMonitorDetector.detectMonitors();
      
      setState(prev => ({
        ...prev,
        monitorConfiguration: config,
        multiMonitorDetected: config.totalMonitors > 1
      }));

      // Setup monitor change detection
      multiMonitorDetector.onConfigurationChange((newConfig) => {
        setState(prev => ({
          ...prev,
          monitorConfiguration: newConfig,
          multiMonitorDetected: newConfig.totalMonitors > 1
        }));

        // Report multi-monitor violations
        if (newConfig.totalMonitors > 1) {
          reportViolation({
            type: 'critical',
            category: 'multi_monitor',
            description: `Multiple monitors detected: ${newConfig.totalMonitors} displays. Exam requires single monitor setup.`
          });
        }

        if (newConfig.isExtendedDesktop) {
          reportViolation({
            type: 'critical',
            category: 'extended_desktop',
            description: 'Extended desktop configuration detected. This violates exam security policies.'
          });
        }
      });

      // Check for monitor warnings
      const warnings = multiMonitorDetector.getMonitorWarnings();
      warnings.forEach((warning: string) => {
        reportViolation({
          type: 'major',
          category: 'monitor_warning',
          description: warning
        });
      });

      console.log('Multi-monitor detection initialized:', config);
    } catch (error) {
      console.error('Failed to initialize multi-monitor detection:', error);
    }
  };

  // Phase 2: Application Monitoring
  const startApplicationMonitoring = () => {
    try {
      applicationMonitor.startMonitoring();

      // Setup application violation detection
      applicationMonitor.onViolation((activity) => {
        setState(prev => ({
          ...prev,
          applicationSwitches: prev.applicationSwitches + 1
        }));

        // Report application violations based on risk level
        const appInfo = applicationMonitor.getApplicationRisk(activity.application || 'unknown');
        
        let violationType: 'critical' | 'major' | 'minor' = 'minor';
        if (appInfo.riskLevel === 'critical') violationType = 'critical';
        else if (appInfo.riskLevel === 'high') violationType = 'major';

        reportViolation({
          type: violationType,
          category: 'application_switch',
          description: `Application activity detected: ${activity.windowTitle || activity.application}`,
          evidence: {
            activity,
            riskLevel: appInfo.riskLevel,
            duration: activity.duration
          }
        });
      });

      console.log('Application monitoring started');
    } catch (error) {
      console.error('Failed to start application monitoring:', error);
    }
  };

  // Phase 2: Enhanced Audio Monitoring
  const startEnhancedAudioMonitoring = () => {
    try {
      // Audio level monitoring for detecting suspicious sounds
      if (videoStreamRef.current) {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(videoStreamRef.current);
        const analyser = audioContext.createAnalyser();
        
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const monitorAudio = () => {
          analyser.getByteFrequencyData(dataArray);
          
          // Calculate average audio level
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          
          // Detect unusual audio patterns
          if (average > 50) { // Threshold for suspicious audio
            reportViolation({
              type: 'minor',
              category: 'audio_activity',
              description: `Elevated audio activity detected (level: ${Math.round(average)})`
            });
          }

          // Continue monitoring
          requestAnimationFrame(monitorAudio);
        };

        monitorAudio();
        console.log('Enhanced audio monitoring started');
      }
    } catch (error) {
      console.error('Failed to start enhanced audio monitoring:', error);
    }
  };

  // Phase 3: Advanced Browser Lockdown
  const activateAdvancedLockdown = () => {
    try {
      // Configure complete lockdown
      advancedLockdownManager.activateLockdown({
        forceFullscreen: true,
        preventPrintScreen: true,
        blockNavigation: true,
        kioskMode: true,
        enhancedBlocking: true,
        autoReentry: true
      });

      // Setup security violation monitoring
      advancedLockdownManager.onViolation((violation) => {
        setState(prev => ({
          ...prev,
          securityViolations: prev.securityViolations + 1,
          escapeAttempts: violation.type === 'escape_attempt' ? prev.escapeAttempts + 1 : prev.escapeAttempts
        }));

        // Report security violations with appropriate severity
        reportViolation({
          type: violation.severity === 'critical' ? 'critical' : violation.severity === 'high' ? 'major' : 'minor',
          category: `security_${violation.type}`,
          description: `Advanced security violation: ${violation.details}`,
          evidence: {
            securityViolation: violation,
            lockdownStatus: advancedLockdownManager.getSecurityStatus()
          }
        });
      });

      console.log('Advanced browser lockdown activated');
    } catch (error) {
      console.error('Failed to activate advanced lockdown:', error);
    }
  };

  const reportViolation = useCallback((violation: ViolationData) => {
    setState(prev => ({
      ...prev,
      violations: [...prev.violations, violation]
    }));
    onViolation(violation);

    // Show toast for major/critical violations
    if (violation.type !== 'minor') {
      toast({
        title: `${violation.type.toUpperCase()} Violation`,
        description: violation.description,
        variant: "destructive"
      });
    }
  }, [onViolation, toast]);

  const stopProctoring = () => {
    // Stop video recording
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Stop screen recording
    if (screenRecorderRef.current?.state === 'recording') {
      screenRecorderRef.current.stop();
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Face detection removed - focusing on screen activity and behavioral monitoring

    // Phase 2: Stop advanced monitoring
    multiMonitorDetector.stopMonitoring();
    applicationMonitor.stopMonitoring();

    // Phase 3: Deactivate advanced lockdown system
    advancedLockdownManager.deactivateLockdown();

    // Reset all proctoring state
    setState(prev => ({
      ...prev,
      videoRecording: false,
      screenRecording: false,
      browserLocked: false,
      applicationMonitoring: false,
      audioMonitoring: false,
      fullscreenLocked: false,
      kioskModeActive: false,
      advancedBlocking: false,
      securityViolations: 0,
      escapeAttempts: 0
    }));

    toast({
      title: "Exam Completed",
      description: "All proctoring features have been safely disabled.",
    });
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* Hidden video element for face detection */}
      <video 
        ref={videoRef} 
        className="hidden" 
        autoPlay 
        muted 
        playsInline 
        data-proctoring="true"
      />
      
      {/* Hidden canvas for face detection processing */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Enhanced Phase 1 Status Indicator */}
      {isActive && (
        <div className="fixed top-4 right-4 z-50 bg-black/90 text-white p-4 rounded-lg shadow-xl max-w-xs border border-gray-600">
          <div className="flex items-center space-x-2 mb-3">
            <div className={`w-3 h-3 rounded-full ${state.networkStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-sm font-bold">PHASE 1 PROCTORING</span>
          </div>
          
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span>Video Recording:</span>
              <div className="flex items-center space-x-1">
                <span className={state.videoRecording ? 'text-green-400' : 'text-red-400'}>
                  {state.videoRecording ? 'ACTIVE' : 'INACTIVE'}
                </span>
                {state.videoRecording && <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>}
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span>Screen Recording:</span>
              <div className="flex items-center space-x-1">
                <span className={state.screenRecording ? 'text-green-400' : 'text-red-400'}>
                  {state.screenRecording ? 'ACTIVE' : 'INACTIVE'}
                </span>
                {state.screenRecording && <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>}
              </div>
            </div>
            
            <div className="flex justify-between">
              <span>Quality Mode:</span>
              <span className="text-blue-400 font-medium">{state.recordingQuality.toUpperCase()}</span>
            </div>
            
            <div className="flex justify-between">
              <span>Upload Queue:</span>
              <span className={state.uploadStatus.queueSize > 0 ? 'text-yellow-400' : 'text-green-400'}>
                {state.uploadStatus.queueSize} chunks
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>Network Status:</span>
              <span className={state.networkStatus === 'online' ? 'text-green-400' : 'text-red-400'}>
                {state.networkStatus.toUpperCase()}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>Security Violations:</span>
              <span className={state.violations.length > 0 ? 'text-red-400 font-bold' : 'text-green-400'}>
                {state.violations.length}
              </span>
            </div>
            
            <hr className="border-gray-600 my-2" />
            
            <div className="flex justify-between">
              <span>Multi-Monitor:</span>
              <span className={state.multiMonitorDetected ? 'text-red-400 font-bold' : 'text-green-400'}>
                {state.multiMonitorDetected ? 'DETECTED' : 'SINGLE'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>App Monitoring:</span>
              <span className={state.applicationMonitoring ? 'text-green-400' : 'text-red-400'}>
                {state.applicationMonitoring ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>App Switches:</span>
              <span className={state.applicationSwitches > 5 ? 'text-red-400 font-bold' : 'text-yellow-400'}>
                {state.applicationSwitches}
              </span>
            </div>
            
            <hr className="border-gray-600 my-2" />
            
            <div className="flex justify-between">
              <span>Fullscreen Lock:</span>
              <span className={state.fullscreenLocked ? 'text-green-400' : 'text-red-400'}>
                {state.fullscreenLocked ? 'LOCKED' : 'UNLOCKED'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>Kiosk Mode:</span>
              <span className={state.kioskModeActive ? 'text-green-400' : 'text-red-400'}>
                {state.kioskModeActive ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>Escape Attempts:</span>
              <span className={state.escapeAttempts > 0 ? 'text-red-400 font-bold' : 'text-green-400'}>
                {state.escapeAttempts}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>Security Violations:</span>
              <span className={state.securityViolations > 0 ? 'text-red-400 font-bold' : 'text-green-400'}>
                {state.securityViolations}
              </span>
            </div>
            
            <hr className="border-gray-600 my-2" />
            
            <div className="text-center text-gray-300 text-xs">
              <div className="font-medium text-green-400 mb-1">PHASE 1 ✓</div>
              <div className="text-xs mb-2">Offline Queue • Quality Control • Recovery</div>
              
              <div className="font-medium text-blue-400 mb-1">PHASE 2 ✓</div>
              <div className="text-xs mb-2">Multi-Monitor • App Tracking • Audio Analysis</div>
              
              <div className="font-medium text-purple-400 mb-1">PHASE 3 ✓</div>
              <div className="text-xs">Fullscreen Lock • Kiosk Mode • Enhanced Security</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}