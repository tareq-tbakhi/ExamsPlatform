import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Edit, Share, Trash2, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ExamWithStats } from "@shared/schema";

export default function ExamList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mock user ID - in real app this would come from authentication
  const userId = 1;

  const { data: exams = [], isLoading } = useQuery<ExamWithStats[]>({
    queryKey: ["/api/exams/creator", userId],
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
    const shareUrl = `${window.location.origin}/exam/${examId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({
        title: "Link Copied!",
        description: "The exam link has been copied to your clipboard.",
      });
    });
  };

  const handleView = (examId: number) => {
    window.open(`/exam/${examId}`, '_blank');
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
          <div className="flex items-center space-x-3">
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
        ) : (
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
                          title="View Exam"
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
        )}
      </CardContent>
    </Card>
  );
}
