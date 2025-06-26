import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  Camera, 
  Monitor, 
  Eye, 
  Mic,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2
} from "lucide-react";

interface ProctoringSettingsProps {
  settings: any;
  onSettingsChange: (settings: any) => void;
}

export default function ProctoringSettings({ settings, onSettingsChange }: ProctoringSettingsProps) {
  const [proctoringConfig, setProctoringConfig] = useState({
    proctoringEnabled: settings?.proctoringEnabled || false,
    videoRecording: settings?.videoRecording !== false,
    screenRecording: settings?.screenRecording !== false,
    faceDetection: settings?.faceDetection !== false,
    browserLockdown: settings?.browserLockdown !== false,
    audioTranscription: settings?.audioTranscription || false,
    violationThresholds: {
      critical: settings?.violationThresholds?.critical || 3,
      major: settings?.violationThresholds?.major || 5,
      minor: settings?.violationThresholds?.minor || 10
    },
    videoQuestions: settings?.videoQuestions || [],
    ...settings
  });

  const [newVideoQuestion, setNewVideoQuestion] = useState({
    question: "",
    maxDuration: 60,
    points: 10
  });

  const handleSettingChange = (key: string, value: any) => {
    const newConfig = { ...proctoringConfig, [key]: value };
    setProctoringConfig(newConfig);
    onSettingsChange(newConfig);
  };

  const handleThresholdChange = (type: string, value: number) => {
    const newThresholds = {
      ...proctoringConfig.violationThresholds,
      [type]: value
    };
    handleSettingChange('violationThresholds', newThresholds);
  };

  const addVideoQuestion = () => {
    if (!newVideoQuestion.question.trim()) return;
    
    const videoQuestion = {
      ...newVideoQuestion,
      id: Date.now(),
      order: proctoringConfig.videoQuestions.length + 1
    };
    
    const updatedQuestions = [...proctoringConfig.videoQuestions, videoQuestion];
    handleSettingChange('videoQuestions', updatedQuestions);
    
    setNewVideoQuestion({
      question: "",
      maxDuration: 60,
      points: 10
    });
  };

  const removeVideoQuestion = (index: number) => {
    const updatedQuestions = proctoringConfig.videoQuestions.filter((_: any, i: number) => i !== index);
    handleSettingChange('videoQuestions', updatedQuestions);
  };

  return (
    <div className="space-y-6">
      {/* Main Proctoring Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>AI Proctoring System</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="proctoring-enabled" className="text-base font-medium">
                Enable AI Proctoring
              </Label>
              <p className="text-sm text-gray-600">
                Activate comprehensive monitoring with video, screen recording, and face detection
              </p>
            </div>
            <Switch
              id="proctoring-enabled"
              checked={proctoringConfig.proctoringEnabled}
              onCheckedChange={(checked) => handleSettingChange('proctoringEnabled', checked)}
            />
          </div>

          {proctoringConfig.proctoringEnabled && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Students will be required to grant camera, microphone, and screen sharing permissions before starting the exam.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Monitoring Features */}
      {proctoringConfig.proctoringEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Monitoring Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Camera className="h-5 w-5 text-blue-600" />
                  <div>
                    <Label className="font-medium">Video Recording</Label>
                    <p className="text-sm text-gray-600">40-second chunks, auto-upload</p>
                  </div>
                </div>
                <Switch
                  checked={proctoringConfig.videoRecording}
                  onCheckedChange={(checked) => handleSettingChange('videoRecording', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Monitor className="h-5 w-5 text-blue-600" />
                  <div>
                    <Label className="font-medium">Screen Recording</Label>
                    <p className="text-sm text-gray-600">Full desktop capture</p>
                  </div>
                </div>
                <Switch
                  checked={proctoringConfig.screenRecording}
                  onCheckedChange={(checked) => handleSettingChange('screenRecording', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Eye className="h-5 w-5 text-blue-600" />
                  <div>
                    <Label className="font-medium">Face Detection</Label>
                    <p className="text-sm text-gray-600">AI-powered monitoring</p>
                  </div>
                </div>
                <Switch
                  checked={proctoringConfig.faceDetection}
                  onCheckedChange={(checked) => handleSettingChange('faceDetection', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <div>
                    <Label className="font-medium">Browser Lockdown</Label>
                    <p className="text-sm text-gray-600">Prevent cheating attempts</p>
                  </div>
                </div>
                <Switch
                  checked={proctoringConfig.browserLockdown}
                  onCheckedChange={(checked) => handleSettingChange('browserLockdown', checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Violation Thresholds */}
      {proctoringConfig.proctoringEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Violation Thresholds</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="critical-threshold">Critical Violations</Label>
                <Input
                  id="critical-threshold"
                  type="number"
                  min="1"
                  max="10"
                  value={proctoringConfig.violationThresholds.critical}
                  onChange={(e) => handleThresholdChange('critical', parseInt(e.target.value))}
                />
                <p className="text-xs text-gray-600 mt-1">Auto-submit exam</p>
              </div>
              
              <div>
                <Label htmlFor="major-threshold">Major Violations</Label>
                <Input
                  id="major-threshold"
                  type="number"
                  min="1"
                  max="20"
                  value={proctoringConfig.violationThresholds.major}
                  onChange={(e) => handleThresholdChange('major', parseInt(e.target.value))}
                />
                <p className="text-xs text-gray-600 mt-1">Warning threshold</p>
              </div>
              
              <div>
                <Label htmlFor="minor-threshold">Minor Violations</Label>
                <Input
                  id="minor-threshold"
                  type="number"
                  min="1"
                  max="50"
                  value={proctoringConfig.violationThresholds.minor}
                  onChange={(e) => handleThresholdChange('minor', parseInt(e.target.value))}
                />
                <p className="text-xs text-gray-600 mt-1">Logged only</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video Questions with Arabic Transcription */}
      {proctoringConfig.proctoringEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mic className="h-5 w-5" />
              <span>Video Questions (Arabic Voice Transcription)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Label className="text-base font-medium">Arabic Speech Transcription</Label>
                <p className="text-sm text-gray-600">
                  Enable voice-to-text transcription for Arabic language video responses
                </p>
              </div>
              <Switch
                checked={proctoringConfig.audioTranscription}
                onCheckedChange={(checked) => handleSettingChange('audioTranscription', checked)}
              />
            </div>

            {/* Add New Video Question */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <h4 className="font-medium mb-3">Add Video Question</h4>
              <div className="space-y-3">
                <Textarea
                  placeholder="Enter your question (Arabic supported)"
                  value={newVideoQuestion.question}
                  onChange={(e) => setNewVideoQuestion(prev => ({ ...prev, question: e.target.value }))}
                  className="min-h-[80px]"
                />
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Max Duration (seconds)</Label>
                    <Input
                      type="number"
                      min="30"
                      max="300"
                      value={newVideoQuestion.maxDuration}
                      onChange={(e) => setNewVideoQuestion(prev => ({ ...prev, maxDuration: parseInt(e.target.value) }))}
                    />
                  </div>
                  
                  <div>
                    <Label>Points</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={newVideoQuestion.points}
                      onChange={(e) => setNewVideoQuestion(prev => ({ ...prev, points: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>
                
                <Button onClick={addVideoQuestion} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Video Question
                </Button>
              </div>
            </div>

            {/* Existing Video Questions */}
            {proctoringConfig.videoQuestions.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Video Questions ({proctoringConfig.videoQuestions.length})</h4>
                {proctoringConfig.videoQuestions.map((question: any, index: number) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">{question.question}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-2">
                          <span>Duration: {question.maxDuration}s</span>
                          <span>Points: {question.points}</span>
                          <Badge variant="outline">Arabic Transcription</Badge>
                        </div>
                      </div>
                      <Button
                        onClick={() => removeVideoQuestion(index)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Security Summary */}
      {proctoringConfig.proctoringEnabled && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-800">Proctoring Configuration Summary</h4>
                <ul className="text-sm text-green-700 mt-2 space-y-1">
                  <li>• Continuous video and screen recording active</li>
                  <li>• Real-time face detection and identity verification</li>
                  <li>• Browser lockdown prevents cheating attempts</li>
                  <li>• Arabic speech transcription for video questions</li>
                  <li>• Automatic violation detection and reporting</li>
                  <li>• {proctoringConfig.videoQuestions.length} video questions configured</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}