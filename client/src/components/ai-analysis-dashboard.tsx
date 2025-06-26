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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, XCircle, FileText, Video, Mic } from "lucide-react";

interface ViolationAnalysis {
  severity: 'critical' | 'major' | 'minor';
  confidence: number;
  description: string;
  recommendations: string[];
  suspiciousActivities: string[];
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
    queryFn: () => apiRequest(`/api/violations/${submissionId}`)
  });

  // Generate violation report mutation
  const generateReportMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/analyze/generate-report', {
        method: 'POST',
        body: JSON.stringify({ submissionId }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data) => {
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
    mutationFn: async (videoPath: string) => {
      return apiRequest('/api/analyze/video-recording', {
        method: 'POST',
        body: JSON.stringify({ 
          videoPath, 
          examContext: `Exam: ${examTitle} - Submission: ${submissionId}` 
        }),
        headers: { 'Content-Type': 'application/json' }
      });
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
            onClick={() => analyzeVideoMutation.mutate('/mock/video/path.mp4')}
            disabled={analyzeVideoMutation.isPending}
          >
            <Video className="h-4 w-4 mr-2" />
            Analyze Recording
          </Button>
        </div>
      </div>

      <Tabs defaultValue="violations" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="violations">Violations</TabsTrigger>
          <TabsTrigger value="analysis">Video Analysis</TabsTrigger>
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