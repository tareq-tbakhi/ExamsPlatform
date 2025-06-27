import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, StopCircle, Mic, MicOff, Camera, CameraOff, Edit2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// TypeScript declaration for global auto-save function
declare global {
  interface Window {
    videoRecorderAutoSave?: () => Promise<void>;
  }
}

// Multi-language Speech Recognition Class for client-side transcription
class MultiLanguageVideoTranscriber {
  recognition: any = null;
  transcript: string = '';
  isRecording: boolean = false;
  continuousMode: boolean = true;
  currentLanguage: string = 'ar-SA'; // Default to Arabic
  onTranscriptUpdate: (finalText: string, interimText: string) => void = () => {};

  constructor() {
    this.initSpeechRecognition();
  }

  initSpeechRecognition() {
    // Check if browser supports speech recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    // Configure for Arabic and English support
    this.recognition.lang = this.currentLanguage;
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.recognition.onstart = () => {
      console.log('Arabic speech recognition started');
      this.isRecording = true;
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let newFinalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinalText += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      // Accumulate final text instead of overwriting
      if (newFinalText) {
        this.transcript += newFinalText;
      }
      
      // Send both accumulated final text and current interim text
      this.onTranscriptUpdate(this.transcript, interimTranscript);
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      this.isRecording = false;
      
      // Auto-restart for continuous transcription if in continuous mode
      if (this.continuousMode) {
        setTimeout(() => {
          if (this.recognition && this.continuousMode) {
            try {
              this.recognition.start();
              console.log('Auto-restarted speech recognition for continuous transcription');
            } catch (error) {
              console.log('Auto-restart failed, will try again:', error);
              // Try again after a longer delay if first attempt fails
              setTimeout(() => {
                if (this.recognition && this.continuousMode) {
                  try {
                    this.recognition.start();
                  } catch (e) {
                    console.log('Second auto-restart attempt failed:', e);
                  }
                }
              }, 1000);
            }
          }
        }, 100);
      }
    };
  }

  startTranscription() {
    if (this.recognition && !this.isRecording) {
      this.recognition.start();
    }
  }

  stopTranscription() {
    // Only stop if not in continuous mode or explicitly requested
    if (this.recognition && this.isRecording && !this.continuousMode) {
      this.recognition.stop();
    }
  }

  // Force stop transcription (used when exam is completely finished)
  forceStopTranscription() {
    this.continuousMode = false;
    if (this.recognition && this.isRecording) {
      this.recognition.stop();
    }
  }

  // Enable continuous mode for the exam session
  enableContinuousMode() {
    this.continuousMode = true;
    this.startTranscription();
  }

  getFullTranscript() {
    return this.transcript;
  }
}

interface VideoRecorderProps {
  questionId: number;
  submissionId: number;
  questionType: "video_response" | "audio_response";
  onRecordingComplete: (transcription: string, confidence: number) => void;
  onValidationComplete: (isValid: boolean, feedback: string, score: number) => void;
  onAutoSave?: () => void; // Callback for when auto-save is triggered
}

