import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Send, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function EmailTestPanel() {
  const [email, setEmail] = useState("mehdawiadham@gmail.com");
  const [emailType, setEmailType] = useState("user_invitation");
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const handleSendTestEmail = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setLastResult(null);

    try {
      const response = await apiRequest("/api/test-email", "POST", {
        recipientEmail: email,
        testType: emailType
      });

      const result = await response.json();
      
      if (result.success) {
        setLastResult({ success: true, message: result.message });
        toast({
          title: "Email Sent Successfully",
          description: `Test email sent to ${email}`,
          variant: "default"
        });
      } else {
        setLastResult({ success: false, message: result.message });
        toast({
          title: "Email Failed",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setLastResult({ success: false, message: errorMessage });
      toast({
        title: "Email Test Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email System Test Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Address</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email to test"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Type</label>
            <Select value={emailType} onValueChange={setEmailType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user_invitation">User Platform Invitation</SelectItem>
                <SelectItem value="exam_invitation">Student Exam Invitation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleSendTestEmail}
          disabled={isLoading || !email}
          className="w-full"
        >
          {isLoading ? (
            <>
              <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
              Sending Test Email...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send Test Email
            </>
          )}
        </Button>

        {lastResult && (
          <div className={`p-4 rounded-lg border ${
            lastResult.success 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {lastResult.success ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              <span className="font-medium">
                {lastResult.success ? 'Email Sent Successfully' : 'Email Failed'}
              </span>
            </div>
            <p className="text-sm">{lastResult.message}</p>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">Email System Status</h4>
          <div className="space-y-1 text-sm text-blue-800">
            <p>• User invitation emails for platform access</p>
            <p>• Student exam invitation emails with exam details</p>
            <p>• Professional branded email templates</p>
            <p>• Mobile-responsive design</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}