import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ExamWithStats, ExamInvitation } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Eye, 
  Share, 
  Trash2, 
  FileText, 
  Users, 
  Clock, 
  Calendar,
  Search,
  Filter,
  Edit,
  BarChart3,
  Grid3X3,
  List,
  MoreHorizontal
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import StudentInviteManager from "@/components/StudentInviteManager";

interface ExamListProps {
  onSelectExam?: (examId: number, tab: string) => void;
}

export default function ExamList({ onSelectExam }: ExamListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [selectedExam, setSelectedExam] = useState<ExamWithStats | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: exams = [], isLoading } = useQuery<ExamWithStats[]>({
    queryKey: ["/api/exams"],
  });

  const deleteExamMutation = useMutation({
    mutationFn: async (examId: number) => {
      await apiRequest("DELETE", `/api/exams/${examId}`);
    },
    onSuccess: () => {
      toast({
        title: "Exam deleted successfully",
        description: "The exam has been removed from your account.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete the exam. Please try again.",
        variant: "destructive",
      });
    },
  });

  const publishExamMutation = useMutation({
    mutationFn: async (examId: number) => {
      await apiRequest("PATCH", `/api/exams/${examId}`, { status: "published" });
    },
    onSuccess: () => {
      toast({
        title: "Exam published successfully",
        description: "Students can now access your exam.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to publish the exam. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredExams = exams.filter((exam) => {
    const matchesSearch = exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         exam.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = subjectFilter === "all" || exam.subject === subjectFilter;
    return matchesSearch && matchesSubject;
  });

  const subjects = Array.from(new Set(exams.map(exam => exam.subject)));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge className="bg-green-100 text-green-800">Published</Badge>;
      case "draft":
        return <Badge className="bg-yellow-100 text-yellow-800">Draft</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleShare = (examId: number) => {
    const examUrl = `${window.location.origin}/take-exam/${examId}`;
    navigator.clipboard.writeText(examUrl).then(() => {
      toast({
        title: "Link copied!",
        description: "The exam link has been copied to your clipboard.",
      });
    });
  };

  const handleResults = (examId: number) => {
    // Navigate to dashboard results tab for this exam
    if (onSelectExam) {
      onSelectExam(examId, 'results');
    } else {
      // Fallback: navigate to dashboard with exam selected
      window.location.href = `/?exam=${examId}&tab=results`;
    }
  };

  const handleView = (examId: number) => {
    window.open(`/take-exam/${examId}`, '_blank');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-32 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>My Exams</CardTitle>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search exams..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* View Toggle Buttons */}
              <div className="flex items-center border rounded-lg">
                <Button
                  variant={viewMode === "card" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("card")}
                  className="rounded-l-lg rounded-r-none border-0"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="rounded-r-lg rounded-l-none border-0"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {filteredExams.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || subjectFilter !== "all" ? "No exams found" : "No exams created yet"}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || subjectFilter !== "all" 
                  ? "Try adjusting your search or filter criteria." 
                  : "Create your first exam to get started with online assessments."
                }
              </p>
            </div>
          ) : viewMode === "card" ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredExams.map((exam) => (
                <Card key={exam.id} className="group hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                        {exam.title.charAt(0)}
                      </div>
                      {getStatusBadge(exam.status)}
                    </div>
                    
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 mb-2">{exam.title}</h3>
                      <p className="text-sm text-gray-600 mb-3">{exam.subject}</p>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">{exam.questionsCount} questions</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">{exam.submissionsCount} submissions</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">Created {formatDate(exam.createdAt?.toString() || '')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">{exam.duration} min</span>
                        </div>
                      </div>
                      
                      {exam.averageScore !== undefined && (
                        <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Average Score</span>
                            <span className="font-semibold text-blue-600">{exam.averageScore.toFixed(1)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-3 mt-6">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50"
                          onClick={() => handleView(exam.id)}
                          title="Preview Exam"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Preview
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-purple-600 hover:text-purple-700 border-purple-200 hover:bg-purple-50"
                          onClick={() => {
                            setSelectedExam(exam);
                            setInviteDialogOpen(true);
                          }}
                          title="Manage Student Invitations"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50"
                          onClick={() => handleResults(exam.id)}
                          title="View Results"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="flex gap-2">
                        {exam.status === "published" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-green-600 hover:text-green-700 border-green-200 hover:bg-green-50"
                            onClick={() => handleShare(exam.id)}
                            title="Copy Exam Link"
                          >
                            <Share className="h-4 w-4 mr-1" />
                            Share Link
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                            onClick={() => publishExamMutation.mutate(exam.id)}
                            disabled={publishExamMutation.isPending}
                            title="Publish Exam"
                          >
                            {publishExamMutation.isPending ? "Publishing..." : "Publish"}
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to delete this exam?")) {
                              deleteExamMutation.mutate(exam.id);
                            }
                          }}
                          disabled={deleteExamMutation.isPending}
                          title="Delete Exam"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // List View
            <div className="space-y-4">
              {filteredExams.map((exam) => (
                <Card key={exam.id} className="hover:shadow-md transition-all duration-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                          {exam.title.charAt(0)}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-lg text-gray-900">{exam.title}</h3>
                              <p className="text-sm text-gray-600">{exam.subject}</p>
                            </div>
                            
                            <div className="flex items-center space-x-6 text-sm text-gray-500">
                              <div className="flex items-center">
                                <FileText className="h-4 w-4 mr-1" />
                                {exam.questionsCount} questions
                              </div>
                              <div className="flex items-center">
                                <Users className="h-4 w-4 mr-1" />
                                {exam.submissionsCount} submissions
                              </div>
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 mr-1" />
                                {exam.duration} min
                              </div>
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                {exam.createdAt ? formatDate(exam.createdAt.toString()) : 'No date'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        {getStatusBadge(exam.status)}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleView(exam.id)}
                          title="Preview Exam"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResults(exam.id)}
                          title="View Results"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedExam(exam);
                            setInviteDialogOpen(true);
                          }}
                          title="Manage Students"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {}}
                          title="More Actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student Invite Manager Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Manage Student Invitations - {selectedExam?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedExam && (
            <StudentInviteManager
              examId={selectedExam.id}
              examTitle={selectedExam.title}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}