import { useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIAssistantSidebar } from "./ai-assistant-sidebar";

export function AIAssistantTrigger() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsSidebarOpen(true)}
        className="fixed bottom-6 right-6 shadow-lg z-40 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Zap className="h-4 w-4 mr-2" />
        AI Assistant
      </Button>

      <AIAssistantSidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
    </>
  );
}