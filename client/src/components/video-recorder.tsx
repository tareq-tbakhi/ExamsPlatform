import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, StopCircle, Mic, MicOff, Camera, CameraOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface VideoRecorderProps {
  questionId: number;
  submissionId: number;
  questionType: "video_response" | "audio_response";
  onRecordingComplete: (transcription: string, confidence: number) => void;
  onValidationComplete: (isValid: boolean, feedback: string, score: number) => void;
}

export function VideoRecorder({
  questionId,
  submissionId,
  questionType,
  onRecordingComplete,
  onValidationComplete
}: VideoRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  // Request camera/microphone permissions
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        const constraints = questionType === "video_response" 
          ? { video: true, audio: true }
          : { audio: true };
          
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setMediaStream(stream);
        setPermissionGranted(true);
        
        if (videoRef.current && questionType === "video_response") {
          videoRef.current.srcObject = stream;
        }
        
        toast({
          title: "Camera Access Granted",
          description: questionType === "video_response" 
            ? "Camera and microphone are ready for recording"
            : "Microphone is ready for recording"
        });
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
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [questionType, toast]);

  // Timer for recording duration
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
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
        title: "Error",
        description: "Media stream not available. Please refresh and grant permissions.",
        variant: "destructive"
      });
      return;
    }

    try {
      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: questionType === "video_response" 
          ? "video/webm;codecs=vp9,opus"
          : "audio/webm;codecs=opus"
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: questionType === "video_response" ? "video/webm" : "audio/webm"
        });
        setRecordedBlob(blob);
        processRecording(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Record in 1s chunks
      setIsRecording(true);
      setRecordingTime(0);
      
      toast({
        title: "Recording Started",
        description: "Recording your answer..."
      });
    } catch (error) {
      console.error("Failed to start recording:", error);
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
      
      toast({
        title: "Recording Stopped",
        description: "Processing your answer..."
      });
    }
  };

  const processRecording = async (blob: Blob) => {
    setIsProcessing(true);
    
    try {
      // Upload and transcribe the recording
      const formData = new FormData();
      formData.append("file", blob, `question_${questionId}_${Date.now()}.webm`);
      formData.append("questionId", questionId.toString());
      formData.append("submissionId", submissionId.toString());
      formData.append("type", questionType);

      const transcribeResponse = await apiRequest("POST", 
        questionType === "video_response" ? "/api/transcribe/video" : "/api/transcribe/audio",
        formData,
        false // Don't send as JSON
      );

      const transcribeResult = await transcribeResponse.json();
      
      if (!transcribeResult.success) {
        throw new Error(transcribeResult.error || "Transcription failed");
      }

      const transcriptionText = transcribeResult.transcription;
      const confidence = transcribeResult.confidence || 0.8;
      
      setTranscription(transcriptionText);
      onRecordingComplete(transcriptionText, confidence);

      // Validate the answer using OpenAI
      const validateResponse = await apiRequest("POST", "/api/validate-answer", {
        questionId,
        submissionId,
        transcription: transcriptionText,
        questionType,
        audioQuality: transcribeResult.audioQuality || {},
        confidence
      });

      const validateResult = await validateResponse.json();
      
      if (validateResult.success) {
        onValidationComplete(
          validateResult.isValid,
          validateResult.feedback,
          validateResult.score
        );
        
        toast({
          title: "Answer Processed",
          description: `Your answer has been recorded and evaluated. Score: ${validateResult.score}%`
        });
      } else {
        throw new Error(validateResult.error || "Validation failed");
      }

    } catch (error) {
      console.error("Processing failed:", error);
      toast({
        title: "Processing Error",
        description: "Failed to process your recording. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!permissionGranted) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {questionType === "video_response" ? <Camera className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            {questionType === "video_response" ? "Video Response Required" : "Audio Response Required"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-6">
            <p className="text-gray-600 mb-4">
              Please allow {questionType === "video_response" ? "camera and microphone" : "microphone"} access to record your answer.
            </p>
            <Button onClick={() => window.location.reload()}>
              Grant Permissions
            </Button>
          </div>
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
          <div className="text-center p-8 bg-gray-50 rounded-lg">
            <Mic className={`h-12 w-12 mx-auto mb-4 ${isRecording ? "text-red-500 animate-pulse" : "text-gray-400"}`} />
            <p className="text-gray-600">
              {isRecording ? "Recording audio..." : "Ready to record audio"}
            </p>
          </div>
        )}

        {/* Recording controls */}
        <div className="flex justify-center gap-4">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              disabled={isProcessing}
              className="bg-red-500 hover:bg-red-600"
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

        {/* Transcription display */}
        {transcription && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold mb-2">Transcription:</h4>
            <p className="text-gray-700">{transcription}</p>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">Processing your answer...</p>
          </div>
        )}

        {/* Instructions */}
        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
          <p><strong>Instructions:</strong></p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Click "Start Recording" to begin</li>
            <li>Speak clearly and directly to the {questionType === "video_response" ? "camera" : "microphone"}</li>
            <li>Click "Stop Recording" when finished</li>
            <li>Your answer will be automatically transcribed and evaluated</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}