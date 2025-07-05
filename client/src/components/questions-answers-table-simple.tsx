import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Play, Volume2, FileText, Eye, Brain, Zap, AlertTriangle, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Question {
  id: number;
  question: string;
  type: string;
  points: number;
  options?: string[];
  correctAnswer?: string;
  order: number;
}

interface Answer {
  questionId: number;
  type: string;
  answer?: string;
  videoUrl?: string;
  audioUrl?: string;
  transcription?: string;
  confidence?: number;
}

interface QuestionsAnswersTableSimpleProps {
  submissionId: number;
  examId: number;
  studentName: string;
  examTitle: string;
}

export default function QuestionsAnswersTableSimple({
  submissionId,
  examId,
  studentName,
  examTitle
}: QuestionsAnswersTableSimpleProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [analysisLoading, setAnalysisLoading] = useState<Set<number>>(new Set());
  const [selectedMedia, setSelectedMedia] = useState<{ type: 'video' | 'audio', url: string } | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Map<number, any>>(new Map());

  // Get exam questions
  const { data: questions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: [`/api/exams/${examId}/questions`],
  });

  // Get submission details with answers
  const { data: submission, isLoading: submissionLoading } = useQuery({
    queryKey: [`/api/submissions/${submissionId}/details`],
  });

  // Get video answers
  const { data: videoAnswers = [] } = useQuery({
    queryKey: [`/api/submissions/${submissionId}/video-answers`],
  });

  // Parse answers from submission
  const getAnswerForQuestion = (questionId: number): Answer | null => {
    if (!submission?.answers) return null;
    
    const answers = typeof submission.answers === 'string' 
      ? JSON.parse(submission.answers) 
      : submission.answers || {};
    
    const answer = answers[questionId];
    if (!answer) return null;

    return {
      questionId,
      type: answer.type || 'text',
      answer: answer.answer || answer.text,
      videoUrl: answer.videoUrl,
      audioUrl: answer.audioUrl,
      transcription: answer.transcription,
      confidence: answer.confidence
    };
  };

  // Individual question analysis mutation
  const questionAnalysisMutation = useMutation({
    mutationFn: async ({ questionId, questionText, answer }: { 
      questionId: number, 
      questionText: string, 
      answer: Answer 
    }) => {
      return await apiRequest("POST", "/api/analyze/question-answer", {
        submissionId,
        questionId,
        questionText,
        answer,
        examTitle,
        studentName
      });
    },
    onSuccess: (result, variables) => {
      setAnalysisResults(prev => new Map(prev).set(variables.questionId, result));
      setAnalysisLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.questionId);
        return newSet;
      });
      
      toast({
        title: t('ai.analysis_complete'),
        description: t('ai.question_analysis_done'),
      });
    },
    onError: (error: any, variables) => {
      setAnalysisLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.questionId);
        return newSet;
      });
      
      toast({
        title: t('common.error'),
        description: t('ai.analysis_failed') + ": " + (error.message || 'Unknown error'),
        variant: "destructive",
      });
    },
  });

  const analyzeQuestionAnswer = (question: Question, answer: Answer) => {
    setAnalysisLoading(prev => new Set(prev).add(question.id));
    questionAnalysisMutation.mutate({
      questionId: question.id,
      questionText: question.question,
      answer
    });
  };

  const getQuestionTypeBadge = (type: string) => {
    const typeColors: Record<string, string> = {
      'multiple_choice': 'bg-blue-100 text-blue-800',
      'true_false': 'bg-green-100 text-green-800',
      'short_answer': 'bg-yellow-100 text-yellow-800',
      'long_answer': 'bg-purple-100 text-purple-800',
      'video_response': 'bg-red-100 text-red-800',
      'audio_response': 'bg-orange-100 text-orange-800',
      'essay': 'bg-gray-100 text-gray-800'
    };

    return (
      <Badge className={typeColors[type] || 'bg-gray-100 text-gray-800'}>
        {t(`exam.question_types.${type}`) || type}
      </Badge>
    );
  };

  const getAnswerContent = (question: Question, answer: Answer | null) => {
    if (!answer) {
      return (
        <div className="text-gray-500 italic p-2">
          {t('exam.no_answer_provided')}
        </div>
      );
    }

    switch (answer.type) {
      case 'video_response':
        return (
          <div className="space-y-3">
            {answer.videoUrl && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMedia({ type: 'video', url: answer.videoUrl! })}
                  className="flex items-center gap-1"
                >
                  <Play className="h-4 w-4" />
                  {t('exam.play_video')}
                </Button>
                <Badge variant="secondary">
                  {answer.confidence ? `${Math.round(answer.confidence * 100)}%` : ''} {t('ai.confidence')}
                </Badge>
              </div>
            )}
            {answer.transcription && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium mb-1">{t('ai.transcription')}:</div>
                <div className="text-sm text-gray-700">"{answer.transcription}"</div>
              </div>
            )}
          </div>
        );

      case 'audio_response':
        return (
          <div className="space-y-3">
            {answer.audioUrl && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMedia({ type: 'audio', url: answer.audioUrl! })}
                  className="flex items-center gap-1"
                >
                  <Volume2 className="h-4 w-4" />
                  {t('exam.play_audio')}
                </Button>
                <Badge variant="secondary">
                  {answer.confidence ? `${Math.round(answer.confidence * 100)}%` : ''} {t('ai.confidence')}
                </Badge>
              </div>
            )}
            {answer.transcription && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium mb-1">{t('ai.transcription')}:</div>
                <div className="text-sm text-gray-700">"{answer.transcription}"</div>
              </div>
            )}
          </div>
        );

      case 'multiple_choice':
        const selectedOption = answer.answer;
        const isCorrect = selectedOption === question.correctAnswer;
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">{t('exam.selected_answer')}:</span>
              <Badge className={isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                {selectedOption}
              </Badge>
              {isCorrect ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
            </div>
            {question.options && (
              <div className="text-sm text-gray-600">
                <div>{t('exam.correct_answer')}: {question.correctAnswer}</div>
                <div className="mt-1">
                  {t('exam.all_options')}: {question.options.join(', ')}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-700">{answer.answer || answer.transcription || t('exam.no_content')}</div>
          </div>
        );
    }
  };

  const getAnalysisButton = (question: Question, answer: Answer | null) => {
    if (!answer) return null;

    const analysis = analysisResults.get(question.id);
    const isLoading = analysisLoading.has(question.id);

    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => analyzeQuestionAnswer(question, answer)}
          disabled={isLoading}
          className="flex items-center gap-1"
        >
          {isLoading ? (
            <>
              <Brain className="h-4 w-4 animate-spin" />
              {t('ai.analyzing')}
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              {t('ai.analyze_answer')}
            </>
          )}
        </Button>

        {analysis && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {t('ai.view_analysis')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{t('ai.question_analysis_results')}</DialogTitle>
                <DialogDescription>
                  {t('exam.question')} {question.order}: {question.question}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {analysis.transcription && (
                  <div>
                    <h4 className="font-medium mb-2">{t('ai.transcription_analysis')}:</h4>
                    <div className="p-3 bg-gray-50 rounded-lg text-sm">
                      <div><strong>{t('ai.confidence')}:</strong> {analysis.transcription.confidence}%</div>
                      <div><strong>{t('ai.word_count')}:</strong> {analysis.transcription.wordCount}</div>
                      <div><strong>{t('ai.transcription')}:</strong> "{analysis.transcription.text}"</div>
                    </div>
                  </div>
                )}
                
                {analysis.grading && (
                  <div>
                    <h4 className="font-medium mb-2">{t('ai.grading_analysis')}:</h4>
                    <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-2">
                      <div className="flex items-center gap-2">
                        <strong>{t('ai.ai_score')}:</strong>
                        <Badge>{analysis.grading.score}/{question.points}</Badge>
                      </div>
                      <div><strong>{t('ai.feedback')}:</strong> {analysis.grading.feedback}</div>
                      <div className="grid grid-cols-3 gap-4">
                        <div><strong>{t('ai.relevance')}:</strong> {analysis.grading.relevance}%</div>
                        <div><strong>{t('ai.completeness')}:</strong> {analysis.grading.completeness}%</div>
                        <div><strong>{t('ai.clarity')}:</strong> {analysis.grading.clarity}%</div>
                      </div>
                    </div>
                  </div>
                )}

                {analysis.violations && analysis.violations.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">{t('ai.violations_detected')}:</h4>
                    <div className="space-y-2">
                      {analysis.violations.map((violation: any, index: number) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <Badge variant={violation.severity === 'critical' ? 'destructive' : 'secondary'}>
                            {violation.severity}
                          </Badge>
                          <div className="mt-1 text-sm">{violation.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  };

  if (questionsLoading || submissionLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('exam.questions_and_answers')} - {studentName}
          </CardTitle>
          <div className="text-sm text-gray-600">
            {examTitle} • {questions.length} {t('exam.questions')} • {t('exam.submission_id')}: {submissionId}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="min-w-[300px]">{t('exam.question')}</TableHead>
                  <TableHead className="w-32">{t('exam.type')}</TableHead>
                  <TableHead className="w-20">{t('exam.points')}</TableHead>
                  <TableHead className="min-w-[300px]">{t('exam.answer')}</TableHead>
                  <TableHead className="w-40">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((question) => {
                  const answer = getAnswerForQuestion(question.id);
                  return (
                    <TableRow key={question.id}>
                      <TableCell className="font-medium">{question.order}</TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="font-medium">{question.question}</div>
                          {question.type === 'multiple_choice' && question.options && (
                            <div className="text-sm text-gray-600">
                              <div className="font-medium mb-1">{t('exam.options')}:</div>
                              <ul className="list-disc list-inside space-y-1">
                                {question.options.map((option, index) => (
                                  <li key={index} className={option === question.correctAnswer ? 'text-green-600 font-medium' : ''}>
                                    {option} {option === question.correctAnswer && '✓'}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getQuestionTypeBadge(question.type)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {question.points}
                      </TableCell>
                      <TableCell>
                        {getAnswerContent(question, answer)}
                      </TableCell>
                      <TableCell>
                        {getAnalysisButton(question, answer)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Media Player Dialog */}
      {selectedMedia && (
        <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedMedia.type === 'video' ? t('exam.video_answer') : t('exam.audio_answer')}
              </DialogTitle>
            </DialogHeader>
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              {selectedMedia.type === 'video' ? (
                <video
                  src={selectedMedia.url}
                  controls
                  className="w-full h-full"
                  autoPlay
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <audio
                    src={selectedMedia.url}
                    controls
                    autoPlay
                    className="w-full max-w-md"
                  />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}