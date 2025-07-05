import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle, FileText, Video, Mic, Monitor, Brain, Clock, Volume2, Signal } from "lucide-react";

interface ComprehensiveAnalysisReportProps {
  submissionId: number;
  studentName: string;
  examTitle: string;
}

export default function ComprehensiveAnalysisReport({ 
  submissionId, 
  studentName, 
  examTitle 
}: ComprehensiveAnalysisReportProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const { data: analysisData, isLoading } = useQuery({
    queryKey: [`/api/analyze/comprehensive/${submissionId}`],
    enabled: open,
  });

  const getRiskBadge = (risk: number) => {
    if (risk > 80) {
      return <Badge className="bg-red-100 text-red-800">{t('proctoring.high_risk')}</Badge>;
    } else if (risk > 60) {
      return <Badge className="bg-orange-100 text-orange-800">{t('proctoring.moderate_risk')}</Badge>;
    } else if (risk > 30) {
      return <Badge className="bg-yellow-100 text-yellow-800">{t('proctoring.low_risk')}</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800">{t('proctoring.minimal_risk')}</Badge>;
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence > 90) {
      return <Badge className="bg-green-100 text-green-800">High Confidence</Badge>;
    } else if (confidence > 70) {
      return <Badge className="bg-yellow-100 text-yellow-800">Medium Confidence</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800">Low Confidence</Badge>;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-1">
          <FileText className="h-4 w-4" />
          <span className="hidden lg:inline">{t('ai.comprehensive_report')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {t('ai.comprehensive_analysis_report')}
          </DialogTitle>
          <DialogDescription>
            {t('ai.detailed_analysis_for')} {studentName} - {examTitle}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">{t('common.loading')}</span>
          </div>
        ) : analysisData ? (
          <div className="space-y-6">
            {/* Overall Risk Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  {t('ai.overall_risk_assessment')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold">{analysisData.overallRisk || 0}%</div>
                    {getRiskBadge(analysisData.overallRisk || 0)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {t('ai.analysis_timestamp')}: {new Date(analysisData.timestamp).toLocaleString()}
                  </div>
                </div>
                
                {analysisData.recommendations && analysisData.recommendations.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">{t('ai.recommendations')}:</h4>
                    <ul className="space-y-1">
                      {analysisData.recommendations.map((rec: string, index: number) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="screen" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="screen" className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  {t('ai.screen_analysis')}
                </TabsTrigger>
                <TabsTrigger value="video" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  {t('ai.video_answers')}
                </TabsTrigger>
                <TabsTrigger value="audio" className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  {t('ai.audio_answers')}
                </TabsTrigger>
                <TabsTrigger value="proctoring" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t('ai.proctoring')}
                </TabsTrigger>
              </TabsList>

              {/* Screen Analysis Tab */}
              <TabsContent value="screen" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('ai.screen_recording_analysis')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analysisData.screenAnalysis ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="text-sm font-medium">{t('ai.suspicion_level')}:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold">{analysisData.screenAnalysis.suspicionLevel}%</span>
                              {getRiskBadge(analysisData.screenAnalysis.suspicionLevel)}
                            </div>
                          </div>
                        </div>
                        
                        {analysisData.screenAnalysis.summary && (
                          <div>
                            <h4 className="font-medium mb-2">{t('ai.summary')}:</h4>
                            <p className="text-sm text-gray-700">{analysisData.screenAnalysis.summary}</p>
                          </div>
                        )}

                        {analysisData.screenAnalysis.violations && analysisData.screenAnalysis.violations.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">{t('ai.violations_detected')}:</h4>
                            <div className="space-y-2">
                              {analysisData.screenAnalysis.violations.map((violation: any, index: number) => (
                                <div key={index} className="p-3 border rounded-lg">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant={violation.severity === 'critical' ? 'destructive' : 'secondary'}>
                                      {violation.severity}
                                    </Badge>
                                    <span className="text-sm font-medium">{violation.description}</span>
                                  </div>
                                  {violation.recommendations && (
                                    <p className="text-xs text-gray-600">{violation.recommendations}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500">{t('ai.no_screen_analysis')}</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Video Answers Tab */}
              <TabsContent value="video" className="space-y-4">
                {analysisData.videoAnswers && analysisData.videoAnswers.length > 0 ? (
                  analysisData.videoAnswers.map((videoAnswer: any, index: number) => (
                    <Card key={index}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {t('exam.question')} {index + 1}: {videoAnswer.questionText}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium">{t('ai.ai_score')}:</span>
                            <div className="text-lg">{videoAnswer.aiScore}/{videoAnswer.maxScore}</div>
                          </div>
                          <div>
                            <span className="font-medium">{t('ai.confidence')}:</span>
                            <div className="flex items-center gap-1">
                              <span>{Math.round((videoAnswer.confidence || 0) * 100)}%</span>
                              {getConfidenceBadge(Math.round((videoAnswer.confidence || 0) * 100))}
                            </div>
                          </div>
                          <div>
                            <span className="font-medium">{t('ai.duration')}:</span>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {formatDuration(videoAnswer.duration || 0)}
                            </div>
                          </div>
                          <div>
                            <span className="font-medium">{t('ai.word_count')}:</span>
                            <div>{videoAnswer.transcription ? videoAnswer.transcription.split(' ').length : 0} words</div>
                          </div>
                        </div>

                        <div>
                          <h5 className="font-medium mb-2">{t('ai.transcription')}:</h5>
                          <div className="p-3 bg-gray-50 rounded-lg text-sm" dir="rtl">
                            "{videoAnswer.transcription || 'No transcription available'}"
                          </div>
                        </div>

                        {videoAnswer.quality && (
                          <div>
                            <h5 className="font-medium mb-2">{t('ai.quality_assessment')}:</h5>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Signal className="h-4 w-4" />
                                <span>{t('ai.clarity')}: {videoAnswer.quality.clarity || 'N/A'}%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Volume2 className="h-4 w-4" />
                                <span>{t('ai.volume')}: {videoAnswer.quality.volume || 'N/A'}%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                <span>{t('ai.noise')}: {videoAnswer.quality.backgroundNoise || 'N/A'}%</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {videoAnswer.grading && (
                          <div>
                            <h5 className="font-medium mb-2">{t('ai.grading_feedback')}:</h5>
                            <p className="text-sm text-gray-700">{videoAnswer.grading.feedback}</p>
                            
                            <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                              <div>
                                <span className="font-medium">{t('ai.relevance')}:</span> {videoAnswer.grading.relevance}%
                              </div>
                              <div>
                                <span className="font-medium">{t('ai.completeness')}:</span> {videoAnswer.grading.completeness}%
                              </div>
                              <div>
                                <span className="font-medium">{t('ai.clarity')}:</span> {videoAnswer.grading.clarity}%
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-gray-500">
                      {t('ai.no_video_answers')}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Audio Answers Tab */}
              <TabsContent value="audio" className="space-y-4">
                {analysisData.audioAnswers && analysisData.audioAnswers.length > 0 ? (
                  analysisData.audioAnswers.map((audioAnswer: any, index: number) => (
                    <Card key={index}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {t('exam.question')} {index + 1}: {audioAnswer.questionText}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium">{t('ai.ai_score')}:</span>
                            <div className="text-lg">{audioAnswer.aiScore}/{audioAnswer.maxScore}</div>
                          </div>
                          <div>
                            <span className="font-medium">{t('ai.confidence')}:</span>
                            <div className="flex items-center gap-1">
                              <span>{audioAnswer.transcription.confidence}%</span>
                              {getConfidenceBadge(audioAnswer.transcription.confidence)}
                            </div>
                          </div>
                          <div>
                            <span className="font-medium">{t('ai.duration')}:</span>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {formatDuration(audioAnswer.transcription.duration)}
                            </div>
                          </div>
                          <div>
                            <span className="font-medium">{t('ai.sentiment')}:</span>
                            <div>{audioAnswer.transcription.sentiment?.score > 0 ? 'Positive' : 'Neutral'}</div>
                          </div>
                        </div>

                        <div>
                          <h5 className="font-medium mb-2">{t('ai.transcription')}:</h5>
                          <div className="p-3 bg-gray-50 rounded-lg text-sm">
                            "{audioAnswer.transcription.text}"
                          </div>
                        </div>

                        {audioAnswer.transcription.keywords && audioAnswer.transcription.keywords.length > 0 && (
                          <div>
                            <h5 className="font-medium mb-2">{t('ai.keywords')}:</h5>
                            <div className="flex flex-wrap gap-1">
                              {audioAnswer.transcription.keywords.map((keyword: string, idx: number) => (
                                <Badge key={idx} variant="outline">{keyword}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {audioAnswer.grading && (
                          <div>
                            <h5 className="font-medium mb-2">{t('ai.grading_feedback')}:</h5>
                            <p className="text-sm text-gray-700">{audioAnswer.grading.feedback}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-gray-500">
                      {t('ai.no_audio_answers')}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Proctoring Tab */}
              <TabsContent value="proctoring" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('ai.proctoring_analysis')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analysisData.proctoringAnalysis ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="text-sm font-medium">{t('ai.overall_suspicion')}:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold">{analysisData.proctoringAnalysis.overallSuspicion}%</span>
                              {getRiskBadge(analysisData.proctoringAnalysis.overallSuspicion)}
                            </div>
                          </div>
                        </div>

                        {analysisData.proctoringAnalysis.summary && (
                          <div>
                            <h4 className="font-medium mb-2">{t('ai.summary')}:</h4>
                            <p className="text-sm text-gray-700">{analysisData.proctoringAnalysis.summary}</p>
                          </div>
                        )}

                        {analysisData.proctoringAnalysis.violations && analysisData.proctoringAnalysis.violations.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">{t('ai.violations_detected')}:</h4>
                            <div className="space-y-2">
                              {analysisData.proctoringAnalysis.violations.map((violation: any, index: number) => (
                                <div key={index} className="p-3 border rounded-lg">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant={violation.severity === 'critical' ? 'destructive' : 'secondary'}>
                                      {violation.severity}
                                    </Badge>
                                    <span className="text-sm font-medium">{violation.type}</span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(violation.timestamp).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600">{violation.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500">{t('ai.no_proctoring_analysis')}</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            {t('ai.no_analysis_data')}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}