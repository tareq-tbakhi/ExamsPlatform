import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Camera, 
  Monitor, 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Eye,
  Volume2
} from "lucide-react";

interface ProctoringSetupProps {
  onSetupComplete: () => void;
  examTitle: string;
}

interface PermissionStatus {
  camera: 'granted' | 'denied' | 'prompt' | 'unknown';
  microphone: 'granted' | 'denied' | 'prompt' | 'unknown';
  screen: 'granted' | 'denied' | 'prompt' | 'unknown';
  fullscreen: 'granted' | 'denied' | 'prompt' | 'unknown';
}

export default function ProctoringSetup({ onSetupComplete, examTitle }: ProctoringSetupProps) {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    camera: 'unknown',
    microphone: 'unknown',
    screen: 'unknown',
    fullscreen: 'unknown'
  });
  const [isChecking, setIsChecking] = useState(false);
  const [systemCheck, setSystemCheck] = useState({
    browserSupported: false,
    mediaDevicesSupported: false,
    speechRecognitionSupported: false,
    screenShareSupported: false
  });

  useEffect(() => {
    checkSystemCompatibility();
    checkPermissions();
  }, []);

  const checkSystemCompatibility = () => {
    const checks = {
      browserSupported: !!navigator.mediaDevices,
      mediaDevicesSupported: !!navigator.mediaDevices?.getUserMedia,
      speechRecognitionSupported: !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition,
      screenShareSupported: !!navigator.mediaDevices?.getDisplayMedia
    };
    
    setSystemCheck(checks);
  };

  const checkPermissions = async () => {
    try {
      // Try to check permissions, but handle cases where this fails
      try {
        const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        const microphonePermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        
        setPermissions(prev => ({
          ...prev,
          camera: cameraPermission.state,
          microphone: microphonePermission.state
        }));
      } catch (permissionError) {
        // Some browsers don't support permissions API
        console.log('Permissions API not supported, will request during setup');
        setPermissions(prev => ({
          ...prev,
          camera: 'prompt',
          microphone: 'prompt'
        }));
      }

      // Screen share and fullscreen permissions are handled differently
      setPermissions(prev => ({
        ...prev,
        screen: 'prompt', // Always prompt for screen share
        fullscreen: 'prompt' // Always prompt for fullscreen
      }));
    } catch (error) {
      console.error('Permission check failed:', error);
      // Set default states if check fails
      setPermissions({
        camera: 'prompt',
        microphone: 'prompt',
        screen: 'prompt',
        fullscreen: 'prompt'
      });
    }
  };

  const requestCameraPermission = async () => {
    setIsChecking(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
      
      setPermissions(prev => ({
        ...prev,
        camera: 'granted',
        microphone: 'granted'
      }));
    } catch (error) {
      console.error('Camera/microphone permission denied:', error);
      setPermissions(prev => ({
        ...prev,
        camera: 'denied',
        microphone: 'denied'
      }));
    } finally {
      setIsChecking(false);
    }
  };

  const requestScreenPermission = async () => {
    setIsChecking(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true,
        audio: true 
      });
      
      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
      
      setPermissions(prev => ({
        ...prev,
        screen: 'granted'
      }));
    } catch (error) {
      setPermissions(prev => ({
        ...prev,
        screen: 'denied'
      }));
    } finally {
      setIsChecking(false);
    }
  };

  const requestFullscreenPermission = async () => {
    setIsChecking(true);
    try {
      await document.documentElement.requestFullscreen();
      
      // Exit fullscreen immediately after getting permission
      await document.exitFullscreen();
      
      setPermissions(prev => ({
        ...prev,
        fullscreen: 'granted'
      }));
    } catch (error) {
      console.error('Fullscreen permission denied:', error);
      setPermissions(prev => ({
        ...prev,
        fullscreen: 'denied'
      }));
    } finally {
      setIsChecking(false);
    }
  };

  const allPermissionsGranted = () => {
    return permissions.camera === 'granted' && 
           permissions.microphone === 'granted' && 
           permissions.screen === 'granted' &&
           permissions.fullscreen === 'granted';
  };

  const getPermissionIcon = (status: string) => {
    switch (status) {
      case 'granted':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'denied':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <Eye className="h-5 w-5 text-gray-400" />;
    }
  };

  const getPermissionColor = (status: string) => {
    switch (status) {
      case 'granted':
        return 'bg-green-100 border-green-300';
      case 'denied':
        return 'bg-red-100 border-red-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Proctored Exam Setup</h1>
          <p className="text-lg text-gray-600">{examTitle}</p>
          <Badge variant="destructive" className="mt-2">
            AI MONITORED EXAM
          </Badge>
        </div>

        {/* System Compatibility Check */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>System Compatibility</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`p-3 rounded-lg border ${systemCheck.browserSupported ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'}`}>
                <div className="flex items-center space-x-2">
                  {systemCheck.browserSupported ? 
                    <CheckCircle className="h-4 w-4 text-green-600" /> : 
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  }
                  <span className="text-sm font-medium">Browser</span>
                </div>
              </div>
              
              <div className={`p-3 rounded-lg border ${systemCheck.mediaDevicesSupported ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'}`}>
                <div className="flex items-center space-x-2">
                  {systemCheck.mediaDevicesSupported ? 
                    <CheckCircle className="h-4 w-4 text-green-600" /> : 
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  }
                  <span className="text-sm font-medium">Media Devices</span>
                </div>
              </div>
              
              <div className={`p-3 rounded-lg border ${systemCheck.speechRecognitionSupported ? 'bg-green-100 border-green-300' : 'bg-yellow-100 border-yellow-300'}`}>
                <div className="flex items-center space-x-2">
                  {systemCheck.speechRecognitionSupported ? 
                    <CheckCircle className="h-4 w-4 text-green-600" /> : 
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  }
                  <span className="text-sm font-medium">Speech Recognition</span>
                </div>
              </div>
              
              <div className={`p-3 rounded-lg border ${systemCheck.screenShareSupported ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'}`}>
                <div className="flex items-center space-x-2">
                  {systemCheck.screenShareSupported ? 
                    <CheckCircle className="h-4 w-4 text-green-600" /> : 
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  }
                  <span className="text-sm font-medium">Screen Share</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Permission Setup */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Required Permissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Camera and Microphone */}
            <div className={`p-4 rounded-lg border ${getPermissionColor(permissions.camera)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Camera className="h-6 w-6" />
                  <div>
                    <h4 className="font-medium">Camera & Microphone Access</h4>
                    <p className="text-sm text-gray-600">Required for video recording and face detection</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getPermissionIcon(permissions.camera)}
                  {permissions.camera !== 'granted' && (
                    <Button 
                      onClick={requestCameraPermission} 
                      disabled={isChecking}
                      size="sm"
                    >
                      Grant Access
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Screen Share */}
            <div className={`p-4 rounded-lg border ${getPermissionColor(permissions.screen)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Monitor className="h-6 w-6" />
                  <div>
                    <h4 className="font-medium">Screen Sharing</h4>
                    <p className="text-sm text-gray-600">Required for screen recording and tab switching detection</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getPermissionIcon(permissions.screen)}
                  {permissions.screen !== 'granted' && (
                    <Button 
                      onClick={requestScreenPermission} 
                      disabled={isChecking}
                      size="sm"
                    >
                      Grant Access
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Proctoring Rules */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-red-600">Proctoring Rules & Violations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This exam is AI-monitored. Any violations will be recorded and may result in exam termination.
                </AlertDescription>
              </Alert>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <h4 className="font-medium text-red-800 mb-2">Critical Violations</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    <li>• No face detected</li>
                    <li>• Multiple people detected</li>
                    <li>• Identity mismatch</li>
                    <li>• Camera access denied</li>
                  </ul>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <h4 className="font-medium text-orange-800 mb-2">Major Violations</h4>
                  <ul className="text-sm text-orange-700 space-y-1">
                    <li>• Tab switching</li>
                    <li>• Copy/paste attempts</li>
                    <li>• Developer tools access</li>
                    <li>• Window focus loss</li>
                  </ul>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <h4 className="font-medium text-yellow-800 mb-2">Minor Violations</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Right-click attempts</li>
                    <li>• Brief face loss</li>
                    <li>• Keyboard shortcuts</li>
                    <li>• Text selection</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Proctoring Features */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Active Monitoring Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Camera className="h-5 w-5 text-blue-600 mt-1" />
                  <div>
                    <h4 className="font-medium">Continuous Video Recording</h4>
                    <p className="text-sm text-gray-600">40-second chunks with automatic upload</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <Monitor className="h-5 w-5 text-blue-600 mt-1" />
                  <div>
                    <h4 className="font-medium">Screen Recording</h4>
                    <p className="text-sm text-gray-600">Full desktop capture with tab switching detection</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Eye className="h-5 w-5 text-blue-600 mt-1" />
                  <div>
                    <h4 className="font-medium">AI Face Detection</h4>
                    <p className="text-sm text-gray-600">Real-time monitoring for identity verification</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-1" />
                  <div>
                    <h4 className="font-medium">Browser Lockdown</h4>
                    <p className="text-sm text-gray-600">Prevents cheating attempts and unauthorized actions</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Setup Complete Button */}
        <div className="text-center space-y-4">
          <Button 
            onClick={onSetupComplete}
            disabled={!allPermissionsGranted()}
            size="lg"
            className="min-w-[200px]"
          >
            {allPermissionsGranted() ? 
              "Start Proctored Exam" : 
              "Grant All Permissions to Continue"
            }
          </Button>
          
          {!allPermissionsGranted() && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                All permissions must be granted to proceed with the exam
              </p>
              
              <Alert className="max-w-md mx-auto">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-left">
                  <strong>Having permission issues?</strong><br/>
                  1. Click the camera/shield icon in your browser's address bar<br/>
                  2. Allow camera, microphone, and screen sharing<br/>
                  3. Refresh the page if needed
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={onSetupComplete}
                variant="outline"
                size="sm"
                className="text-orange-600 border-orange-300 hover:bg-orange-50"
              >
                Skip Permissions for Testing
              </Button>
              <p className="text-xs text-orange-600">
                ⚠️ Testing mode - some proctoring features may not work
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}