export function VideoRecorder({
  questionId,
  submissionId,
  questionType,
  onRecordingComplete,
  onValidationComplete,
  onAutoSave
}: VideoRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState("");
  const [editableTranscript, setEditableTranscript] = useState("");
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [validationStatus, setValidationStatus] = useState<{
    isValid?: boolean;
    feedback?: string;
    score?: number;
    completed?: boolean;
  }>({});
  const [continuousTranscriptionActive, setContinuousTranscriptionActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriberRef = useRef<MultiLanguageVideoTranscriber | null>(null);
  
  const { toast } = useToast();

  // Initialize transcriber once and reset for each question
  useEffect(() => {
    // Initialize transcriber if not exists
    if (!transcriberRef.current) {
      transcriberRef.current = new MultiLanguageVideoTranscriber();
      transcriberRef.current.onTranscriptUpdate = (finalText: string, interimText: string) => {
        const fullText = finalText + interimText;
        setTranscription(fullText);
        // Sync editable transcript only if not currently editing
        if (!isEditingTranscript) {
          setEditableTranscript(fullText);
        }
      };
    }
  }, []);

  // Reset everything when question changes - individual recording per question
  useEffect(() => {
    // Reset state for new question
    setRecordedBlob(null);
    setIsProcessing(false);
    setRecordingTime(0);
    setValidationStatus({});
    setTranscription("");
    setEditableTranscript("");
    setContinuousTranscriptionActive(false);
    
    // Reset transcriber for new question
    if (transcriberRef.current) {
      transcriberRef.current.transcript = '';
      transcriberRef.current.continuousMode = false;
    }
    
    console.log(`Reset video recorder for question ${questionId}`);
  }, [questionId]);

  // Request camera/microphone permissions or reuse existing stream
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        // Check if proctoring system already has a camera stream
        const existingVideoElement = document.querySelector('video[data-proctoring="true"]') as HTMLVideoElement;
        
        if (existingVideoElement && existingVideoElement.srcObject && questionType === "video_response") {
          // Reuse the existing proctoring camera stream
          const existingStream = existingVideoElement.srcObject as MediaStream;
          setMediaStream(existingStream);
          setPermissionGranted(true);
          
          if (videoRef.current) {
            videoRef.current.srcObject = existingStream;
          }
        } else {
          // Fallback to requesting new stream if proctoring stream isn't available
          const constraints = questionType === "video_response" 
            ? { video: true, audio: true }
            : { audio: true };
            
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          setMediaStream(stream);
          setPermissionGranted(true);
          
          if (videoRef.current && questionType === "video_response") {
            videoRef.current.srcObject = stream;
          }
        }
        
        toast({
          title: "Camera Access Granted",
          description: questionType === "video_response" 
            ? "Camera and microphone are ready for recording"
            : "Microphone is ready for recording"
        });

        // Auto-start recording once permissions are granted
        setTimeout(() => {
          startRecording();
        }, 1000);
      } catch (error) {
        console.error("Permission denied:", error);
        toast({
          title: "Permission Required",
          description: `Please allow ${questionType === "video_response" ? "camera and microphone" : "microphone"} access to record your answer`,
          variant: "destructive"
        });
      }
    };

    requestPermissions();

    return () => {
      if (mediaStream && !document.querySelector('video[data-proctoring="true"]')) {
        // Only stop the stream if it's not being used by proctoring
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [questionType, toast, mediaStream]);

  // Timer for recording duration
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    if (!mediaStream) {
      toast({
        title: "No Media Stream",
        description: "Please grant camera/microphone permissions first",
        variant: "destructive"
      });
      return;
    }

    try {
      chunksRef.current = [];
      const options = questionType === "video_response" 
        ? { mimeType: 'video/webm;codecs=vp8,opus' }
        : { mimeType: 'audio/webm;codecs=opus' };

      const mediaRecorder = new MediaRecorder(mediaStream, options);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { 
          type: questionType === "video_response" ? 'video/webm' : 'audio/webm' 
        });
        setRecordedBlob(blob);
        processRecording(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start JavaScript-based Arabic transcription
      if (transcriberRef.current) {
        transcriberRef.current.startTranscription();
        setContinuousTranscriptionActive(true);
      }

      toast({
        title: "Recording Started",
        description: `${questionType === "video_response" ? "Video" : "Audio"} recording is now active`
      });
    } catch (error) {
      console.error("Recording error:", error);
      toast({
        title: "Recording Error",
        description: "Failed to start recording. Please try again.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // DON'T stop transcription - keep it running continuously
      // Only the video recording stops, transcription continues

      toast({
        title: "Recording Stopped",
        description: "Processing your recording... (Transcription continues running)"
      });
    }
  };

  const processRecording = async (blob: Blob) => {
    setIsProcessing(true);
    
    try {
      // Use editable transcript if user has edited it, otherwise use live transcription
      const finalTranscript = isEditingTranscript ? editableTranscript : (transcriberRef.current?.getFullTranscript() || '');
      const confidence = 0.85; // JavaScript speech recognition typical confidence
      
      console.log(`JavaScript transcription completed: "${finalTranscript}"`);
      
      setTranscription(finalTranscript);
      setEditableTranscript(finalTranscript);
      onRecordingComplete(finalTranscript, confidence);

      // Upload the video file to be stored as an answer
      const videoFormData = new FormData();
      videoFormData.append('video', blob, `answer_${questionId}_${Date.now()}.webm`);
      videoFormData.append('questionId', questionId.toString());
      videoFormData.append('submissionId', submissionId.toString());
      videoFormData.append('transcript', finalTranscript);
      videoFormData.append('confidence', confidence.toString());
      videoFormData.append('duration', recordingTime.toString());

      try {
        const uploadRes = await fetch('/api/upload-video-answer', {
          method: 'POST',
          body: videoFormData
        });
        const uploadResponse = await uploadRes.json();
        console.log('Video answer uploaded successfully:', uploadResponse);
      } catch (uploadError) {
        console.error('Failed to upload video answer:', uploadError);
      }

      // Now validate the answer using OpenAI
      const validationRes = await fetch('/api/validate-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questionId,
          submissionId,
          transcription: finalTranscript,
          questionType
        })
      });
      const validationResponse = await validationRes.json();

      if (validationResponse.isValid !== undefined) {
        const validation = {
          isValid: validationResponse.isValid,
          feedback: validationResponse.feedback || "Answer processed successfully",
          score: validationResponse.score || 0,
          completed: true
        };
        
        setValidationStatus(validation);
        
        onValidationComplete(
          validation.isValid,
          validation.feedback,
          validation.score
        );
      }

      toast({
        title: "Processing Complete",
        description: "Your recording has been transcribed and validated"
      });

    } catch (error) {
      console.error("Processing error:", error);
      toast({
        title: "Processing Error",
        description: "Failed to process recording. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-save function for when user clicks "Next"
  const autoSave = async () => {
    if (isRecording && mediaRecorderRef.current) {
      // Stop current recording
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop transcription and capture final transcript
      if (transcriberRef.current) {
        transcriberRef.current.stopTranscription();
        setContinuousTranscriptionActive(false);
      }
      
      console.log(`Auto-saved question ${questionId}: Recording stopped, transcript captured`);
      
      // Call the processing function with current recorded blob
      if (recordedBlob) {
        await processRecording(recordedBlob);
      }
    }
  };

  // Make auto-save accessible from parent component
  window.videoRecorderAutoSave = autoSave;

  if (!permissionGranted) {
    return (
      <Card className="w-full">
        <CardContent className="text-center py-8">
          <div className="mb-4">
            {questionType === "video_response" ? (
              <Camera className="h-12 w-12 mx-auto text-gray-400" />
            ) : (
              <Mic className="h-12 w-12 mx-auto text-gray-400" />
            )}
          </div>
          <h3 className="text-lg font-medium mb-2">
            {questionType === "video_response" ? "Camera & Microphone" : "Microphone"} Access Required
          </h3>
          <p className="text-gray-600 mb-4">
            Please allow access to record your answer
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {questionType === "video_response" ? <Video className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          {questionType === "video_response" ? "Record Video Answer" : "Record Audio Answer"}
          {isRecording && (
            <span className="text-red-500 animate-pulse">
              Recording {formatTime(recordingTime)}
            </span>
          )}
          {/* Continuous transcription indicator */}
          {continuousTranscriptionActive && (
            <span className="text-green-600 text-sm bg-green-50 px-2 py-1 rounded-full animate-pulse">
              🎤 Live Arabic Transcription
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video preview for video questions */}
        {questionType === "video_response" && (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full max-w-md mx-auto rounded-lg border-2 border-gray-300"
            />
            {isRecording && (
              <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-sm animate-pulse">
                REC
              </div>
            )}
          </div>
        )}

        {/* Audio visualization for audio questions */}
        {questionType === "audio_response" && (
          <div className="text-center py-8">
            <div className="flex justify-center items-center space-x-2 mb-4">
              {isRecording ? (
                <MicOff className="h-8 w-8 text-red-500 animate-pulse" />
              ) : (
                <Mic className="h-8 w-8 text-gray-400" />
              )}
            </div>
            {isRecording && (
              <div className="flex justify-center space-x-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-8 bg-red-500 rounded animate-pulse"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recording Controls */}
        <div className="flex justify-center space-x-4">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              disabled={isProcessing}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {questionType === "video_response" ? <Video className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
              Start Recording
            </Button>
          ) : (
            <Button
              onClick={stopRecording}
              variant="outline"
              className="border-red-500 text-red-500 hover:bg-red-50"
            >
              <StopCircle className="h-4 w-4 mr-2" />
              Stop Recording
            </Button>
          )}
        </div>

        {/* Editable Transcription Display */}
        {(transcription || editableTranscript || isProcessing) && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-blue-800">Live Transcription</h4>
              <div className="flex items-center space-x-2">
                {!isEditingTranscript && !isRecording && (
                  <Button
                    onClick={() => {
                      setIsEditingTranscript(true);
                      setEditableTranscript(transcription);
                    }}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <Edit2 className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                )}
                {isEditingTranscript && (
                  <div className="flex space-x-1">
                    <Button
                      onClick={() => {
                        setTranscription(editableTranscript);
                        setIsEditingTranscript(false);
                      }}
                      variant="default"
                      size="sm"
                      className="text-xs"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                    <Button
                      onClick={() => {
                        setEditableTranscript(transcription);
                        setIsEditingTranscript(false);
                      }}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                )}
                {isProcessing && (
                  <div className="flex items-center space-x-2 text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    <span className="text-xs">Processing...</span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white p-3 rounded border border-blue-200 min-h-[60px]">
              {isEditingTranscript ? (
                <textarea
                  value={editableTranscript}
                  onChange={(e) => setEditableTranscript(e.target.value)}
                  className="w-full text-sm text-gray-800 leading-relaxed bg-transparent border-none outline-none resize-none min-h-[50px]"
                  placeholder="Type or edit your Arabic text here..."
                  dir="rtl"
                />
              ) : transcription || editableTranscript ? (
                <p className="text-sm text-gray-800 leading-relaxed" dir="rtl">
                  {transcription || editableTranscript}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">Your speech will appear here in real-time...</p>
              )}
            </div>
          </div>
        )}

        {/* Validation Status Display */}
        {validationStatus.completed && (
          <div className={`mt-4 p-4 rounded-lg border ${
            validationStatus.isValid 
              ? 'bg-green-50 border-green-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <h4 className={`font-medium ${
                validationStatus.isValid ? 'text-green-800' : 'text-yellow-800'
              }`}>
                AI Validation Result
              </h4>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                validationStatus.isValid 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                Score: {validationStatus.score}%
              </div>
            </div>
            <div className="bg-white p-3 rounded border">
              <p className="text-sm text-gray-700">{validationStatus.feedback}</p>
            </div>
          </div>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Processing your recording...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}