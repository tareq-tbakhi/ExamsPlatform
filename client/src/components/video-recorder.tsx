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

      toast({
        title: "Recording Stopped",
        description: "Processing your recording..."
      });
    }
  };

  const processRecording = async (blob: Blob) => {
    setIsProcessing(true);
    
    try {
      // First, transcribe the recording
      const formData = new FormData();
      formData.append('audio', blob, `question_${questionId}_${Date.now()}.${questionType === "video_response" ? "webm" : "webm"}`);
      formData.append('questionId', questionId.toString());
      formData.append('submissionId', submissionId.toString());
      formData.append('type', questionType);

      const endpoint = questionType === "video_response" 
        ? '/api/transcribe/video'
        : '/api/transcribe/audio';

      const transcriptionRes = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });
      const transcriptionResponse = await transcriptionRes.json();

      if (transcriptionResponse.transcription) {
        setTranscription(transcriptionResponse.transcription);
        onRecordingComplete(transcriptionResponse.transcription, transcriptionResponse.confidence || 0.8);

        // Now validate the answer using OpenAI
        const validationRes = await fetch('/api/validate-answer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            questionId,
            submissionId,
            transcription: transcriptionResponse.transcription,
            questionType
          })
        });
        const validationResponse = await validationRes.json();

        if (validationResponse.isValid !== undefined) {
          onValidationComplete(
            validationResponse.isValid,
            validationResponse.feedback || "Answer processed successfully",
            validationResponse.score || 0
          );
        }
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

        {/* Transcription Display */}
        {transcription && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Transcription:</h4>
            <p className="text-sm text-gray-700">{transcription}</p>
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