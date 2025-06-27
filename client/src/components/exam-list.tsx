import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Eye, Edit, Share, Trash2, Search, Grid3X3, List, BookOpen, Send, Users, Clock, FileText, TrendingUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ExamWithStats } from "@shared/schema";

export default function ExamList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mock user ID - in real app this would come from authentication
  const userId = 1;

  const { data: exams = [], isLoading } = useQuery<ExamWithStats[]>({
    queryKey: [`/api/exams/creator/${userId}`],
  });

  const deleteExamMutation = useMutation({
    mutationFn: async (examId: number) => {
      await apiRequest("DELETE", `/api/exams/${examId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams/creator", userId] });
      toast({
        title: "Success",
        description: "Exam deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete exam: " + error.message,
        variant: "destructive",
      });
    },
  });

  const publishExamMutation = useMutation({
    mutationFn: async (examId: number) => {
      await apiRequest("PUT", `/api/exams/${examId}`, { status: "published" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams/creator", userId] });
      toast({
        title: "Success",
        description: "Exam published successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to publish exam: " + error.message,
        variant: "destructive",
      });
    },
  });

  const filteredExams = exams.filter(exam => {
    const matchesSearch = exam.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = subjectFilter === "all" || exam.subject === subjectFilter;
    return matchesSearch && matchesSubject;
  });

  const subjects = Array.from(new Set(exams.map(exam => exam.subject)));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge className="bg-green-100 text-green-800">Published</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "archived":
        return <Badge variant="outline">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleShare = (examId: number) => {
    const shareUrl = `${window.location.origin}/take-exam/${examId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({
        title: "Link Copied!",
        description: "The exam link has been copied to your clipboard.",
      });
    });
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
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
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
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map(subject => (
                  <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as "table" | "cards")}>
              <ToggleGroupItem value="cards" aria-label="Card view" className="h-10 w-10">
                <Grid3X3 className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Table view" className="h-10 w-10">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredExams.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">
              {exams.length === 0 ? "No exams created yet." : "No exams match your search criteria."}
            </p>
            {exams.length === 0 && (
              <p className="text-sm text-gray-400">
                Create your first exam using the "Create Exam" tab.
              </p>
            )}
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submissions</TableHead>
                  <TableHead>Avg Score</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900">{exam.title}</div>
                        <div className="text-sm text-gray-500">
                          Created: {new Date(exam.createdAt!).toLocaleDateString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{exam.subject}</TableCell>
                    <TableCell className="text-gray-600">{exam.questionsCount}</TableCell>
                    <TableCell>{getStatusBadge(exam.status)}</TableCell>
                    <TableCell className="text-gray-600">
                      {exam.submissionsCount}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {exam.averageScore ? `${exam.averageScore.toFixed(1)}%` : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(exam.id)}
                          title="Take Exam"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          title="Edit Exam (Coming Soon)"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        {exam.status === "published" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleShare(exam.id)}
                            title="Share Exam"
                          >
                            <Share className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => publishExamMutation.mutate(exam.id)}
                            disabled={publishExamMutation.isPending}
                            title="Publish Exam"
                            className="text-orange-600 hover:text-orange-700"
                          >
                            {publishExamMutation.isPending ? "..." : "Publish"}
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to delete this exam?")) {
                              deleteExamMutation.mutate(exam.id);
                            }
                          }}
                          disabled={deleteExamMutation.isPending}
                          title="Delete Exam"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExams.map((exam) => (
              <Card key={exam.id} className="bg-white border-0 shadow-xl rounded-2xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2"></div>
                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
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
                          <TrendingUp className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">
                            {exam.averageScore ? `${exam.averageScore.toFixed(1)}% avg` : "No data"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {exam.status === "published" ? (
                        <div className="space-y-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border-green-200 text-green-700 hover:text-green-800 font-semibold"
                            onClick={() => handleView(exam.id)}
                          >
                            <BookOpen className="h-4 w-4 mr-2" />
                            Take Test
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 border-blue-200 text-blue-700 hover:text-blue-800 font-semibold"
                            onClick={() => handleShare(exam.id)}
                          >
                            <Share className="h-4 w-4 mr-2" />
                            Copy Link
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full bg-gradient-to-r from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 border-orange-200 text-orange-700 hover:text-orange-800 font-semibold"
                          onClick={() => publishExamMutation.mutate(exam.id)}
                          disabled={publishExamMutation.isPending}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {publishExamMutation.isPending ? "Publishing..." : "Publish Exam"}
                        </Button>
                      )}
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          disabled
                          title="Edit Exam (Coming Soon)"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to delete this exam?")) {
                              deleteExamMutation.mutate(exam.id);
                            }
                          }}
                          disabled={deleteExamMutation.isPending}
                          title="Delete Exam"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
