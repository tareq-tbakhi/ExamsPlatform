import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Shield, Users, TrendingUp } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <BookOpen className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">ExamCraft</h1>
          </div>
          <Button 
            onClick={() => window.location.href = '/login'}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            AI-Powered Exam Platform with Advanced Proctoring
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Create comprehensive exams with AI question generation, real-time proctoring, and intelligent grading. 
            Supports multiple question types including video responses with Arabic transcription.
          </p>
          <Button 
            size="lg"
            onClick={() => window.location.href = '/login'}
            className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3"
          >
            Get Started
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader>
              <BookOpen className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle>AI Question Generation</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Generate questions automatically using OpenAI GPT-4o for multiple subjects and difficulty levels.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="h-8 w-8 text-green-600 mb-2" />
              <CardTitle>Advanced Proctoring</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Real-time video monitoring, screen recording, and AI-powered violation detection for secure exams.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-8 w-8 text-purple-600 mb-2" />
              <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Role-based access control for admins, teacher supervisors, teachers, and students.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="h-8 w-8 text-orange-600 mb-2" />
              <CardTitle>Smart Grading</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Automated grading with AI evaluation for essays, coding challenges, and video responses.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <div className="text-center bg-blue-600 rounded-lg p-8">
          <h3 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Exams?
          </h3>
          <p className="text-blue-100 mb-6 text-lg">
            Join thousands of educators using ExamCraft for secure, intelligent assessment.
          </p>
          <Button 
            size="lg"
            variant="secondary"
            onClick={() => window.location.href = '/login'}
            className="bg-white text-blue-600 hover:bg-gray-100"
          >
            Start Creating Exams
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-16 border-t">
        <div className="text-center text-gray-600">
          <p>&copy; 2025 ExamCraft. Powered by AI for the future of assessment.</p>
        </div>
      </footer>
    </div>
  );
}