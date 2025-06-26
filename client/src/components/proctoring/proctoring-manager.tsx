import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface ProctoringManagerProps {
  isActive: boolean;
  onViolation: (violation: ViolationData) => void;
  examId: number;
  submissionId?: number;
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
  faceDetection: boolean;
  browserLocked: boolean;
  violations: ViolationData[];
}

export default function ProctoringManager({ 
  isActive, 
  onViolation, 
  examId, 
  submissionId 
}: ProctoringManagerProps) {
  const [state, setState] = useState<ProctoringState>({
    videoRecording: false,
    screenRecording: false,
    faceDetection: false,
    browserLocked: false,
    violations: []
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const faceDetectionIntervalRef = useRef<number | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const screenChunksRef = useRef<Blob[]>([]);

  const { toast } = useToast();

  // Initialize proctoring when exam starts
  useEffect(() => {
    if (isActive) {
      initializeProctoring();
      enableBrowserLockdown();
    } else {
      stopProctoring();
      disableBrowserLockdown();
    }

    return () => {
      stopProctoring();
      disableBrowserLockdown();
    };
  }, [isActive]);

  const initializeProctoring = async () => {
    try {
      await startVideoRecording();
      await startScreenRecording();
      startFaceDetection();
      
      setState(prev => ({
        ...prev,
        browserLocked: true
      }));

      toast({
        title: "Proctoring Active",
        description: "Video and screen recording started. Browser security enabled."
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 640, 
          height: 480,
          facingMode: "user"
        },
        audio: true
      });

      videoStreamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Start recording in 40-second chunks
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

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
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen'
        },
        audio: true
      });

      screenStreamRef.current = stream;

      const screenRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

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

  const startFaceDetection = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Simple face detection using basic image analysis
    // In production, you would use TensorFlow.js face detection models
    const detectFaces = () => {
      if (!video.videoWidth || !video.videoHeight) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const faces = analyzeFaces(imageData);

      if (faces.length === 0) {
        reportViolation({
          type: 'critical',
          category: 'no_face',
          description: 'No face detected in camera feed'
        });
      } else if (faces.length > 1) {
        reportViolation({
          type: 'critical',
          category: 'multiple_faces',
          description: `Multiple faces detected: ${faces.length} faces`
        });
      }
    };

    faceDetectionIntervalRef.current = window.setInterval(detectFaces, 3000);
    setState(prev => ({ ...prev, faceDetection: true }));
  };

  const analyzeFaces = (imageData: ImageData): any[] => {
    // Simplified face detection logic
    // In production, integrate TensorFlow.js or similar ML library
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Basic skin tone detection as proxy for face presence
    let skinPixels = 0;
    const totalPixels = width * height;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Simple skin tone detection
      if (r > 95 && g > 40 && b > 20 && 
          Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
          Math.abs(r - g) > 15 && r > g && r > b) {
        skinPixels++;
      }
    }
    
    const skinRatio = skinPixels / totalPixels;
    
    // Return mock face array based on skin detection
    if (skinRatio > 0.02) {
      return [{ confidence: skinRatio }]; // One face detected
    }
    
    return []; // No face detected
  };

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
    const formData = new FormData();
    formData.append('video', blob, `video_${examId}_${Date.now()}.webm`);
    formData.append('examId', examId.toString());
    formData.append('submissionId', submissionId?.toString() || '');
    formData.append('type', 'camera');

    try {
      await fetch('/api/upload-proctoring-video', {
        method: 'POST',
        body: formData
      });
    } catch (error) {
      console.error('Failed to upload video chunk:', error);
    }
  };

  const uploadScreenChunk = async () => {
    if (screenChunksRef.current.length === 0) return;

    const blob = new Blob(screenChunksRef.current, { type: 'video/webm' });
    const formData = new FormData();
    formData.append('video', blob, `screen_${examId}_${Date.now()}.webm`);
    formData.append('examId', examId.toString());
    formData.append('submissionId', submissionId?.toString() || '');
    formData.append('type', 'screen');

    try {
      await fetch('/api/upload-proctoring-video', {
        method: 'POST',
        body: formData
      });
    } catch (error) {
      console.error('Failed to upload screen chunk:', error);
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

    // Stop face detection
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
    }

    setState({
      videoRecording: false,
      screenRecording: false,
      faceDetection: false,
      browserLocked: false,
      violations: []
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
      />
      
      {/* Hidden canvas for face detection processing */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Proctoring status indicator */}
      {isActive && (
        <div className="bg-red-600 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">PROCTORED EXAM</span>
          <div className="flex space-x-1">
            {state.videoRecording && (
              <div className="w-2 h-2 bg-green-400 rounded-full" title="Video Recording"></div>
            )}
            {state.screenRecording && (
              <div className="w-2 h-2 bg-blue-400 rounded-full" title="Screen Recording"></div>
            )}
            {state.faceDetection && (
              <div className="w-2 h-2 bg-yellow-400 rounded-full" title="Face Detection"></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}