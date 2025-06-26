import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Shield, X } from "lucide-react";

interface FullscreenHelperProps {
  isVisible: boolean;
  onDismiss?: () => void;
}

export default function FullscreenHelper({ isVisible, onDismiss }: FullscreenHelperProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const checkFullscreen = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', checkFullscreen);
    checkFullscreen();

    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreen);
    };
  }, []);

  const requestFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (error) {
      console.error('Fullscreen request failed:', error);
    }
  };

  if (!isVisible || isFullscreen) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white p-4 shadow-lg">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="h-6 w-6" />
          <div>
            <h3 className="font-semibold">Fullscreen Required for Exam Security</h3>
            <p className="text-sm text-red-100">
              Please enable fullscreen mode to continue with the proctored exam
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button 
            onClick={requestFullscreen}
            variant="outline"
            size="sm"
            className="bg-white text-red-600 border-white hover:bg-red-50"
          >
            Enable Fullscreen
          </Button>
          
          <div className="text-xs text-red-100">
            Or press <kbd className="bg-red-500 px-1 rounded">F11</kbd>
          </div>
          
          {onDismiss && (
            <Button 
              onClick={onDismiss}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-red-500 p-1"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}