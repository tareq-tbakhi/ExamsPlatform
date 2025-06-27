import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Users, Mail, FileText, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ExamInvitation } from "@shared/schema";

interface StudentInviteManagerProps {
  examId: number;
  examTitle: string;
}

export default function StudentInviteManager({ examId, examTitle }: StudentInviteManagerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch existing invitations
  const { data: invitations = [], isLoading: loadingInvitations } = useQuery<ExamInvitation[]>({
    queryKey: ["/api/exams", examId, "invitations"],
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/exams/${examId}/upload-students`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Students uploaded successfully!",
        description: `${data.successfulInvitations} students invited to the exam.`,
      });
      setFile(null);
      setUploadStatus("");
      queryClient.invalidateQueries({ queryKey: ["/api/exams", examId, "invitations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadStatus("");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const allowedTypes = ['.csv', '.xlsx', '.xls'];
      const fileExt = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
      
      if (!allowedTypes.includes(fileExt)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV or Excel file (.csv, .xlsx, .xls)",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploadStatus("Uploading and processing...");
    const formData = new FormData();
    formData.append("csvFile", file);
    
    uploadMutation.mutate(formData);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "sent":
        return <Mail className="h-4 w-4 text-blue-600" />;
      case "accessed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      default:
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      sent: "default",
      accessed: "outline",
      completed: "default",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "destructive"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Student List
          </CardTitle>
          <CardDescription>
            Upload a CSV or Excel file containing student emails and registration numbers for "{examTitle}"
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              <strong>CSV Format:</strong> Include columns named "email", "name", and "registration" (or similar variations).
              <br />
              <strong>Example:</strong> email, name, registration_number
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="csvFile">Select CSV/Excel File</Label>
            <Input
              id="csvFile"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              disabled={uploadMutation.isPending}
            />
          </div>

          {file && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-md">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
                size="sm"
              >
                {uploadMutation.isPending ? "Processing..." : "Upload"}
              </Button>
            </div>
          )}

          {uploadStatus && (
            <Alert>
              <AlertDescription>{uploadStatus}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Invitations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student Invitations ({invitations.length})
          </CardTitle>
          <CardDescription>
            Manage and monitor student invitations for this exam
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingInvitations ? (
            <div className="text-center py-4">Loading invitations...</div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No students invited yet</p>
              <p className="text-sm">Upload a CSV file to invite students</p>
            </div>
          ) : (
            <div className="space-y-2">
              {invitations.map((invitation: ExamInvitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(invitation.inviteStatus)}
                    <div>
                      <div className="font-medium">{invitation.studentEmail}</div>
                      <div className="text-sm text-muted-foreground">
                        {invitation.studentName && `${invitation.studentName} • `}
                        {invitation.registrationNumber && `Reg: ${invitation.registrationNumber}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(invitation.inviteStatus)}
                    {invitation.accessedAt && (
                      <span className="text-xs text-muted-foreground">
                        Accessed: {new Date(invitation.accessedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}