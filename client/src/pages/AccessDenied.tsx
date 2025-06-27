import { Shield, Mail, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AccessDenied() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-16 w-16 text-red-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Access Denied
          </CardTitle>
          <CardDescription className="text-gray-600">
            You don't have permission to access this platform
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              ExamCraft is an invitation-only platform. You need a valid invitation to create an account.
            </AlertDescription>
          </Alert>

          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-2">
              <Mail className="h-4 w-4 mt-0.5 text-blue-500" />
              <div>
                <p className="font-medium">Need Access?</p>
                <p>Contact your institution administrator to request an invitation.</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button 
              onClick={() => window.location.href = '/api/logout'}
              variant="outline" 
              className="w-full"
            >
              Sign Out
            </Button>
          </div>

          <div className="text-xs text-gray-500 text-center">
            Only users with valid invitations from platform administrators can access ExamCraft.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}