import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Video, 
  Mic, 
  FileText,
  Camera,
  Monitor,
  AlertTriangle,
  CheckCircle,
  XCircle,
  User,
  Trophy,
  Clock,
  Brain,
  Zap,
  Info,
  History,
  Play,
  BarChart3,
  BookOpen,
  ChevronRight
} from "lucide-react";

interface ExamMonitoringDashboardProps {
  submissionId: number;
  examId: number;
  tabMode?: 'full' | 'proctoring' | 'timeline';
}

interface ViolationEvent {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  description: string;
  evidence?: string;
}

interface ProctoringData {
  videos: {
    camera: string[];
    screen: string[];
  };
  violations: ViolationEvent[];
  stats: {
    totalViolations: number;
    faceDetectionScore: number;
    behaviorScore: number;
    overallIntegrity: number;
  };
}

interface SubmissionDetailsResponse {
  submission: any;
  exam: any;
  answers: Record<string, any>;
  videoAnswers: any[];
}

export default function ExamMonitoringDashboard({ submissionId, examId, tabMode = 'full' }: ExamMonitoringDashboardProps) {
  const [activeTab, setActiveTab] = useState("timeline");
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [clearingTranscript, setClearingTranscript] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  // Fetch submission details
  const { data: submissionData, isLoading: submissionLoading } = useQuery({
    queryKey: ['submission-details', submissionId],
    queryFn: async () => {
      const response = await fetch(`/api/submissions/${submissionId}/details`);
      if (!response.ok) throw new Error('Failed to fetch submission details');
      return response.json() as Promise<SubmissionDetailsResponse>;
    }
  });

  // Fetch proctoring data
  const { data: proctoringData } = useQuery({
    queryKey: ['proctoring-data', submissionId],
    queryFn: async () => {
      const response = await fetch(`/api/submissions/${submissionId}/proctoring`);
      if (!response.ok) throw new Error('Failed to fetch proctoring data');
      return response.json() as Promise<ProctoringData>;
    }
  });

  // Fetch AI analysis results
  const { data: aiAnalysis } = useQuery({
    queryKey: ['ai-analysis', submissionId],
    queryFn: async () => {
      const response = await fetch(`/api/analyze/results/${submissionId}`);
      if (!response.ok) throw new Error('Failed to fetch AI analysis');
      return response.json();
    }
  });

  if (submissionLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!submissionData) {
    return <div className="flex items-center justify-center h-64">No data available</div>;
  }

  const { submission, exam } = submissionData;

  // Handle clearing transcript
  const handleClearTranscript = async (questionId: number) => {
    if (clearingTranscript.has(questionId)) return;

    setClearingTranscript(prev => new Set(prev).add(questionId));
    
    try {
      const response = await fetch(`/api/submissions/${submissionId}/clear-transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to clear transcript');
      }

      toast({
        title: "Transcript Cleared",
        description: `Transcript for question ${questionId} has been cleared successfully.`,
      });

      // Refresh the data
      window.location.reload();
    } catch (error) {
      console.error('Error clearing transcript:', error);
      toast({
        title: "Error",
        description: "Failed to clear transcript. Please try again.",
        variant: "destructive",
      });
    } finally {
      setClearingTranscript(prev => {
        const newSet = new Set(prev);
        newSet.delete(questionId);
        return newSet;
      });
    }
  };

  const formatScore = (score: number | null | undefined, totalPoints: number) => {
    if (score === null || score === undefined) {
      return {
        display: "N/A",
        percentage: "Pending",
        badge: { class: "bg-gray-100 text-gray-800", label: "Pending" }
      };
    }
    
    const percentage = Math.round((score / totalPoints) * 100);
    let badgeClass = "bg-gray-100 text-gray-800";
    let badgeLabel = "F";
    
    if (percentage >= 90) {
      badgeClass = "bg-green-100 text-green-800";
      badgeLabel = "A";
    } else if (percentage >= 80) {
      badgeClass = "bg-blue-100 text-blue-800";
      badgeLabel = "B";
    } else if (percentage >= 70) {
      badgeClass = "bg-yellow-100 text-yellow-800";
      badgeLabel = "C";
    } else if (percentage >= 60) {
      badgeClass = "bg-orange-100 text-orange-800";
      badgeLabel = "D";
    } else {
      badgeClass = "bg-red-100 text-red-800";
      badgeLabel = "F";
    }
    
    return {
      display: `${score}/${totalPoints}`,
      percentage: `${percentage}%`,
      badge: { class: badgeClass, label: badgeLabel }
    };
  };

  const formatStudentName = (studentName: string | null | undefined) => {
    if (!studentName || studentName.trim() === '') {
      return 'Unknown Student';
    }
    return studentName.trim();
  };

  const scoreData = formatScore(submission.score, submission.totalPoints);

  const runAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch(`/api/analyze/submission/${submissionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'quick' })
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['ai-analysis', submissionId] });
        toast({ title: "Analysis complete", description: "AI analysis has been completed." });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to run AI analysis", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runComprehensiveAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch(`/api/analyze/submission/${submissionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'comprehensive' })
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['ai-analysis', submissionId] });
        toast({ title: "Analysis complete", description: "Comprehensive AI analysis has been completed." });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to run comprehensive analysis", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getAnswerForQuestion = (questionId: number) => {
    return submissionData?.answers?.[questionId.toString()];
  };

  const getQuestionTypeBadge = (type: string) => {
    const badges = {
      'multiple_choice': <Badge variant="outline" className="bg-blue-50 text-blue-700">Multiple Choice</Badge>,
      'true_false': <Badge variant="outline" className="bg-green-50 text-green-700">True/False</Badge>,
      'short_answer': <Badge variant="outline" className="bg-purple-50 text-purple-700">Short Answer</Badge>,
      'video_response': <Badge variant="outline" className="bg-pink-50 text-pink-700">Video Response</Badge>,
      'audio_response': <Badge variant="outline" className="bg-orange-50 text-orange-700">Audio Response</Badge>,
    };
    return badges[type as keyof typeof badges] || <Badge variant="outline">{type}</Badge>;
  };

  const getViolationIcon = (type: string) => {
    switch (type) {
      case 'face_detection': return <User className="h-4 w-4 text-red-500" />;
      case 'multiple_faces': return <User className="h-4 w-4 text-yellow-500" />;
      case 'no_face': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'suspicious_activity': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'border-red-300 bg-red-50';
      case 'medium': return 'border-yellow-300 bg-yellow-50';
      case 'low': return 'border-blue-300 bg-blue-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  const getScoreBadge = (percentage: number) => {
    if (percentage >= 90) return { class: 'bg-green-100 text-green-700', label: 'Excellent' };
    if (percentage >= 80) return { class: 'bg-blue-100 text-blue-700', label: 'Good' };
    if (percentage >= 70) return { class: 'bg-yellow-100 text-yellow-700', label: 'Average' };
    if (percentage >= 60) return { class: 'bg-orange-100 text-orange-700', label: 'Below Average' };
    return { class: 'bg-red-100 text-red-700', label: 'Poor' };
  };

  // Remove old scoreBadge - now using scoreData.badge

  // If tabMode is specified, render only that specific content
  if (tabMode === 'proctoring') {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Enhanced Header with Animated Background */}
        <div className="relative bg-gradient-to-br from-purple-600 via-pink-600 to-indigo-700 text-white p-8 rounded-2xl shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 animate-pulse"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3 mb-3">
                  <Camera className="h-10 w-10" />
                  🎥 Proctoring & Media Analysis
                  <span className="ml-4 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                    Live Monitor
                  </span>
                </h1>
                <p className="text-purple-100 text-lg">
                  Comprehensive monitoring and security analysis for {submission.studentName}
                </p>
              </div>
              <div className="text-right">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-sm text-purple-200">Student</div>
                  <div className="text-xl font-semibold">{submission.studentName}</div>
                  <div className="text-2xl font-bold mt-2">
                    {proctoringData?.stats?.overallIntegrity || 95}%
                  </div>
                  <div className="text-sm text-purple-200">Integrity Score</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Proctoring Stats with Glassmorphism */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="group relative bg-white/90 backdrop-blur-sm border-0 shadow-2xl hover:shadow-3xl transition-all duration-500 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-600/10 rounded-xl"></div>
            <CardHeader className="relative z-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-xl">
              <CardTitle className="text-2xl flex items-center gap-3">
                <Shield className="h-8 w-8" />
                🛡️ Integrity Metrics
                <div className="ml-auto bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                  Real-time
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 p-8 space-y-8">
              <div className="space-y-6">
                <div className="group">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-gray-800 text-lg flex items-center gap-2">
                      👁️ Face Detection
                    </span>
                    <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold px-3 py-1 text-sm">
                      {proctoringData?.stats?.faceDetectionScore || 98}%
                    </Badge>
                  </div>
                  <div className="relative bg-gray-200 rounded-full h-4 overflow-hidden">
                    <Progress value={proctoringData?.stats?.faceDetectionScore || 98} className="h-4" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                  </div>
                </div>
                <div className="group">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-gray-800 text-lg flex items-center gap-2">
                      🎯 Behavior Score
                    </span>
                    <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white font-bold px-3 py-1 text-sm">
                      {proctoringData?.stats?.behaviorScore || 95}%
                    </Badge>
                  </div>
                  <div className="relative bg-gray-200 rounded-full h-4 overflow-hidden">
                    <Progress value={proctoringData?.stats?.behaviorScore || 95} className="h-4" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                  </div>
                </div>
                <div className="group">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-gray-800 text-lg flex items-center gap-2">
                      ⭐ Overall Integrity
                    </span>
                    <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold px-3 py-1 text-sm">
                      {proctoringData?.stats?.overallIntegrity || 95}%
                    </Badge>
                  </div>
                  <div className="relative bg-gray-200 rounded-full h-4 overflow-hidden">
                    <Progress value={proctoringData?.stats?.overallIntegrity || 95} className="h-4" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative bg-white/90 backdrop-blur-sm border-0 shadow-2xl hover:shadow-3xl transition-all duration-500 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-600/10 rounded-xl"></div>
            <CardHeader className="relative z-10 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-t-xl">
              <CardTitle className="text-2xl flex items-center gap-3">
                <BarChart3 className="h-8 w-8" />
                📊 Monitoring Summary
                <div className="ml-auto bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                  Active
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 p-8">
              <div className="grid grid-cols-1 gap-6">
                <div className="group flex items-center justify-between p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 hover:border-blue-300 transition-all duration-300 hover:scale-105">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                      <Camera className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-lg">📹 Camera Feed</p>
                      <p className="text-sm text-gray-600">Student monitoring</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-lg px-4 py-2 shadow-lg">
                      {proctoringData?.videos?.camera?.length || 0} videos
                    </Badge>
                    {(proctoringData?.videos?.camera?.length || 0) > 0 && (
                      <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
                    )}
                  </div>
                </div>

                <div className="group flex items-center justify-between p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200 hover:border-green-300 transition-all duration-300 hover:scale-105">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                      <Monitor className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-lg">🖥️ Screen Recording</p>
                      <p className="text-sm text-gray-600">Activity monitoring</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white text-lg px-4 py-2 shadow-lg">
                      {proctoringData?.videos?.screen?.length || 0} videos
                    </Badge>
                    {(proctoringData?.videos?.screen?.length || 0) > 0 && (
                      <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                    )}
                  </div>
                </div>

                <div className="group flex items-center justify-between p-6 bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl border-2 border-red-200 hover:border-red-300 transition-all duration-300 hover:scale-105">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                      <AlertTriangle className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-lg">⚠️ Violations</p>
                      <p className="text-sm text-gray-600">Security alerts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="destructive" className="text-lg px-4 py-2 shadow-lg">
                      {proctoringData?.violations?.length || 0} detected
                    </Badge>
                    {(proctoringData?.violations?.length || 0) > 0 && (
                      <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Camera Feed Videos */}
        {proctoringData?.videos?.camera && proctoringData.videos.camera.length > 0 && (
          <Card className="border-0 shadow-2xl overflow-hidden bg-white/90 backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-600/5 rounded-xl"></div>
            <CardHeader className="relative z-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <CardTitle className="flex items-center space-x-3 text-2xl">
                <Camera className="h-8 w-8" />
                <span>📹 Camera Feed - Student Monitoring</span>
                <Badge className="bg-white/20 backdrop-blur-sm text-white ml-auto px-4 py-2">
                  {proctoringData.videos.camera.length} Recording{proctoringData.videos.camera.length !== 1 ? 's' : ''}
                </Badge>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Live</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 p-0">
              <div className="bg-gradient-to-br from-gray-900 to-black">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                  {proctoringData.videos.camera.map((videoUrl: string, idx: number) => (
                    <div key={idx} className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none z-10"></div>
                      <div className="absolute top-4 start-4 bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 z-20 shadow-2xl">
                        <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                        📹 Camera {idx + 1}
                      </div>
                      <div className="absolute top-4 end-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs z-20 border border-white/20">
                        Student View • HD
                      </div>
                      <div className="absolute bottom-4 start-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs z-20 border border-white/20">
                        Recording {idx + 1} • Active
                      </div>
                      <video
                        controls
                        className="w-full hover:scale-105 transition-transform duration-500 border-2 border-white/10"
                        style={{ minHeight: '320px', maxHeight: '420px' }}
                        preload="metadata"
                      >
                        <source src={videoUrl} type="video/webm" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Screen Recording Videos */}
        {proctoringData?.videos?.screen && proctoringData.videos.screen.length > 0 && (
          <Card className="border-0 shadow-2xl overflow-hidden bg-white/90 backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-teal-600/5 rounded-xl"></div>
            <CardHeader className="relative z-10 bg-gradient-to-r from-green-600 to-teal-600 text-white">
              <CardTitle className="flex items-center space-x-3 text-2xl">
                <Monitor className="h-8 w-8" />
                <span>🖥️ Screen Recording - Activity Monitoring</span>
                <Badge className="bg-white/20 backdrop-blur-sm text-white ml-auto px-4 py-2">
                  {proctoringData.videos.screen.length} Recording{proctoringData.videos.screen.length !== 1 ? 's' : ''}
                </Badge>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Active</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 p-0">
              <div className="bg-gradient-to-br from-gray-900 to-black">
                <div className="grid grid-cols-1 gap-0">
                  {proctoringData.videos.screen.map((videoUrl: string, idx: number) => (
                    <div key={idx} className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none z-10"></div>
                      <div className="absolute top-4 start-4 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 z-20 shadow-2xl">
                        <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                        🖥️ Screen Capture {idx + 1}
                      </div>
                      <div className="absolute top-4 end-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs z-20 border border-white/20">
                        Full Screen • 1080p
                      </div>
                      <div className="absolute bottom-4 start-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs z-20 border border-white/20">
                        Screen {idx + 1} • Monitoring
                      </div>
                      <video
                        controls
                        className="w-full hover:scale-105 transition-transform duration-500 border-2 border-white/10"
                        style={{ minHeight: '400px', maxHeight: '600px' }}
                        preload="metadata"
                      >
                        <source src={videoUrl} type="video/webm" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Student Video Answers */}
        {submissionData?.videoAnswers && submissionData.videoAnswers.length > 0 && (
          <Card className="border-0 shadow-2xl overflow-hidden bg-white/90 backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-600/5 rounded-xl"></div>
            <CardHeader className="relative z-10 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              <CardTitle className="flex items-center space-x-3 text-2xl">
                <Video className="h-8 w-8" />
                <span>🎬 Student Video Answers</span>
                <Badge className="bg-white/20 backdrop-blur-sm text-white ml-auto px-4 py-2">
                  {submissionData.videoAnswers.length} Answer{submissionData.videoAnswers.length !== 1 ? 's' : ''}
                </Badge>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Responses</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 p-0">
              <div className="bg-gradient-to-br from-gray-900 to-black">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                  {submissionData.videoAnswers.map((videoAnswer: any, idx: number) => {
                    // Find the corresponding question
                    const question = exam.questions?.find((q: any) => q.id === videoAnswer.questionId);
                    
                    return (
                      <div key={idx} className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none z-10"></div>
                        <div className="absolute top-4 start-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 z-20 shadow-2xl">
                          <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                          🎬 Question {videoAnswer.questionId}
                        </div>
                        <div className="absolute top-4 end-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs z-20 border border-white/20">
                          Video Answer • {Math.round((videoAnswer.confidence || 0) * 100)}%
                        </div>
                        <div className="absolute bottom-4 start-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs z-20 border border-white/20 max-w-xs truncate" dir="rtl">
                          {videoAnswer.transcription || 'No transcription'}
                        </div>
                        <video
                          controls
                          className="w-full hover:scale-105 transition-transform duration-500 border-2 border-white/10"
                          style={{ minHeight: '320px', maxHeight: '420px' }}
                          preload="metadata"
                        >
                          <source src={videoAnswer.videoPath} type="video/webm" />
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Student Answer Videos from submission answers */}
        {(() => {
          // Extract video answers from submission.answers
          const answerVideos = Object.entries(submissionData?.answers || {})
            .filter(([_, answer]: [string, any]) => answer?.type === 'video_response' && answer?.videoUrl)
            .map(([questionId, answer]: [string, any]) => ({
              questionId: parseInt(questionId),
              videoUrl: answer.videoUrl,
              transcription: answer.transcription,
              confidence: answer.confidence
            }));

          if (answerVideos.length === 0) return null;

          return (
            <Card className="border-0 shadow-2xl overflow-hidden bg-white/90 backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-600/5 rounded-xl"></div>
              <CardHeader className="relative z-10 bg-gradient-to-r from-orange-600 to-red-600 text-white">
                <CardTitle className="flex items-center space-x-3 text-2xl">
                  <Video className="h-8 w-8" />
                  <span>📹 Question Responses</span>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white ml-auto px-4 py-2">
                    {answerVideos.length} Video{answerVideos.length !== 1 ? 's' : ''}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Answers</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10 p-0">
                <div className="bg-gradient-to-br from-gray-900 to-black">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                    {answerVideos.map((answer: any, idx: number) => {
                      // Find the corresponding question
                      const question = exam.questions?.find((q: any) => q.id === answer.questionId);
                      
                      return (
                        <div key={idx} className="relative group">
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none z-10"></div>
                          <div className="absolute top-4 start-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 z-20 shadow-2xl">
                            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                            📹 Q{answer.questionId}
                          </div>
                          <div className="absolute top-4 end-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs z-20 border border-white/20">
                            {Math.round((answer.confidence || 0) * 100)}% Confidence
                          </div>
                          <div className="absolute bottom-4 start-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs z-20 border border-white/20 max-w-xs truncate" dir="rtl">
                            {answer.transcription ? `"${answer.transcription}"` : 'No transcription'}
                          </div>
                          <video
                            controls
                            className="w-full hover:scale-105 transition-transform duration-500 border-2 border-white/10"
                            style={{ minHeight: '320px', maxHeight: '420px' }}
                            preload="metadata"
                          >
                            <source src={answer.videoUrl} type="video/webm" />
                            Your browser does not support the video tag.
                          </video>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Student Answer Audio from submission answers */}
        {(() => {
          // Extract audio answers from submission.answers
          const answerAudios = Object.entries(submissionData?.answers || {})
            .filter(([_, answer]: [string, any]) => answer?.type === 'audio_response' && answer?.audioUrl)
            .map(([questionId, answer]: [string, any]) => ({
              questionId: parseInt(questionId),
              audioUrl: answer.audioUrl,
              transcription: answer.transcription,
              confidence: answer.confidence
            }));

          if (answerAudios.length === 0) return null;

          return (
            <Card className="border-0 shadow-2xl overflow-hidden bg-white/90 backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-600/5 rounded-xl"></div>
              <CardHeader className="relative z-10 bg-gradient-to-r from-amber-600 to-orange-600 text-white">
                <CardTitle className="flex items-center space-x-3 text-2xl">
                  <Mic className="h-8 w-8" />
                  <span>🎤 Audio Responses</span>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white ml-auto px-4 py-2">
                    {answerAudios.length} Audio{answerAudios.length !== 1 ? 's' : ''}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Answers</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10 p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {answerAudios.map((answer: any, idx: number) => {
                    // Find the corresponding question
                    const question = exam.questions?.find((q: any) => q.id === answer.questionId);
                    
                    return (
                      <div key={idx} className="bg-gradient-to-br from-white to-amber-50 rounded-xl p-6 border-2 border-amber-200 shadow-lg">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
                            <Mic className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-amber-800 text-lg">Question {answer.questionId}</h3>
                            <p className="text-amber-600 text-sm">Audio Response</p>
                          </div>
                          {answer.confidence && (
                            <Badge variant="outline" className="bg-white border-amber-300 text-amber-700">
                              {Math.round(answer.confidence * 100)}%
                            </Badge>
                          )}
                        </div>
                        
                        {question && (
                          <div className="mb-4 p-3 bg-white rounded-lg border border-amber-100">
                            <p className="text-gray-800 text-sm font-medium">{question.question}</p>
                          </div>
                        )}
                        
                        {answer.audioUrl && (
                          <div className="mb-4">
                            <audio
                              controls
                              className="w-full rounded-lg shadow border border-amber-200"
                              style={{ height: '40px' }}
                            >
                              <source src={answer.audioUrl} type="audio/webm" />
                              Your browser does not support the audio element.
                            </audio>
                          </div>
                        )}
                        
                        {answer.transcription && (
                          <div className="bg-white rounded-lg p-4 border border-amber-100">
                            <div className="flex items-center gap-2 mb-2">
                              <Mic className="h-4 w-4 text-amber-600" />
                              <span className="text-sm font-semibold text-amber-800">Transcript:</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleClearTranscript(answer.questionId)}
                                className="ml-auto text-xs px-2 py-1 h-6"
                                title="Clear transcript"
                                disabled={clearingTranscript.has(answer.questionId)}
                              >
                                {clearingTranscript.has(answer.questionId) ? 'Clearing...' : 'Clear'}
                              </Button>
                            </div>
                            <p className="text-gray-800 text-sm leading-relaxed" dir="rtl">
                              "{answer.transcription}"
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Enhanced Violations Details */}
        {proctoringData?.violations && proctoringData.violations.length > 0 && (
          <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-pink-600/5 rounded-xl"></div>
            <CardHeader className="relative z-10 bg-gradient-to-r from-red-600 to-pink-600 text-white">
              <CardTitle className="flex items-center space-x-3 text-2xl">
                <AlertTriangle className="h-8 w-8" />
                <span>⚠️ Security Violations Detected</span>
                <Badge className="bg-white/20 backdrop-blur-sm text-white ml-auto px-4 py-2 animate-pulse">
                  {proctoringData.violations.length} Violation{proctoringData.violations.length !== 1 ? 's' : ''}
                </Badge>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Alert</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {proctoringData.violations.map((violation: any, idx: number) => (
                  <div key={idx} className={`group relative p-6 rounded-2xl border-2 hover:shadow-2xl transition-all duration-300 hover:scale-105 ${getSeverityColor(violation.severity)}`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 to-pink-50/50 rounded-2xl"></div>
                    <div className="relative z-10 flex items-start gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-xl flex items-center justify-center text-white text-xl">
                        {getViolationIcon(violation.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                            ⚠️ {violation.type.replace('_', ' ').toUpperCase()}
                          </h4>
                          <Badge 
                            variant={violation.severity === 'high' ? 'destructive' : 'secondary'} 
                            className={`text-sm px-3 py-1 ${
                              violation.severity === 'high' ? 'bg-red-100 text-red-800 border-red-300' :
                              violation.severity === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                              'bg-green-100 text-green-800 border-green-300'
                            }`}
                          >
                            {violation.severity === 'high' ? '🔴' : violation.severity === 'medium' ? '🟡' : '🟢'}
                            {violation.severity.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-gray-700 mb-4 leading-relaxed font-medium">{violation.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">🕒 {new Date(violation.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            Alert #{idx + 1}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (tabMode === 'timeline') {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <Shield className="h-8 w-8" />
                Comprehensive Monitoring - {submission.studentName}
              </h1>
              <p className="mt-2 text-blue-100">
                Complete analysis of {submission.studentName}'s exam performance and integrity
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-blue-100">Exam</div>
              <div className="text-xl font-semibold">{exam.title}</div>
            </div>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Student</p>
                  <p className="text-lg font-semibold">{formatStudentName(submission.studentName)}</p>
                  <p className="text-sm text-gray-500">{submission.studentEmail}</p>
                </div>
                <User className="h-10 w-10 text-blue-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Score</p>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-bold">{scoreData.display}</p>
                    <Badge className={scoreData.badge.class}>{scoreData.badge.label}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {scoreData.percentage}
                  </p>
                </div>
                <Trophy className="h-10 w-10 text-yellow-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Time Spent</p>
                  <p className="text-2xl font-bold">{submission.timeSpent || 0}m</p>
                  <p className="text-sm text-gray-500">Duration: {exam.duration}m</p>
                </div>
                <Clock className="h-10 w-10 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Integrity Score</p>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-bold">
                      {proctoringData?.stats?.overallIntegrity || 100}%
                    </p>
                    {(proctoringData?.stats?.overallIntegrity || 100) >= 90 ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {proctoringData?.stats?.totalViolations || 0} violations
                  </p>
                </div>
                <Shield className="h-10 w-10 text-purple-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline and AI Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Timeline Card */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-6 w-6" />
                Exam Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {(() => {
                  const timelineEvents = [];
                  
                  // Add exam start event
                  if (submission.startedAt) {
                    timelineEvents.push({
                      time: new Date(submission.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      event: 'Exam started',
                      icon: Play,
                      color: 'text-green-600',
                      timestamp: new Date(submission.startedAt).getTime()
                    });
                  }
                  
                  // Add violations
                  if (proctoringData?.violations) {
                    proctoringData.violations.forEach((violation: any) => {
                      timelineEvents.push({
                        time: new Date(violation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        event: `${violation.severity === 'high' ? 'Critical' : violation.severity === 'medium' ? 'Major' : 'Minor'} violation: ${violation.type.replace('_', ' ')}`,
                        icon: AlertTriangle,
                        color: violation.severity === 'high' ? 'text-red-600' : violation.severity === 'medium' ? 'text-yellow-600' : 'text-orange-600',
                        timestamp: new Date(violation.timestamp).getTime()
                      });
                    });
                  }
                  
                  // Add question completion events based on video answers
                  if (submissionData?.videoAnswers && submissionData.videoAnswers.length > 0) {
                    submissionData.videoAnswers.forEach((answer: any) => {
                      if (answer.recordedAt) {
                        timelineEvents.push({
                          time: new Date(answer.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          event: `Completed Question ${answer.questionId}`,
                          icon: CheckCircle,
                          color: 'text-blue-600',
                          timestamp: new Date(answer.recordedAt).getTime()
                        });
                      }
                    });
                  }
                  
                  // Add exam submission event
                  if (submission.submittedAt) {
                    timelineEvents.push({
                      time: new Date(submission.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      event: 'Exam submitted',
                      icon: Trophy,
                      color: 'text-green-600',
                      timestamp: new Date(submission.submittedAt).getTime()
                    });
                  }
                  
                  // Sort events by timestamp
                  timelineEvents.sort((a, b) => a.timestamp - b.timestamp);
                  
                  // If no real events, show a message
                  if (timelineEvents.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No timeline events available</p>
                        <p className="text-sm text-gray-400">Events will appear as they occur during the exam</p>
                      </div>
                    );
                  }
                  
                  return timelineEvents.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                      <span className="text-sm font-medium text-gray-500 w-12">{item.time}</span>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm">
                        <item.icon className={`h-4 w-4 ${item.color}`} />
                      </div>
                      <span className="text-sm font-medium flex-1">{item.event}</span>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>

          {/* AI Analysis Tools */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-6 w-6" />
                AI Analysis Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => runComprehensiveAnalysis()}
                    disabled={isAnalyzing}
                    className="flex items-center gap-2 flex-1"
                  >
                    {isAnalyzing ? (
                      <>
                        <Brain className="h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Run AI Analysis
                      </>
                    )}
                  </Button>
                </div>
                
                {aiAnalysis && aiAnalysis.length > 0 ? (
                  <div className="space-y-3">
                    <Alert className="border-blue-200 bg-blue-50">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        AI detected {aiAnalysis.length} notable patterns during the exam
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                      {aiAnalysis.slice(0, 3).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-sm p-2 bg-green-50 rounded">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          <span>{item.summary || item.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-lg">
                    <Brain className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No AI analysis available yet</p>
                    <p className="text-sm text-gray-400 mt-1">Click "Run AI Analysis" to start comprehensive analysis</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Summary */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-600 to-teal-600 text-white">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Activity Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Questions Answered</h3>
                <p className="text-2xl font-bold text-blue-600">{exam.questions?.length || 0}</p>
                <p className="text-sm text-gray-500">Total Questions</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Video className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Video Responses</h3>
                <p className="text-2xl font-bold text-green-600">
                  {Object.values(submission.answers || {}).filter((answer: any) => answer.type === 'video_response').length}
                </p>
                <p className="text-sm text-gray-500">Recorded Answers</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Mic className="h-8 w-8 text-orange-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Audio Responses</h3>
                <p className="text-2xl font-bold text-orange-600">
                  {Object.values(submission.answers || {}).filter((answer: any) => answer.type === 'audio_response').length}
                </p>
                <p className="text-sm text-gray-500">Recorded Answers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default full dashboard with beautiful old design
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Shield className="h-8 w-8" />
              Comprehensive Monitoring - {submission.studentName}
            </h1>
            <p className="mt-2 text-blue-100">
              Complete analysis of {submission.studentName}'s exam performance and integrity
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-blue-100">Exam</div>
            <div className="text-xl font-semibold">{exam.title}</div>
          </div>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Student</p>
                <p className="text-lg font-semibold">{submission.studentName}</p>
                <p className="text-sm text-gray-500">{submission.studentEmail}</p>
              </div>
              <User className="h-10 w-10 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Score</p>
                <div className="flex items-center gap-3">
                  <p className="text-2xl font-bold">{scoreData.display}</p>
                  <Badge className={scoreData.badge.class}>{scoreData.badge.label}</Badge>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {scoreData.percentage}
                </p>
              </div>
              <Trophy className="h-10 w-10 text-yellow-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Time Spent</p>
                <p className="text-2xl font-bold">{submission.timeSpent || 0}m</p>
                <p className="text-sm text-gray-500">Duration: {exam.duration}m</p>
              </div>
              <Clock className="h-10 w-10 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Integrity Score</p>
                <div className="flex items-center gap-3">
                  <p className="text-2xl font-bold">
                    {proctoringData?.stats?.overallIntegrity || 100}%
                  </p>
                  {(proctoringData?.stats?.overallIntegrity || 100) >= 90 ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {proctoringData?.stats?.totalViolations || 0} violations
                </p>
              </div>
              <Shield className="h-10 w-10 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-gray-50 p-0">
              <TabsTrigger value="timeline" className="data-[state=active]:bg-white rounded-none px-6">
                <Clock className="h-4 w-4 mr-2" />
                Exam Timeline
              </TabsTrigger>
              <TabsTrigger value="questions" className="data-[state=active]:bg-white rounded-none px-6">
                <BookOpen className="h-4 w-4 mr-2" />
                Questions & Answers
              </TabsTrigger>
              <TabsTrigger value="analysis" className="data-[state=active]:bg-white rounded-none px-6">
                <Brain className="h-4 w-4 mr-2" />
                Detailed Analysis
              </TabsTrigger>
              <TabsTrigger value="proctoring" className="data-[state=active]:bg-white rounded-none px-6">
                <Camera className="h-4 w-4 mr-2" />
                Proctoring & Media
              </TabsTrigger>
              <TabsTrigger value="ai-tools" className="data-[state=active]:bg-white rounded-none px-6">
                <Zap className="h-4 w-4 mr-2" />
                AI Tools
              </TabsTrigger>
            </TabsList>

            {/* Exam Timeline Tab */}
            <TabsContent value="timeline" className="p-6">
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold flex items-center gap-3">
                        <Clock className="h-8 w-8" />
                        Comprehensive Exam Timeline
                      </h2>
                      <p className="mt-2 text-blue-100">
                        Complete chronological view of {submission.studentName}'s exam journey
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-blue-100">Duration</div>
                      <div className="text-xl font-semibold">
                        {submission.startedAt && submission.submittedAt ? 
                          Math.round((new Date(submission.submittedAt).getTime() - new Date(submission.startedAt).getTime()) / (1000 * 60)) + ' min' : 
                          'N/A'
                        }
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {(() => {
                    const timelineEvents: Array<{
                      time: string;
                      event: string;
                      icon: any;
                      color: string;
                      bgColor: string;
                      timestamp: number;
                      category: string;
                      details?: string;
                    }> = [];

                    // Add exam start event
                    if (submission.startedAt) {
                      timelineEvents.push({
                        time: new Date(submission.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                        event: 'Exam Started',
                        icon: Play,
                        color: 'text-green-600',
                        bgColor: 'bg-green-100',
                        timestamp: new Date(submission.startedAt).getTime(),
                        category: 'System',
                        details: 'Student began the examination'
                      });
                    }

                    // Add proctoring session start
                    if (proctoringData?.videos?.camera && proctoringData.videos.camera.length > 0) {
                      const firstVideo = proctoringData.videos.camera[0];
                      const videoMatch = firstVideo.match(/session_(\d+)/);
                      if (videoMatch) {
                        const sessionTimestamp = parseInt(videoMatch[1]);
                        timelineEvents.push({
                          time: new Date(sessionTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                          event: 'Proctoring Started',
                          icon: Camera,
                          color: 'text-purple-600',
                          bgColor: 'bg-purple-100',
                          timestamp: sessionTimestamp,
                          category: 'Monitoring',
                          details: 'Camera and screen recording initiated'
                        });
                      }
                    }

                    // Add question attempts and answers
                    if (submission.answers) {
                      const answers = typeof submission.answers === 'string' 
                        ? JSON.parse(submission.answers) 
                        : submission.answers;

                      Object.entries(answers).forEach(([questionId, answer]: [string, any]) => {
                        const question = exam.questions?.find((q: any) => q.id.toString() === questionId);
                        
                        if (answer && typeof answer === 'object') {
                          // Handle audio responses
                          if (answer.type === 'audio_response' && answer.audioUrl) {
                            const audioMatch = answer.audioUrl.match(/_(\d+)\.webm/);
                            if (audioMatch) {
                              const audioTimestamp = parseInt(audioMatch[1]);
                              timelineEvents.push({
                                time: new Date(audioTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                                event: `Audio Response Q${questionId}`,
                                icon: Mic,
                                color: 'text-orange-600',
                                bgColor: 'bg-orange-100',
                                timestamp: audioTimestamp,
                                category: 'Response',
                                details: `Recorded audio answer for question ${questionId}${answer.transcription ? ` - "${answer.transcription.substring(0, 50)}..."` : ''}`
                              });
                            }
                          }
                          
                          // Handle video responses
                          if (answer.type === 'video_response' && answer.videoUrl) {
                            const videoMatch = answer.videoUrl.match(/answer_\d+_(\d+)\.webm/);
                            if (videoMatch) {
                              const videoTimestamp = parseInt(videoMatch[1]);
                              timelineEvents.push({
                                time: new Date(videoTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                                event: `Video Response Q${questionId}`,
                                icon: Video,
                                color: 'text-blue-600',
                                bgColor: 'bg-blue-100',
                                timestamp: videoTimestamp,
                                category: 'Response',
                                details: `Recorded video answer for question ${questionId}${answer.transcription ? ` - "${answer.transcription.substring(0, 50)}..."` : ''}`
                              });
                            }
                          }
                        } else {
                          // Handle text responses (estimate timing)
                          if (answer && submission.startedAt) {
                            const estimatedTime = new Date(submission.startedAt).getTime() + (parseInt(questionId) * 2 * 60 * 1000); // Estimate 2 min per question
                            timelineEvents.push({
                              time: new Date(estimatedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                              event: `Text Answer Q${questionId}`,
                              icon: FileText,
                              color: 'text-gray-600',
                              bgColor: 'bg-gray-100',
                              timestamp: estimatedTime,
                              category: 'Response',
                              details: `Answered question ${questionId}: "${String(answer).substring(0, 50)}..."`
                            });
                          }
                        }
                      });
                    }

                    // Add proctoring video segments
                    if (proctoringData?.videos?.camera) {
                      proctoringData.videos.camera.forEach((videoPath: string, index: number) => {
                        const chunkMatch = videoPath.match(/chunk(\d+)\.webm/);
                        const sessionMatch = videoPath.match(/session_(\d+)/);
                        if (chunkMatch && sessionMatch) {
                          const sessionStart = parseInt(sessionMatch[1]);
                          const chunkTimestamp = sessionStart + (index * 40 * 1000); // Assuming 40s chunks
                          timelineEvents.push({
                            time: new Date(chunkTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                            event: `Camera Recording Segment ${index + 1}`,
                            icon: Camera,
                            color: 'text-purple-500',
                            bgColor: 'bg-purple-50',
                            timestamp: chunkTimestamp,
                            category: 'Monitoring',
                            details: `Proctoring video segment recorded`
                          });
                        }
                      });
                    }

                    // Add screen recording segments
                    if (proctoringData?.videos?.screen) {
                      proctoringData.videos.screen.forEach((videoPath: string, index: number) => {
                        const chunkMatch = videoPath.match(/chunk(\d+)\.webm/);
                        const sessionMatch = videoPath.match(/session_(\d+)/);
                        if (chunkMatch && sessionMatch) {
                          const sessionStart = parseInt(sessionMatch[1]);
                          const chunkTimestamp = sessionStart + (index * 40 * 1000); // Assuming 40s chunks
                          timelineEvents.push({
                            time: new Date(chunkTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                            event: `Screen Recording Segment ${index + 1}`,
                            icon: Monitor,
                            color: 'text-indigo-500',
                            bgColor: 'bg-indigo-50',
                            timestamp: chunkTimestamp,
                            category: 'Monitoring',
                            details: `Screen activity recorded`
                          });
                        }
                      });
                    }

                    // Add AI analysis events
                    if (aiAnalysis && aiAnalysis.length > 0) {
                      aiAnalysis.forEach((analysis: any) => {
                        if (analysis.timestamp) {
                          timelineEvents.push({
                            time: new Date(analysis.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                            event: 'AI Analysis Completed',
                            icon: Brain,
                            color: 'text-pink-600',
                            bgColor: 'bg-pink-100',
                            timestamp: new Date(analysis.timestamp).getTime(),
                            category: 'Analysis',
                            details: `AI analysis performed on question responses`
                          });
                        }
                      });
                    }

                    // Add exam submission event
                    if (submission.submittedAt) {
                      timelineEvents.push({
                        time: new Date(submission.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                        event: 'Exam Submitted',
                        icon: Trophy,
                        color: 'text-green-600',
                        bgColor: 'bg-green-100',
                        timestamp: new Date(submission.submittedAt).getTime(),
                        category: 'System',
                        details: 'Student completed and submitted the examination'
                      });
                    }

                    // Sort events by timestamp
                    timelineEvents.sort((a, b) => a.timestamp - b.timestamp);

                    // Group events by category for better visualization
                    const eventsByCategory = timelineEvents.reduce((acc, event) => {
                      if (!acc[event.category]) acc[event.category] = [];
                      acc[event.category].push(event);
                      return acc;
                    }, {} as Record<string, typeof timelineEvents>);

                    // If no real events, show a message
                    if (timelineEvents.length === 0) {
                      return (
                        <div className="text-center py-8">
                          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">No timeline events available</p>
                          <p className="text-sm text-gray-400">Events will appear as they occur during the exam</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-6">
                        {/* Category Summary */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {Object.entries(eventsByCategory).map(([category, events]) => (
                            <div key={category} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                              <div className="text-sm font-medium text-gray-600">{category}</div>
                              <div className="text-2xl font-bold text-gray-900">{events.length}</div>
                              <div className="text-xs text-gray-500">events</div>
                            </div>
                          ))}
                        </div>

                        {/* Timeline Events */}
                        <div className="relative">
                          {/* Timeline line */}
                          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-green-500"></div>
                          
                          {timelineEvents.map((event, idx) => (
                            <div key={idx} className="relative flex items-start gap-4 pb-6">
                              <div className={`relative z-10 w-12 h-12 rounded-full ${event.bgColor} flex items-center justify-center border-4 border-white shadow-lg`}>
                                <event.icon className={`h-6 w-6 ${event.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-semibold text-gray-900">{event.event}</h3>
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        event.category === 'System' ? 'bg-green-100 text-green-800' :
                                        event.category === 'Response' ? 'bg-blue-100 text-blue-800' :
                                        event.category === 'Monitoring' ? 'bg-purple-100 text-purple-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                        {event.category}
                                      </span>
                                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full font-mono">
                                        {event.time}
                                      </span>
                                    </div>
                                  </div>
                                  {event.details && (
                                    <p className="text-sm text-gray-600 leading-relaxed">{event.details}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </TabsContent>

            {/* Questions & Answers Tab */}
            <TabsContent value="questions" className="p-6">
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold flex items-center gap-3">
                        <BookOpen className="h-8 w-8" />
                        Questions & Answers
                      </h2>
                      <p className="mt-2 text-green-100">
                        Complete overview of all questions and {submission.studentName}'s responses
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-green-100">Total Questions</div>
                      <div className="text-xl font-semibold">{exam.questions?.length || 0}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {(exam.questions || []).map((question: any, index: number) => {
                    const studentAnswer = getAnswerForQuestion(question.id);
                    const isCorrect = question.correctAnswer && studentAnswer?.answer === question.correctAnswer;
                    
                    // Always show student responses - check all possible answer formats
                    const hasAnswer = studentAnswer || 
                                     submissionData?.answers?.[question.id] || 
                                     submissionData?.answers?.[question.id.toString()];
                    
                    return (
                      <Card 
                        key={question.id} 
                        className="border-2 border-gray-200 hover:border-gray-300 bg-white shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        <CardHeader className="pb-4">
                          <div className="flex items-start gap-4">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white font-bold text-lg shadow-lg flex-shrink-0">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-lg text-gray-900 mb-3 leading-relaxed">{question.question}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                {getQuestionTypeBadge(question.type)}
                                <Badge variant="outline" className="bg-gray-100 text-gray-700 font-medium">
                                  {question.points} points
                                </Badge>
                                {isCorrect !== undefined && (
                                  isCorrect ? (
                                    <Badge className="bg-green-100 text-green-700 border-green-300">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Correct Answer
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-red-100 text-red-700 border-red-300">
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Incorrect Answer
                                    </Badge>
                                  )
                                )}
                                {hasAnswer && (
                                  <Badge className="bg-blue-100 text-blue-700 border-blue-300">
                                    <FileText className="h-3 w-3 mr-1" />
                                    Answered
                                  </Badge>
                                )}
                                {(() => {
                                  const actualAnswer = studentAnswer || 
                                                     submissionData?.answers?.[question.id] || 
                                                     submissionData?.answers?.[question.id.toString()];
                                  return actualAnswer?.type === 'video_response' && (
                                    <Badge className="bg-pink-100 text-pink-700 border-pink-300">
                                      <Video className="h-3 w-3 mr-1" />
                                      Video Response
                                    </Badge>
                                  );
                                })()}
                                {(() => {
                                  const actualAnswer = studentAnswer || 
                                                     submissionData?.answers?.[question.id] || 
                                                     submissionData?.answers?.[question.id.toString()];
                                  return actualAnswer?.type === 'audio_response' && (
                                    <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                                      <Mic className="h-3 w-3 mr-1" />
                                      Audio Response
                                    </Badge>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="pt-0">
                          <Separator className="mb-6" />
                          
                          {/* Enhanced Student's answer */}
                          <div className="space-y-6">
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <User className="h-5 w-5 text-blue-600" />
                                <h3 className="text-lg font-semibold text-gray-900">Student's Submission</h3>
                              </div>
                              
                              {(() => {
                                // Get the actual answer data from multiple sources
                                const actualAnswer = studentAnswer || 
                                                   submissionData?.answers?.[question.id] || 
                                                   submissionData?.answers?.[question.id.toString()];
                                
                                if (!actualAnswer) {
                                  return (
                                    <div className="p-6 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border-2 border-red-200">
                                      <div className="text-center">
                                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                          <AlertTriangle className="h-6 w-6 text-red-500" />
                                        </div>
                                        <p className="text-red-600 font-bold text-lg mb-2">No Answer Provided</p>
                                        <p className="text-red-500 text-sm mb-3">Student did not respond to this question</p>
                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 border border-red-300 rounded-full">
                                          <Clock className="h-3 w-3 text-red-500" />
                                          <span className="text-red-600 text-xs font-medium">Missing Response</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                
                                if (actualAnswer?.type === 'video_response') {
                                  return (
                                    <div className="space-y-4">
                                      {/* Video Response */}
                                      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                                        <div className="flex items-center gap-3 mb-3">
                                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                            <Video className="h-4 w-4 text-white" />
                                          </div>
                                          <div className="flex-1">
                                            <span className="font-bold text-blue-800 text-sm">Video Response</span>
                                            <p className="text-blue-600 text-xs">Recorded answer with transcription</p>
                                          </div>
                                          {actualAnswer.confidence && (
                                            <Badge variant="outline" className="bg-white border-blue-300 text-blue-700 text-xs">
                                              {Math.round(actualAnswer.confidence * 100)}%
                                            </Badge>
                                          )}
                                        </div>
                                        
                                        {actualAnswer.videoUrl && (
                                          <div className="mb-3">
                                            <video
                                              controls
                                              className="w-full rounded-lg shadow border border-blue-300"
                                              style={{ maxHeight: '200px' }}
                                            >
                                              <source src={actualAnswer.videoUrl} type="video/webm" />
                                            </video>
                                          </div>
                                        )}
                                        
                                        {actualAnswer.transcription ? (
                                          <div className="bg-white rounded-lg p-3 border border-blue-100">
                                            <div className="flex items-center gap-2 mb-2">
                                              <Mic className="h-3 w-3 text-blue-600" />
                                              <span className="text-xs font-semibold text-blue-800">Transcript:</span>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleClearTranscript(question.id)}
                                                className="ml-auto text-xs px-2 py-1 h-6"
                                                title="Clear transcript"
                                                disabled={clearingTranscript.has(question.id)}
                                              >
                                                {clearingTranscript.has(question.id) ? 'Clearing...' : 'Clear'}
                                              </Button>
                                            </div>
                                            <p className="text-gray-800 text-sm leading-relaxed" dir="rtl">
                                              "{actualAnswer.transcription}"
                                            </p>
                                          </div>
                                        ) : (
                                          <div className="bg-white rounded-lg p-3 border border-blue-100">
                                            <div className="flex items-center gap-2 mb-2">
                                              <Brain className="h-3 w-3 text-blue-600" />
                                              <span className="text-xs font-semibold text-blue-800">AI Transcription:</span>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => runAIAnalysis()}
                                                className="ml-auto text-xs px-2 py-1 h-6 bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                                                title="Generate AI transcript for this video response"
                                                disabled={isAnalyzing}
                                              >
                                                {isAnalyzing ? (
                                                  <>
                                                    <Brain className="h-3 w-3 animate-spin mr-1" />
                                                    Analyzing...
                                                  </>
                                                ) : (
                                                  <>
                                                    <Zap className="h-3 w-3 mr-1" />
                                                    Get Transcript
                                                  </>
                                                )}
                                              </Button>
                                            </div>
                                            <p className="text-gray-600 text-sm italic">
                                              No transcript available. Click "Get Transcript" to generate AI transcription.
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }
                                
                                // Handle audio responses
                                if (actualAnswer?.type === 'audio_response') {
                                  return (
                                    <div className="space-y-4">
                                      {/* Audio Response */}
                                      <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border-2 border-orange-200">
                                        <div className="flex items-center gap-3 mb-3">
                                          <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center">
                                            <Mic className="h-4 w-4 text-white" />
                                          </div>
                                          <div className="flex-1">
                                            <span className="font-bold text-orange-800 text-sm">Audio Response</span>
                                            <p className="text-orange-600 text-xs">Recorded answer with transcription</p>
                                          </div>
                                          {actualAnswer.confidence && (
                                            <Badge variant="outline" className="bg-white border-orange-300 text-orange-700 text-xs">
                                              {Math.round(actualAnswer.confidence * 100)}%
                                            </Badge>
                                          )}
                                        </div>
                                        
                                        {actualAnswer.audioUrl && (
                                          <div className="mb-3">
                                            <audio
                                              controls
                                              className="w-full rounded-lg shadow border border-orange-300"
                                              style={{ maxHeight: '50px' }}
                                            >
                                              <source src={actualAnswer.audioUrl} type="audio/webm" />
                                              Your browser does not support the audio element.
                                            </audio>
                                          </div>
                                        )}
                                        
                                        {actualAnswer.transcription ? (
                                          <div className="bg-white rounded-lg p-3 border border-orange-100">
                                            <div className="flex items-center gap-2 mb-2">
                                              <Mic className="h-3 w-3 text-orange-600" />
                                              <span className="text-xs font-semibold text-orange-800">Transcript:</span>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleClearTranscript(question.id)}
                                                className="ml-auto text-xs px-2 py-1 h-6"
                                                title="Clear transcript"
                                                disabled={clearingTranscript.has(question.id)}
                                              >
                                                {clearingTranscript.has(question.id) ? 'Clearing...' : 'Clear'}
                                              </Button>
                                            </div>
                                            <p className="text-gray-800 text-sm leading-relaxed" dir="rtl">
                                              "{actualAnswer.transcription}"
                                            </p>
                                          </div>
                                        ) : (
                                          <div className="bg-white rounded-lg p-3 border border-orange-100">
                                            <div className="flex items-center gap-2 mb-2">
                                              <Brain className="h-3 w-3 text-orange-600" />
                                              <span className="text-xs font-semibold text-orange-800">AI Transcription:</span>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => runAIAnalysis()}
                                                className="ml-auto text-xs px-2 py-1 h-6 bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100"
                                                title="Generate AI transcript for this audio response"
                                                disabled={isAnalyzing}
                                              >
                                                {isAnalyzing ? (
                                                  <>
                                                    <Brain className="h-3 w-3 animate-spin mr-1" />
                                                    Analyzing...
                                                  </>
                                                ) : (
                                                  <>
                                                    <Zap className="h-3 w-3 mr-1" />
                                                    Get Transcript
                                                  </>
                                                )}
                                              </Button>
                                            </div>
                                            <p className="text-gray-600 text-sm italic">
                                              No transcript available. Click "Get Transcript" to generate AI transcription.
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }
                                
                                // Default to text response
                                return (
                                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
                                    <div className="flex items-center gap-3 mb-3">
                                      <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                                        <FileText className="h-4 w-4 text-white" />
                                      </div>
                                      <div>
                                        <span className="font-bold text-green-800 text-sm">Text Response</span>
                                        <p className="text-green-600 text-xs">Student's written answer</p>
                                      </div>
                                    </div>
                                    <div className="bg-white rounded-lg p-4 border border-green-100">
                                      <div className="flex items-center gap-2 mb-2">
                                        <User className="h-3 w-3 text-gray-500" />
                                        <span className="text-xs font-medium text-gray-600">{submission.studentName}'s Answer:</span>
                                      </div>
                                      <p className="text-gray-800 leading-relaxed text-sm font-medium">
                                        {String(actualAnswer.answer || actualAnswer)}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                            
                            {/* Question Options */}
                            {question.options && (
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <BookOpen className="h-4 w-4 text-purple-600" />
                                  <h4 className="text-sm font-semibold text-gray-900">Answer Options</h4>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                  {question.options.map((option: string, idx: number) => {
                                    const actualAnswer = studentAnswer || 
                                                       submissionData?.answers?.[question.id] || 
                                                       submissionData?.answers?.[question.id.toString()];
                                    
                                    return (
                                      <div 
                                        key={idx} 
                                        className={`p-3 rounded-lg border-2 transition-all duration-200 text-sm ${
                                          option === question.correctAnswer 
                                            ? 'bg-green-50 border-green-300 text-green-800' 
                                            : option === actualAnswer?.answer
                                            ? 'bg-blue-50 border-blue-300 text-blue-800'
                                            : 'bg-gray-50 border-gray-200 text-gray-700'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-xs">
                                            {String.fromCharCode(65 + idx)}
                                          </span>
                                          <span className="flex-1">{option}</span>
                                          {option === question.correctAnswer && (
                                            <CheckCircle className="h-3 w-3 text-green-600" />
                                          )}
                                          {option === actualAnswer?.answer && option !== question.correctAnswer && (
                                            <XCircle className="h-3 w-3 text-red-600" />
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* Detailed Analysis Tab */}
            <TabsContent value="analysis" className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* AI Analysis Summary */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">AI Analysis</CardTitle>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => runComprehensiveAnalysis()}
                          disabled={isAnalyzing}
                          className="flex items-center gap-2"
                        >
                          {isAnalyzing ? (
                            <>
                              <Brain className="h-4 w-4 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Zap className="h-4 w-4" />
                              Quick Analysis
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {aiAnalysis && aiAnalysis.length > 0 ? (
                      <div className="space-y-3">
                        <Alert className="border-blue-200 bg-blue-50">
                          <Info className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-800">
                            AI detected {aiAnalysis.length} notable patterns during the exam
                          </AlertDescription>
                        </Alert>
                        <div className="space-y-2">
                          {aiAnalysis.slice(0, 3).map((item: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 text-sm p-2 bg-green-50 rounded">
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                              <span>{item.summary || item.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-gray-500">No AI analysis available yet</p>
                        <p className="text-sm text-gray-400 mt-2">Click "Quick Analysis" to start</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Proctoring Stats */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Integrity Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Face Detection</span>
                        <span>{proctoringData?.stats?.faceDetectionScore || 98}%</span>
                      </div>
                      <Progress value={proctoringData?.stats?.faceDetectionScore || 98} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Behavior Score</span>
                        <span>{proctoringData?.stats?.behaviorScore || 95}%</span>
                      </div>
                      <Progress value={proctoringData?.stats?.behaviorScore || 95} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Overall Integrity</span>
                        <span>{proctoringData?.stats?.overallIntegrity || 95}%</span>
                      </div>
                      <Progress value={proctoringData?.stats?.overallIntegrity || 95} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Enhanced Camera Feed Videos */}
              {proctoringData?.videos?.camera && proctoringData.videos.camera.length > 0 && (
                <Card className="border-0 shadow-2xl overflow-hidden bg-white/90 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-600/5 rounded-xl"></div>
                  <CardHeader className="relative z-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <CardTitle className="flex items-center space-x-3 text-2xl">
                      <Camera className="h-8 w-8" />
                      <span>📹 Live Student Monitoring</span>
                      <Badge className="bg-white/20 backdrop-blur-sm text-white ml-auto px-4 py-2">
                        {proctoringData.videos.camera.length} Active Feed{proctoringData.videos.camera.length !== 1 ? 's' : ''}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium">RECORDING</span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black">
                      <div className="grid grid-cols-1 gap-4 p-4">
                        {proctoringData.videos.camera.map((videoUrl: string, idx: number) => (
                          <div key={idx} className="relative group overflow-hidden rounded-lg">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40 pointer-events-none z-10"></div>
                            
                            <div className="absolute top-4 start-4 bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 z-20 shadow-2xl border border-red-400">
                              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                              📹 LIVE FEED {idx + 1}
                            </div>
                            
                            <div className="absolute bottom-4 start-4 bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg z-20 border border-white/20">
                              <div className="text-xs font-medium text-blue-300">STUDENT</div>
                              <div className="text-sm font-bold">{submission.studentName}</div>
                            </div>
                            
                            <video
                              controls
                              className="w-full hover:scale-105 transition-all duration-500 border-2 border-white/20 rounded-lg"
                              style={{ minHeight: '400px', maxHeight: '600px' }}
                            >
                              <source src={videoUrl} type="video/webm" />
                            </video>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Screen Recording Videos */}
              {proctoringData?.videos?.screen && proctoringData.videos.screen.length > 0 && (
                <Card className="border-0 shadow-2xl overflow-hidden bg-white/90 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-teal-600/5 rounded-xl"></div>
                  <CardHeader className="relative z-10 bg-gradient-to-r from-green-600 to-teal-600 text-white">
                    <CardTitle className="flex items-center space-x-3 text-2xl">
                      <Monitor className="h-8 w-8" />
                      <span>🖥️ Screen Recording</span>
                      <Badge className="bg-white/20 backdrop-blur-sm text-white ml-auto px-4 py-2">
                        {proctoringData.videos.screen.length} Recording{proctoringData.videos.screen.length !== 1 ? 's' : ''}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10 p-0">
                    <div className="bg-gradient-to-br from-gray-900 to-black">
                      <div className="grid grid-cols-1 gap-0">
                        {proctoringData.videos.screen.map((videoUrl: string, idx: number) => (
                          <div key={idx} className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none z-10"></div>
                            <div className="absolute top-4 start-4 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 z-20 shadow-2xl">
                              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                              🖥️ Screen Capture {idx + 1}
                            </div>
                            <div className="absolute top-4 end-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs z-20 border border-white/20">
                              Full Screen • 1080p
                            </div>
                            <div className="absolute bottom-4 start-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs z-20 border border-white/20">
                              Screen {idx + 1} • Monitoring
                            </div>
                            <video
                              controls
                              className="w-full hover:scale-105 transition-transform duration-500 border-2 border-white/10"
                              style={{ minHeight: '400px', maxHeight: '600px' }}
                              preload="metadata"
                            >
                              <source src={videoUrl} type="video/webm" />
                              Your browser does not support the video tag.
                            </video>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Student Video Answers */}
              {submissionData?.videoAnswers && submissionData.videoAnswers.length > 0 && (
                <Card className="border-0 shadow-2xl overflow-hidden bg-white/90 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-600/5 rounded-xl"></div>
                  <CardHeader className="relative z-10 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                    <CardTitle className="flex items-center space-x-3 text-2xl">
                      <Video className="h-8 w-8" />
                      <span>🎬 Student Video Answers</span>
                      <Badge className="bg-white/20 backdrop-blur-sm text-white ml-auto px-4 py-2">
                        {submissionData.videoAnswers.length} Answer{submissionData.videoAnswers.length !== 1 ? 's' : ''}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium">Responses</span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10 p-0">
                    <div className="bg-gradient-to-br from-gray-900 to-black">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                        {submissionData.videoAnswers.map((videoAnswer: any, idx: number) => {
                          // Find the corresponding question
                          const question = exam.questions?.find((q: any) => q.id === videoAnswer.questionId);
                          
                          return (
                            <div key={idx} className="relative group">
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none z-10"></div>
                              <div className="absolute top-4 start-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 z-20 shadow-2xl">
                                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                                🎬 Question {videoAnswer.questionId}
                              </div>
                              <div className="absolute top-4 end-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs z-20 border border-white/20">
                                Video Answer • {Math.round((videoAnswer.confidence || 0) * 100)}%
                              </div>
                              <div className="absolute bottom-4 start-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs z-20 border border-white/20 max-w-xs truncate" dir="rtl">
                                {videoAnswer.transcription || 'No transcription'}
                              </div>
                              <video
                                controls
                                className="w-full hover:scale-105 transition-transform duration-500 border-2 border-white/10"
                                style={{ minHeight: '320px', maxHeight: '420px' }}
                                preload="metadata"
                              >
                                <source src={videoAnswer.videoPath} type="video/webm" />
                                Your browser does not support the video tag.
                              </video>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Student Answer Videos from submission answers */}
              {(() => {
                // Extract video answers from submission.answers
                const answerVideos = Object.entries(submissionData?.answers || {})
                  .filter(([_, answer]: [string, any]) => answer?.type === 'video_response' && answer?.videoUrl)
                  .map(([questionId, answer]: [string, any]) => ({
                    questionId: parseInt(questionId),
                    videoUrl: answer.videoUrl,
                    transcription: answer.transcription,
                    confidence: answer.confidence
                  }));

                if (answerVideos.length === 0) return null;

                return (
                  <Card className="border-0 shadow-2xl overflow-hidden bg-white/90 backdrop-blur-sm">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-600/5 rounded-xl"></div>
                    <CardHeader className="relative z-10 bg-gradient-to-r from-orange-600 to-red-600 text-white">
                      <CardTitle className="flex items-center space-x-3 text-2xl">
                        <Video className="h-8 w-8" />
                        <span>📹 Question Responses</span>
                        <Badge className="bg-white/20 backdrop-blur-sm text-white ml-auto px-4 py-2">
                          {answerVideos.length} Video{answerVideos.length !== 1 ? 's' : ''}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium">Answers</span>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 p-0">
                      <div className="bg-gradient-to-br from-gray-900 to-black">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                          {answerVideos.map((answer: any, idx: number) => {
                            // Find the corresponding question
                            const question = exam.questions?.find((q: any) => q.id === answer.questionId);
                            
                            return (
                              <div key={idx} className="relative group">
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none z-10"></div>
                                <div className="absolute top-4 start-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 z-20 shadow-2xl">
                                  <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                                  📹 Q{answer.questionId}
                                </div>
                                <div className="absolute top-4 end-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs z-20 border border-white/20">
                                  {Math.round((answer.confidence || 0) * 100)}% Confidence
                                </div>
                                <div className="absolute bottom-4 start-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs z-20 border border-white/20 max-w-xs truncate" dir="rtl">
                                  {answer.transcription ? `"${answer.transcription}"` : 'No transcription'}
                                </div>
                                <video
                                  controls
                                  className="w-full hover:scale-105 transition-transform duration-500 border-2 border-white/10"
                                  style={{ minHeight: '320px', maxHeight: '420px' }}
                                  preload="metadata"
                                >
                                  <source src={answer.videoUrl} type="video/webm" />
                                  Your browser does not support the video tag.
                                </video>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </TabsContent>

            {/* Proctoring & Media Tab */}
            <TabsContent value="proctoring" className="p-6 space-y-6">
              <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-700 text-white p-8 rounded-2xl shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold flex items-center gap-3 mb-3">
                      <Camera className="h-10 w-10" />
                      🎥 Proctoring & Media Analysis
                    </h2>
                    <p className="text-purple-100 text-lg">
                      Comprehensive monitoring and security analysis for {submission.studentName}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                      <div className="text-sm text-purple-200">Integrity Score</div>
                      <div className="text-2xl font-bold">
                        {proctoringData?.stats?.overallIntegrity || 95}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Camera Feed Videos */}
              {proctoringData?.videos?.camera && proctoringData.videos.camera.length > 0 && (
                <Card className="border-0 shadow-2xl overflow-hidden bg-white/90 backdrop-blur-sm">
                  <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <CardTitle className="flex items-center space-x-3 text-2xl">
                      <Camera className="h-8 w-8" />
                      <span>📹 Live Student Monitoring</span>
                      <Badge className="bg-white/20 backdrop-blur-sm text-white ml-auto px-4 py-2">
                        {proctoringData.videos.camera.length} Active Feed{proctoringData.videos.camera.length !== 1 ? 's' : ''}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium">RECORDING</span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black">
                      <div className="grid grid-cols-1 gap-4 p-4">
                        {proctoringData.videos.camera.map((videoUrl: string, idx: number) => (
                          <div key={idx} className="relative group overflow-hidden rounded-lg">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40 pointer-events-none z-10"></div>
                            
                            <div className="absolute top-4 start-4 bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 z-20 shadow-2xl border border-red-400">
                              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                              📹 LIVE FEED {idx + 1}
                            </div>
                            
                            <div className="absolute bottom-4 start-4 bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg z-20 border border-white/20">
                              <div className="text-xs font-medium text-blue-300">STUDENT</div>
                              <div className="text-sm font-bold">{submission.studentName}</div>
                            </div>
                            
                            <video
                              controls
                              className="w-full hover:scale-105 transition-all duration-500 border-2 border-white/20 rounded-lg"
                              style={{ minHeight: '400px', maxHeight: '600px' }}
                            >
                              <source src={videoUrl} type="video/webm" />
                            </video>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Screen Recording Videos */}
              {proctoringData?.videos?.screen && proctoringData.videos.screen.length > 0 && (
                <Card className="border-0 shadow-2xl overflow-hidden bg-white/90 backdrop-blur-sm">
                  <CardHeader className="bg-gradient-to-r from-green-600 to-teal-600 text-white">
                    <CardTitle className="flex items-center space-x-3 text-2xl">
                      <Monitor className="h-8 w-8" />
                      <span>🖥️ Screen Recording</span>
                      <Badge className="bg-white/20 backdrop-blur-sm text-white ml-auto px-4 py-2">
                        {proctoringData.videos.screen.length} Recording{proctoringData.videos.screen.length !== 1 ? 's' : ''}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black">
                      <div className="grid grid-cols-1 gap-4 p-4">
                        {proctoringData.videos.screen.map((videoUrl: string, idx: number) => (
                          <div key={idx} className="relative group overflow-hidden rounded-lg">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40 pointer-events-none z-10"></div>
                            
                            <div className="absolute top-4 start-4 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 z-20 shadow-2xl border border-green-400">
                              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                              🖥️ SCREEN CAPTURE {idx + 1}
                            </div>
                            
                            <div className="absolute bottom-4 start-4 bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg z-20 border border-white/20">
                              <div className="text-xs font-medium text-green-300">DESKTOP</div>
                              <div className="text-sm font-bold">{submission.studentName}</div>
                            </div>
                            
                            <video
                              controls
                              className="w-full hover:scale-105 transition-all duration-500 border-2 border-white/20 rounded-lg"
                              style={{ minHeight: '400px', maxHeight: '600px' }}
                            >
                              <source src={videoUrl} type="video/webm" />
                            </video>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* AI Tools Tab */}
            <TabsContent value="ai-tools" className="p-6 space-y-6">
              <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white p-8 rounded-2xl shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold flex items-center gap-3 mb-3">
                      <Zap className="h-10 w-10" />
                      🤖 AI Analysis Tools
                    </h2>
                    <p className="text-purple-100 text-lg">
                      Advanced AI-powered analysis and insights for {submission.studentName}'s exam
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                      <div className="text-sm text-purple-200">AI Status</div>
                      <div className="text-xl font-semibold">
                        {aiAnalysis ? 'Complete' : 'Ready'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* AI Analysis Controls */}
                <Card className="border-0 shadow-2xl">
                  <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <CardTitle className="flex items-center gap-3 text-2xl">
                      <Brain className="h-8 w-8" />
                      🧠 AI Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex flex-col gap-3">
                      <Button
                        onClick={runAIAnalysis}
                        disabled={isAnalyzing}
                        className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg"
                      >
                        {isAnalyzing ? (
                          <>
                            <Brain className="h-5 w-5 mr-2 animate-spin" />
                            Running Analysis...
                          </>
                        ) : (
                          <>
                            <Zap className="h-5 w-5 mr-2" />
                            Quick AI Analysis
                          </>
                        )}
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={runComprehensiveAnalysis}
                        disabled={isAnalyzing}
                        className="w-full border-2 border-purple-300 text-purple-700 hover:bg-purple-50 font-bold py-3 px-6 rounded-lg"
                      >
                        {isAnalyzing ? (
                          <>
                            <Brain className="h-5 w-5 mr-2 animate-spin" />
                            Comprehensive Analysis...
                          </>
                        ) : (
                          <>
                            <BarChart3 className="h-5 w-5 mr-2" />
                            Comprehensive Analysis
                          </>
                        )}
                      </Button>
                    </div>
                    
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-900 mb-2">AI Analysis Features:</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Answer quality assessment</li>
                        <li>• Behavioral pattern analysis</li>
                        <li>• Integrity score calculation</li>
                        <li>• Performance insights</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Results */}
                <Card className="border-0 shadow-2xl">
                  <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                    <CardTitle className="flex items-center gap-3 text-2xl">
                      <BarChart3 className="h-8 w-8" />
                      📊 AI Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {aiAnalysis && aiAnalysis.length > 0 ? (
                      <div className="space-y-4">
                        <Alert className="border-green-200 bg-green-50">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800">
                            AI analysis complete! Found {aiAnalysis.length} insights.
                          </AlertDescription>
                        </Alert>
                        
                        <div className="space-y-3">
                          {aiAnalysis.slice(0, 5).map((item: any, idx: number) => (
                            <div key={idx} className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                  {idx + 1}
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900 mb-1">
                                    {item.title || 'Analysis Result'}
                                  </p>
                                  <p className="text-sm text-gray-700">
                                    {item.summary || item.description || 'AI analysis insight'}
                                  </p>
                                  {item.confidence && (
                                    <div className="mt-2">
                                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                        <span>Confidence</span>
                                        <span>{Math.round(item.confidence * 100)}%</span>
                                      </div>
                                      <Progress value={Math.round(item.confidence * 100)} className="h-2" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Brain className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-600 font-medium mb-2">No AI analysis available yet</p>
                        <p className="text-sm text-gray-500">Click "Quick AI Analysis" to start analyzing this exam submission</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
} 