import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, XCircle, FileText, Video, Mic, Brain } from "lucide-react";

interface ViolationAnalysis {
  severity: 'critical' | 'major' | 'minor';
  confidence: number;
  description: string;
  recommendations: string[];
  suspiciousActivities: string[];
  behaviorAnalysis?: {
    emotionDetection: {
      stress: number; // 0-100
      anxiety: number;
      frustration: number;
      confidence: number;
    };
    movementAnalysis: {
      suspiciousMovements: string[];
      postureCompliance: number; // 0-100
      headMovementPattern: string;
      eyeGazeDirection: string;
    };
    microExpressions: {
      detected: boolean;
      type: string[];
      suspicionLevel: number;
    };
  };
  audioAnalysis?: {
    multipleSpeakers: boolean;
    backgroundVoices: boolean;
    whisperingDetected: boolean;
    voicePatternMatch: number; // consistency score
    audioAnomalies: string[];
    ambientNoise: string;
  };
}

interface VideoAnalysis {
  overallSuspicion: number;
  violations: ViolationAnalysis[];
  timeline: Array<{
    timestamp: number;
    activity: string;
    severity: 'critical' | 'major' | 'minor';
  }>;
  summary: string;
}

interface AIAnalysisDashboardProps {
  submissionId: number;
  examTitle: string;
}

