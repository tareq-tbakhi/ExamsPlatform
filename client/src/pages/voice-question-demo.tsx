import { useState } from "react";
import AudioQuestion from "@/components/proctoring/audio-question";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function VoiceQuestionDemo() {
  const [savedAnswer, setSavedAnswer] = useState<{
    transcript?: string;
    audioUrl?: string;
  }>({});

  const handleAnswerSave = (transcript: string, audioUrl?: string) => {
    setSavedAnswer({ transcript, audioUrl });
    console.log("Answer saved:", { transcript, audioUrl });
  };

  const sampleQuestions = [
    {
      id: 1,
      text: "ما هي أبرز التحديات التي تواجه الفكر الإسلامي المعاصر في ظل العولمة؟",
      translation: "What are the main challenges facing contemporary Islamic thought in the context of globalization?"
    },
    {
      id: 2,
      text: "اشرح دور التكنولوجيا في تطوير التعليم الحديث",
      translation: "Explain the role of technology in developing modern education"
    },
    {
      id: 3,
      text: "ناقش أهمية الحفاظ على البيئة في عصرنا الحالي",
      translation: "Discuss the importance of environmental conservation in our current era"
    }
  ];

  const [currentQuestion, setCurrentQuestion] = useState(0);

  if (window.location.pathname !== "/voice-demo") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Demo Controls */}
      <div className="p-4 bg-white border-b">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Voice Question Demo</h1>
          
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm font-medium">Select Question:</span>
            {sampleQuestions.map((q, idx) => (
              <Button
                key={q.id}
                variant={currentQuestion === idx ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setCurrentQuestion(idx);
                  setSavedAnswer({});
                }}
              >
                Q{idx + 1}
              </Button>
            ))}
          </div>

          <Card className="p-4 bg-blue-50">
            <p className="text-sm text-gray-600 mb-1">Current Question (Arabic):</p>
            <p className="font-medium text-lg mb-2" dir="rtl">
              {sampleQuestions[currentQuestion].text}
            </p>
            <p className="text-sm text-gray-600 mb-1">Translation:</p>
            <p className="text-sm italic">
              {sampleQuestions[currentQuestion].translation}
            </p>
          </Card>
        </div>
      </div>

      {/* Voice Question Component */}
      <div className="flex-1">
        <AudioQuestion
          key={`question-${currentQuestion}`}
          questionId={sampleQuestions[currentQuestion].id}
          questionText={sampleQuestions[currentQuestion].text}
          questionNumber={currentQuestion + 1}
          duration={180}
          sessionId="demo-session-123"
          onAnswerSave={handleAnswerSave}
          savedAnswer={savedAnswer}
        />
      </div>

      {/* Saved Answer Display */}
      {savedAnswer.transcript && (
        <div className="fixed bottom-4 right-4 max-w-md">
          <Card className="p-4 shadow-lg">
            <h3 className="font-medium mb-2">Saved Answer:</h3>
            <p className="text-sm" dir="auto">{savedAnswer.transcript}</p>
            {savedAnswer.audioUrl && (
              <p className="text-xs text-gray-500 mt-2">
                Audio saved: {savedAnswer.audioUrl}
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
} 