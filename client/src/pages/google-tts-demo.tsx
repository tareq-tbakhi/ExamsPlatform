import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Volume2, Loader2 } from 'lucide-react';
import { playGoogleTTS, ARABIC_VOICES, VoiceConfig } from '@/lib/google-tts';

export default function GoogleTTSDemo() {
  const [text, setText] = useState('مرحباً، هذا اختبار لنظام تحويل النص إلى كلام باستخدام Google Cloud. كيف تبدو جودة الصوت؟');
  const [selectedVoice, setSelectedVoice] = useState<keyof typeof ARABIC_VOICES>('MALE_STANDARD');
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState('');
  
  const voiceOptions = Object.entries(ARABIC_VOICES).map(([key, value]) => ({
    key: key as keyof typeof ARABIC_VOICES,
    name: value.name || 'Default',
    gender: value.ssmlGender,
    type: value.name?.includes('Wavenet') ? 'WaveNet (Premium)' : 'Standard'
  }));
  
  const playAudio = async () => {
    setIsPlaying(true);
    setError('');
    
    try {
      const voice = ARABIC_VOICES[selectedVoice];
      await playGoogleTTS(text, voice);
    } catch (err: any) {
      console.error('TTS Error:', err);
      setError(err.message || 'Failed to play audio');
    } finally {
      setIsPlaying(false);
    }
  };
  
  const testBrowserTTS = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      const arabicVoices = voices.filter(v => v.lang.startsWith('ar'));
      console.log('Available browser Arabic voices:', arabicVoices);
      
      if (arabicVoices.length > 0) {
        utterance.voice = arabicVoices[0];
      }
      
      window.speechSynthesis.speak(utterance);
    }
  };
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Google Text-to-Speech Demo</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Arabic Text-to-Speech</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Text to speak:</label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter Arabic text..."
              className="min-h-[100px] text-right"
              dir="rtl"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Voice selection:</label>
            <Select value={selectedVoice} onValueChange={(value) => setSelectedVoice(value as keyof typeof ARABIC_VOICES)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {voiceOptions.map((voice) => (
                  <SelectItem key={voice.key} value={voice.key}>
                    <span className="flex items-center gap-2">
                      <span>{voice.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({voice.gender} - {voice.type})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <div className="flex gap-3">
            <Button 
              onClick={playAudio} 
              disabled={isPlaying || !text.trim()}
              className="gap-2"
            >
              {isPlaying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Playing...
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4" />
                  Play with Google TTS
                </>
              )}
            </Button>
            
            <Button 
              onClick={testBrowserTTS} 
              variant="outline"
              disabled={!text.trim()}
              className="gap-2"
            >
              <Volume2 className="h-4 w-4" />
              Test Browser TTS
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Sample Texts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setText('ما هي عاصمة المملكة الأردنية الهاشمية؟')}
              className="text-right w-full justify-start"
              dir="rtl"
            >
              سؤال: عاصمة الأردن
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setText('اشرح الفرق بين الخلية النباتية والخلية الحيوانية مع ذكر ثلاثة اختلافات رئيسية.')}
              className="text-right w-full justify-start"
              dir="rtl"
            >
              سؤال: الخلية النباتية والحيوانية
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setText('احسب مساحة مثلث قاعدته ١٠ سم وارتفاعه ٨ سم.')}
              className="text-right w-full justify-start"
              dir="rtl"
            >
              سؤال: مساحة المثلث
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setText('مرحباً بك في منصة الامتحانات الإلكترونية. سيتم الآن قراءة السؤال بصوت واضح وطبيعي.')}
              className="text-right w-full justify-start"
              dir="rtl"
            >
              رسالة ترحيب
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">API Key Status:</h3>
        <p className="text-sm">
          {import.meta.env.VITE_GOOGLE_TTS_API_KEY ? 
            '✅ Google TTS API key is configured' : 
            '❌ Google TTS API key is missing. Add VITE_GOOGLE_TTS_API_KEY to your .env file'
          }
        </p>
      </div>
    </div>
  );
} 