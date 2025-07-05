import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  Square,
  Download,
  Upload,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { VideoQuestion } from "@shared/schema";

interface VideoQuestionProps {
  question: VideoQuestion;
  onAnswerSubmit: (answer: VideoAnswerData) => void;
  onNext: () => void;
  isLastQuestion: boolean;
  submissionId?: number;
}

interface VideoAnswerData {
  videoUrl?: string;
  transcript?: string;
  confidence?: number;
  duration: number;
}

export default function VideoQuestionComponent({ 
  question, 
  onAnswerSubmit, 
  onNext, 
  isLastQuestion,
  submissionId 
}: VideoQuestionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const [transcriptionConfidence, setTranscriptionConfidence] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState(question.maxDuration);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

  const { toast } = useToast();

  useEffect(() => {
    initializeSpeechRecognition();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (isRecording && timeRemaining > 0) {
      timerRef.current = window.setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, timeRemaining]);

  const initializeSpeechRecognition = () => {
    // Check if browser supports Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      
      // Configure for Arabic language support
      recognition.lang = 'ar-SA'; // Arabic (Saudi Arabia)
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      
      recognition.onstart = () => {
        console.log('Speech recognition started');
      };
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' ';
            setTranscriptionConfidence(Math.round(result[0].confidence * 100));
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        
        setTranscript(prev => prev + finalTranscript);
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        toast({
          title: "Transcription Error",
          description: "Failed to transcribe speech. Please try again.",
          variant: "destructive"
        });
      };
      
      recognition.onend = () => {
        setIsTranscribing(false);
        console.log('Speech recognition ended');
      };
      
      recognitionRef.current = recognition;
    } else {
      toast({
        title: "Speech Recognition Not Supported",
        description: "Your browser doesn't support speech recognition. Video recording will still work.",
        variant: "destructive"
      });
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 1280,
          height: 720,
          facingMode: "user"
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        
        // Stop the stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTimeRemaining(question.maxDuration);

      // Start speech recognition
      if (recognitionRef.current) {
        setIsTranscribing(true);
        recognitionRef.current.start();
      }

      toast({
        title: "Recording Started",
        description: `You have ${question.maxDuration} seconds to record your answer.`
      });

    } catch (error) {
      console.error("Failed to start recording:", error);
      toast({
        title: "Recording Failed",
        description: "Failed to access camera and microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (recognitionRef.current && isTranscribing) {
      recognitionRef.current.stop();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setIsRecording(false);
    setIsTranscribing(false);
  };

  const retakeRecording = () => {
    setRecordedBlob(null);
    setRecordedUrl("");
    setTranscript("");
    setTranscriptionConfidence(0);
    setTimeRemaining(question.maxDuration);
    setHasSubmitted(false);
  };

  const uploadAndSubmit = async () => {
    if (!recordedBlob) return;

    setIsUploading(true);
    
    try {
      // Upload video file
      const formData = new FormData();
      formData.append('video', recordedBlob, `answer_${question.id}_${Date.now()}.webm`);
      formData.append('questionId', question.id.toString());
      formData.append('transcript', transcript);
      formData.append('confidence', transcriptionConfidence.toString());
      formData.append('duration', (question.maxDuration - timeRemaining).toString());
      if (submissionId) {
        formData.append('submissionId', submissionId.toString());
      }

      const response = await fetch('/api/upload-video-answer', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();

      const answerData: VideoAnswerData = {
        videoUrl: result.videoUrl,
        transcript: transcript,
        confidence: transcriptionConfidence,
        duration: question.maxDuration - timeRemaining
      };

      onAnswerSubmit(answerData);
      setHasSubmitted(true);

      toast({
        title: "Answer Submitted",
        description: "Your video answer has been uploaded successfully."
      });

    } catch (error) {
      console.error("Upload failed:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload your answer. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getTimeColor = () => {
    if (timeRemaining > question.maxDuration * 0.5) return "text-green-600";
    if (timeRemaining > question.maxDuration * 0.2) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Video Question</span>
            <Badge variant="outline">
              {question.points} {question.points === 1 ? 'point' : 'points'}
            </Badge>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Question Text */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium mb-2">Question:</h3>
            <p className="text-gray-800">{question.question}</p>
          </div>

          {/* Recording Interface */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Video Feed/Preview */}
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                {isRecording || recordedUrl ? (
                  <video
                    ref={videoRef}
                    src={recordedUrl || undefined}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted={isRecording ? true : false}
                    controls={!isRecording && !!recordedUrl}
                    playsInline
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-white">
                    <div className="text-center">
                      <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p>Click "Start Recording" to begin</p>
                    </div>
                  </div>
                )}
                
                {/* Recording indicator */}
                {isRecording && (
                  <div className="absolute top-4 left-4 flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-white text-sm font-medium">REC</span>
                  </div>
                )}
                
                {/* Timer */}
                {isRecording && (
                  <div className="absolute top-4 end-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
                    <span className={`font-mono ${getTimeColor()}`}>
                      {formatTime(timeRemaining)}
                    </span>
                  </div>
                )}
              </div>

              {/* Recording Controls */}
              <div className="flex justify-center space-x-4">
                {!isRecording && !recordedBlob && (
                  <Button onClick={startRecording} size="lg" className="flex items-center space-x-2">
                    <Video className="h-5 w-5" />
                    <span>Start Recording</span>
                  </Button>
                )}
                
                {isRecording && (
                  <Button onClick={stopRecording} variant="destructive" size="lg" className="flex items-center space-x-2">
                    <Square className="h-5 w-5" />
                    <span>Stop Recording</span>
                  </Button>
                )}
                
                {recordedBlob && !hasSubmitted && (
                  <div className="flex space-x-2">
                    <Button onClick={retakeRecording} variant="outline" className="flex items-center space-x-2">
                      <VideoOff className="h-4 w-4" />
                      <span>Retake</span>
                    </Button>
                    <Button 
                      onClick={uploadAndSubmit} 
                      disabled={isUploading}
                      className="flex items-center space-x-2"
                    >
                      {isUploading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          <span>Submit Answer</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Transcription Panel */}
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center space-x-2">
                  <Mic className="h-4 w-4" />
                  <span>Arabic Speech Transcription</span>
                  {isTranscribing && (
                    <Badge variant="secondary" className="animate-pulse">Live</Badge>
                  )}
                </h4>
                
                {transcript ? (
                  <div className="space-y-2">
                    <div className="bg-white p-3 rounded border min-h-[100px] text-right" dir="rtl">
                      <p className="text-gray-800">{transcript}</p>
                    </div>
                    {transcriptionConfidence > 0 && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Confidence:</span>
                        <Progress value={transcriptionConfidence} className="flex-1" />
                        <span className="text-sm font-medium">{transcriptionConfidence}%</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white p-3 rounded border min-h-[100px] flex items-center justify-center text-gray-500">
                    <p>Start recording to see transcription here</p>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2 text-blue-800">Instructions:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Speak clearly in Arabic for better transcription</li>
                  <li>• Ensure good lighting and camera positioning</li>
                  <li>• Maximum duration: {formatTime(question.maxDuration)}</li>
                  <li>• You can retake your recording if needed</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Submit Status */}
          {hasSubmitted && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-center space-x-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <h4 className="font-medium text-green-800">Answer Submitted Successfully</h4>
                <p className="text-sm text-green-700">
                  Your video answer has been recorded and uploaded. Duration: {formatTime(question.maxDuration - timeRemaining)}
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t">
            <div></div>
            <Button 
              onClick={onNext} 
              disabled={!hasSubmitted}
              className="flex items-center space-x-2"
            >
              <span>{isLastQuestion ? 'Finish Exam' : 'Next Question'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}