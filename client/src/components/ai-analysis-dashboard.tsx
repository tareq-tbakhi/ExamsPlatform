import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, FileText, Play, XCircle, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ViolationAnalysis {
  severity: 'critical' | 'major' | 'minor';
  confidence: number;
  description: string;
  recommendations: string[];
  suspiciousActivities: string[];
  screenActivity?: {
    applicationSwitching: {
      unauthorizedApps: string[];
      switchingFrequency: number;
      timeOutsideExam: number; // seconds
      suspiciousPatterns: string[];
    };
    keyboardActivity: {
      copyPasteAttempts: number;
      shortcutUsage: string[];
      typingPatterns: string;
      suspiciousKeystrokes: number;
    };
  };
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

  // Fetch stored AI analysis results
  const { data: storedAnalysis, refetch: refetchAnalysis } = useQuery({
    queryKey: ['/api/analyze/results', submissionId],
    queryFn: () => fetch(`/api/analyze/results/${submissionId}`).then(res => res.json()),
    enabled: true
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

  // Enhanced analysis mutation
  const enhancedAnalysisMutation = useMutation({
    mutationFn: async (): Promise<VideoAnalysis> => {
      if (!videos?.proctoringVideos?.length) {
        throw new Error("No video files available for analysis");
      }
      
      const videoPath = videos.proctoringVideos[0].url; // Use first available video
      const response = await fetch('/api/analyze/enhanced-analysis', {
        method: 'POST',
        body: JSON.stringify({ 
          videoPath, 
          examContext: `Exam: ${examTitle} - Submission: ${submissionId}`,
          submissionId 
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json();
    },
    onSuccess: (data: VideoAnalysis) => {
      setActiveAnalysis(data);
      refetchAnalysis(); // Fetch newly stored analysis results
      toast({
        title: "Enhanced Analysis Complete",
        description: `Advanced Gemini AI analysis completed. Found ${data.violations.length} violations.`
      });
    },
    onError: (error) => {
      toast({
        title: "Enhanced Analysis Failed",
        description: "Failed to perform enhanced AI analysis.",
        variant: "destructive"
      });
    }
  });

  // Analyze video recording mutation
  const analyzeVideoMutation = useMutation({
    mutationFn: async (videoUrl: string): Promise<VideoAnalysis> => {
      // Extract video path from URL
      const videoPath = videoUrl.replace('/api/videos/proctoring/', 'uploads/proctoring/');
      
      const response = await fetch('/api/analyze/enhanced-analysis', {
        method: 'POST',
        body: JSON.stringify({ 
          videoPath, 
          examContext: `Exam: ${examTitle} - Submission: ${submissionId}`,
          submissionId 
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status} ${response.statusText}`);
      }
      
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
            onClick={() => enhancedAnalysisMutation.mutate()}
            disabled={enhancedAnalysisMutation.isPending || !videos?.proctoringVideos?.length}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {enhancedAnalysisMutation.isPending ? (
              <>
                <div className="animate-spin h-4 w-4 border-b-2 border-white mr-2"></div>
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Enhanced AI Analysis
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="violations" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="violations">Violations</TabsTrigger>
          <TabsTrigger value="videos">Recordings</TabsTrigger>
          <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
          <TabsTrigger value="stored">Stored Results</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="report">AI Report</TabsTrigger>
        </TabsList>

        <TabsContent value="violations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detected Violations</CardTitle>
              <CardDescription>
                Security violations captured during the exam session
              </CardDescription>
            </CardHeader>
            <CardContent>
              {violationsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p>Loading violations...</p>
                </div>
              ) : violations?.length ? (
                <div className="space-y-4">
                  {violations.map((violation: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-white text-xs ${getSeverityColor(violation.type)}`}>
                          {violation.type.toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(violation.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="font-medium">{violation.description}</p>
                      <p className="text-sm text-gray-600 mt-1">{violation.category}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No violations detected</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="videos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recorded Videos</CardTitle>
              <CardDescription>
                Video recordings from the exam session for AI analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {videosLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p>Loading videos...</p>
                </div>
              ) : videos?.proctoringVideos?.length || videos?.answerVideos?.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {videos.proctoringVideos?.map((video: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      {/* Video Preview */}
                      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                        <video
                          src={video.url}
                          className="w-full h-full object-cover"
                          controls
                          preload="metadata"
                          playsInline
                        />
                        {/* Video Type Badge */}
                        <div className="absolute top-2 left-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            video.type === 'screen' 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-green-500 text-white'
                          }`}>
                            {video.type === 'screen' ? 'Screen' : 'Camera'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Video Info and Actions */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm truncate">{video.filename}</p>
                            <p className="text-xs text-gray-600">
                              {(video.size / 1024 / 1024).toFixed(2)} MB • {new Date(video.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => analyzeVideoMutation.mutate(video.url)}
                            disabled={analyzeVideoMutation.isPending}
                            className="flex-1"
                          >
                            <Brain className="h-4 w-4 mr-2" />
                            {analyzeVideoMutation.isPending ? 'Analyzing...' : 'AI Analyze'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(video.url, '_blank')}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No videos recorded</p>
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
              {analyzeVideoMutation.isPending || enhancedAnalysisMutation.isPending ? (
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
                      Advanced AI analysis with screen monitoring, behavioral analysis, audio processing, and comprehensive violation detection.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Overall Suspicion</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-red-600">{activeAnalysis.overallSuspicion}%</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Violations Found</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{activeAnalysis.violations.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Timeline Events</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{activeAnalysis.timeline.length}</div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Detected Violations</h3>
                    {activeAnalysis.violations.map((violation, index) => (
                      <Card key={index}>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            {getSeverityIcon(violation.severity)}
                            <span className={`px-2 py-1 rounded text-white text-xs ${getSeverityColor(violation.severity)}`}>
                              {violation.severity.toUpperCase()}
                            </span>
                            <span className="text-sm text-gray-500">
                              Confidence: {(violation.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="font-medium mb-2">{violation.description}</p>
                          
                          {violation.recommendations.length > 0 && (
                            <div className="mb-3">
                              <p className="text-sm font-medium mb-1">Recommendations:</p>
                              <ul className="text-sm text-gray-600 list-disc list-inside">
                                {violation.recommendations.map((rec, idx) => (
                                  <li key={idx}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {violation.behaviorAnalysis && (
                            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                              <p className="text-sm font-medium mb-2">Behavioral Analysis:</p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>Stress: {violation.behaviorAnalysis.emotionDetection.stress}%</div>
                                <div>Anxiety: {violation.behaviorAnalysis.emotionDetection.anxiety}%</div>
                                <div>Frustration: {violation.behaviorAnalysis.emotionDetection.frustration}%</div>
                                <div>Confidence: {violation.behaviorAnalysis.emotionDetection.confidence}%</div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Analysis Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 dark:text-gray-300">{activeAnalysis.summary}</p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No analysis available yet</p>
                  <p className="text-sm text-gray-400">Use the Enhanced AI Analysis button to start comprehensive analysis</p>
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
                Chronological timeline of detected activities and violations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeAnalysis?.timeline?.length ? (
                <div className="space-y-3">
                  {activeAnalysis.timeline.map((event, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border rounded">
                      {getSeverityIcon(event.severity)}
                      <div className="flex-1">
                        <p className="font-medium">{event.activity}</p>
                        <p className="text-sm text-gray-500">
                          {formatTimestamp(event.timestamp)}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-white text-xs ${getSeverityColor(event.severity)}`}>
                        {event.severity}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No timeline data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI-Generated Report</CardTitle>
              <CardDescription>
                Comprehensive violation analysis report generated by AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              {generateReportMutation.isPending ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p>Generating AI report...</p>
                </div>
              ) : generatedReport ? (
                <div className="prose max-w-none">
                  <pre className="whitespace-pre-wrap text-sm">{generatedReport}</pre>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No report generated yet</p>
                  <Button onClick={() => generateReportMutation.mutate()}>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}