import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, Bell, Plus, List, BarChart3, PencilLine } from "lucide-react";
import ExamCreator from "@/components/exam-creator";
import ExamList from "@/components/exam-list";
import ResultsView from "@/components/results-view";

export default function ExamPlatform() {
  const [activeTab, setActiveTab] = useState("create");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <GraduationCap className="text-2xl text-primary" />
                <h1 className="text-xl font-bold text-gray-900">ExamCraft</h1>
              </div>
              <span className="hidden sm:block text-sm text-gray-500">AI-Powered Exam Creation</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5 text-gray-400" />
              </Button>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-medium">
                  JD
                </div>
                <span className="hidden sm:block text-sm font-medium text-gray-700">John Doe</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="create" className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Create Exam</span>
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center space-x-2">
              <List className="h-4 w-4" />
              <span>My Exams</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Results</span>
            </TabsTrigger>
            <TabsTrigger value="student" className="flex items-center space-x-2">
              <PencilLine className="h-4 w-4" />
              <span>Take Exam</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <ExamCreator />
          </TabsContent>

          <TabsContent value="manage">
            <ExamList />
          </TabsContent>

          <TabsContent value="results">
            <ResultsView />
          </TabsContent>

          <TabsContent value="student">
            <Card>
              <CardHeader>
                <CardTitle>Take an Exam</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Enter an exam code or click on a shared exam link to begin taking an exam.
                </p>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>For testing:</strong> Go to "My Exams" tab, create and publish an exam, 
                    then use the share link to take the exam.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