export default function AIAnalysisDashboard({ submissionId, examTitle }: AIAnalysisDashboardProps) {
  const { toast } = useToast();
  const [activeAnalysis, setActiveAnalysis] = useState<VideoAnalysis | null>(null);
  const [generatedReport, setGeneratedReport] = useState<string>("");

  // Fetch existing violations
  const { data: violations, isLoading: violationsLoading } = useQuery({
    queryKey: ['/api/violations', submissionId],
    queryFn: () => fetch(`/api/violations/${submissionId}`).then(res => res.json())
  });

  // Fetch recorded videos for this submission
  const { data: videos, isLoading: videosLoading } = useQuery({
    queryKey: ['/api/videos/submission', submissionId],
    queryFn: () => fetch(`/api/videos/submission/${submissionId}`).then(res => res.json())
  });

  // Generate violation report mutation
  const generateReportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/analyze/generate-report', {
        method: 'POST',
        body: JSON.stringify({ submissionId }),
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json();
    },
    onSuccess: (data: { report: string }) => {
      setGeneratedReport(data.report);
      toast({
        title: "Report Generated",
        description: "AI analysis report has been generated successfully."
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Failed to generate AI analysis report.",
        variant: "destructive"
      });
    }
  });

  // Analyze video recording mutation
  const analyzeVideoMutation = useMutation({
    mutationFn: async (videoPath: string): Promise<VideoAnalysis> => {
      const response = await fetch('/api/analyze/video-recording', {
        method: 'POST',
        body: JSON.stringify({ 
          videoPath, 
          examContext: `Exam: ${examTitle} - Submission: ${submissionId}` 
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json();
    },
    onSuccess: (data: VideoAnalysis) => {
      setActiveAnalysis(data);
      toast({
        title: "Analysis Complete",
        description: "Video analysis has been completed successfully."
      });
    },
    onError: () => {
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze video recording.",
        variant: "destructive"
      });
    }
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'major': return 'bg-orange-500';
      case 'minor': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4" />;
      case 'major': return <AlertTriangle className="h-4 w-4" />;
      case 'minor': return <CheckCircle className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const minutes = Math.floor(timestamp / 60);
    const seconds = timestamp % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">AI Proctoring Analysis</h2>
        <div className="flex gap-2">
          <Button
            onClick={() => generateReportMutation.mutate()}
            disabled={generateReportMutation.isPending}
            variant="outline"
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
          <Button
            onClick={() => {
              if (videos?.proctoringVideos?.length > 0) {
                analyzeVideoMutation.mutate(videos.proctoringVideos[0].url);
              } else {
                toast({
                  title: "No Videos Found",
                  description: "No proctoring videos available for analysis",
                  variant: "destructive"
                });
              }
            }}
            disabled={analyzeVideoMutation.isPending || !videos?.proctoringVideos?.length}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Brain className="h-4 w-4 mr-2" />
            Enhanced AI Analysis
          </Button>
        </div>
      </div>

      <Tabs defaultValue="violations" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="violations">Violations</TabsTrigger>
          <TabsTrigger value="videos">Recordings</TabsTrigger>
          <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="report">AI Report</TabsTrigger>
        </TabsList>

        <TabsContent value="violations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detected Violations</CardTitle>
              <CardDescription>
                Security violations detected during the exam session
              </CardDescription>
            </CardHeader>
            <CardContent>
              {violationsLoading ? (
                <div>Loading violations...</div>
              ) : violations && violations.length > 0 ? (
                <div className="space-y-3">
                  {violations.map((violation: any, index: number) => (
                    <Alert key={index} className="border-l-4" style={{
                      borderLeftColor: violation.type === 'critical' ? '#ef4444' : 
                                     violation.type === 'major' ? '#f97316' : '#eab308'
                    }}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(violation.type)}
                          <Badge className={getSeverityColor(violation.type)}>
                            {violation.type.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{violation.category}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(violation.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <AlertDescription className="mt-2">
                        {violation.description}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No violations detected
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="videos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recorded Videos</CardTitle>
              <CardDescription>
                View and analyze proctoring recordings and video answers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {videosLoading ? (
                <div className="text-center py-8">Loading videos...</div>
              ) : videos && (videos.proctoringVideos?.length > 0 || videos.answerVideos?.length > 0) ? (
                <div className="space-y-6">
                  {videos.proctoringVideos?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        Proctoring Recordings ({videos.proctoringVideos.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {videos.proctoringVideos.map((video: any, index: number) => (
                          <Card key={index} className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Chunk {index + 1}</span>
                                <Badge variant="secondary">
                                  {Math.round(video.size / 1024)}KB
                                </Badge>
                              </div>
                              <video 
                                controls 
                                className="w-full rounded-lg"
                                style={{ maxHeight: '200px' }}
                              >
                                <source src={video.url} type="video/webm" />
                                Your browser does not support video playback.
                              </video>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => analyzeVideoMutation.mutate(video.url)}
                                  disabled={analyzeVideoMutation.isPending}
                                >
                                  <Brain className="h-3 w-3 mr-1" />
                                  Analyze with AI
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => window.open(video.url, '_blank')}
                                >
                                  <Video className="h-3 w-3 mr-1" />
                                  Open Full Size
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {videos.answerVideos?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Mic className="h-4 w-4" />
                        Video Answers ({videos.answerVideos.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {videos.answerVideos.map((video: any, index: number) => (
                          <Card key={index} className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Answer {index + 1}</span>
                                <Badge variant="secondary">
                                  {Math.round(video.size / 1024)}KB
                                </Badge>
                              </div>
                              <video 
                                controls 
                                className="w-full rounded-lg"
                                style={{ maxHeight: '200px' }}
                              >
                                <source src={video.url} type="video/webm" />
                                Your browser does not support video playback.
                              </video>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  // Analyze Arabic audio if applicable
                                  fetch('/api/analyze/arabic-audio', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ audioData: video.url })
                                  }).then(res => res.json()).then(result => {
                                    toast({
                                      title: "Audio Analysis Complete",
                                      description: `Confidence: ${Math.round(result.confidence * 100)}%`
                                    });
                                  });
                                }}
                              >
                                <Mic className="h-3 w-3 mr-1" />
                                Analyze Audio
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recorded videos found for this submission</p>
                  <p className="text-sm mt-2">
                    Videos will appear here when proctoring is active during exams
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Video Analysis</CardTitle>
              <CardDescription>
                Comprehensive AI analysis of the exam recording
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analyzeVideoMutation.isPending ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p>Analyzing video recording with Gemini AI...</p>
                </div>
              ) : activeAnalysis ? (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-700 dark:text-blue-300">Enhanced AI Analysis Active</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      This analysis includes comprehensive behavioral psychology, emotion detection, movement analysis, 
                      micro-expressions, voice pattern matching, and audio anomaly detection.
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Overall Suspicion Level</h3>
                    <Badge variant={activeAnalysis.overallSuspicion > 70 ? "destructive" : 
                                  activeAnalysis.overallSuspicion > 40 ? "default" : "secondary"}>
                      {activeAnalysis.overallSuspicion}%
                    </Badge>
                  </div>
                  <Progress value={activeAnalysis.overallSuspicion} className="w-full" />
                  
                  <div>
                    <h4 className="font-medium mb-3">AI-Detected Violations</h4>
                    <div className="space-y-3">
                      {activeAnalysis.violations.map((violation, index) => (
                        <Card key={index} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <Badge className={getSeverityColor(violation.severity)}>
                              {violation.severity.toUpperCase()}
                            </Badge>
                            <span className="text-sm">Confidence: {Math.round(violation.confidence * 100)}%</span>
                          </div>
                          <p className="text-sm mb-2">{violation.description}</p>
                          
                          {/* Behavioral Analysis Section */}
                          {violation.behaviorAnalysis && (
                            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <Brain className="w-4 h-4 text-blue-600" />
                                <span className="font-medium text-blue-700 dark:text-blue-300">Behavioral Analysis</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                <div>
                                  <p className="font-medium text-gray-600 dark:text-gray-300">Emotions:</p>
                                  <div className="space-y-1">
                                    <div className="flex justify-between">
                                      <span>Stress:</span>
                                      <span className="text-red-600">{violation.behaviorAnalysis.emotionDetection.stress}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Anxiety:</span>
                                      <span className="text-orange-600">{violation.behaviorAnalysis.emotionDetection.anxiety}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Confidence:</span>
                                      <span className="text-green-600">{violation.behaviorAnalysis.emotionDetection.confidence}%</span>
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <p className="font-medium text-gray-600 dark:text-gray-300">Movement:</p>
                                  <div className="space-y-1">
                                    <div className="flex justify-between">
                                      <span>Posture:</span>
                                      <span>{violation.behaviorAnalysis.movementAnalysis.postureCompliance}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Gaze:</span>
                                      <span className="capitalize">{violation.behaviorAnalysis.movementAnalysis.eyeGazeDirection}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {violation.behaviorAnalysis.microExpressions.detected && (
                                <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded">
                                  <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
                                    Micro-expressions: {violation.behaviorAnalysis.microExpressions.type.join(', ')}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Audio Analysis Section */}
                          {violation.audioAnalysis && (
                            <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <Mic className="w-4 h-4 text-purple-600" />
                                <span className="font-medium text-purple-700 dark:text-purple-300">Audio Analysis</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                <div>
                                  <div className="flex justify-between">
                                    <span>Multiple Speakers:</span>
                                    <span className={violation.audioAnalysis.multipleSpeakers ? "text-red-600" : "text-green-600"}>
                                      {violation.audioAnalysis.multipleSpeakers ? "Yes" : "No"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Background Voices:</span>
                                    <span className={violation.audioAnalysis.backgroundVoices ? "text-red-600" : "text-green-600"}>
                                      {violation.audioAnalysis.backgroundVoices ? "Yes" : "No"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Whispering:</span>
                                    <span className={violation.audioAnalysis.whisperingDetected ? "text-red-600" : "text-green-600"}>
                                      {violation.audioAnalysis.whisperingDetected ? "Yes" : "No"}
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between">
                                    <span>Voice Pattern:</span>
                                    <span>{violation.audioAnalysis.voicePatternMatch}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Environment:</span>
                                    <span className="capitalize">{violation.audioAnalysis.ambientNoise}</span>
                                  </div>
                                </div>
                              </div>
                              {violation.audioAnalysis.audioAnomalies.length > 0 && (
                                <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded">
                                  <p className="text-xs font-medium text-red-800 dark:text-red-200">
                                    Audio Anomalies: {violation.audioAnalysis.audioAnomalies.join(', ')}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {violation.suspiciousActivities.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              <strong>Activities:</strong> {violation.suspiciousActivities.join(', ')}
                            </div>
                          )}
                          {violation.recommendations.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              <strong>Recommendations:</strong> {violation.recommendations.join(', ')}
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Analysis Summary</h4>
                    <Card className="p-4">
                      <p className="text-sm">{activeAnalysis.summary}</p>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Click "Analyze Recording" to start AI analysis
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Event Timeline</CardTitle>
              <CardDescription>
                Chronological timeline of detected activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeAnalysis?.timeline ? (
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {activeAnalysis.timeline.map((event, index) => (
                      <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                        <div className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {formatTimestamp(event.timestamp)}
                        </div>
                        <Badge className={getSeverityColor(event.severity)} variant="outline">
                          {event.severity}
                        </Badge>
                        <span className="text-sm flex-1">{event.activity}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No timeline data available. Run video analysis first.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI-Generated Report</CardTitle>
              <CardDescription>
                Comprehensive analysis report generated by Gemini AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              {generateReportMutation.isPending ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p>Generating comprehensive report...</p>
                </div>
              ) : generatedReport ? (
                <div>
                  <ScrollArea className="h-96">
                    <Textarea
                      value={generatedReport}
                      readOnly
                      className="min-h-96 text-sm font-mono"
                    />
                  </ScrollArea>
                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={() => navigator.clipboard.writeText(generatedReport)}
                      variant="outline"
                      size="sm"
                    >
                      Copy Report
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Click "Generate Report" to create an AI analysis report
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}