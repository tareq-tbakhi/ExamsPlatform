# Voice Question Implementation Guide

## Overview
The voice question system has been implemented to work like Google Gemini Live Audio demo, providing an immersive audio-focused experience for exam questions.

## Implementation Status ✅

### 1. Core Voice Question Component
- **File**: `client/src/components/proctoring/audio-question.tsx`
- **Features**:
  - Minimal black UI with 3D audio visualization
  - Automatic text-to-speech for questions in Arabic
  - Real-time speech recognition for student answers
  - Audio recording and upload functionality
  - Per-question transcript management

### 2. 3D Audio Visualization
- **File**: `client/src/components/proctoring/audio-visual-3d.tsx`
- **Features**:
  - Red waveform for input audio (student speaking)
  - Blue waveform for output audio (question playback)
  - WebGL-based 3D rendering with shaders

### 3. Voice Configuration
- **Files**: 
  - `client/src/lib/google-tts.ts` - Google Cloud TTS integration
  - `client/src/lib/gemini-tts.ts` - Gemini TTS fallback
- **Voice Options**:
  - Arabic voices: Samira, Majed (premium)
  - Google/Microsoft Arabic voices (fallback)
  - Voice rate: 0.85 for clarity

### 4. Integration Points

#### ✅ Completed:
1. **Student Exam Interface** (`student-exam.tsx`)
   - Audio questions display properly
   - Voice recording works
   - Transcripts are saved

2. **Question Forms** (`question-forms.tsx`)
   - "Audio Response" option available
   - Proper form validation

3. **Exam Creator** (`exam-creator.tsx`)
   - Updated to display audio questions correctly
   - Shows appropriate labels and icons

4. **Demo Page** (`voice-question-demo.tsx`)
   - Three sample Arabic questions
   - Full working demonstration

#### 🔄 In Progress:
1. **Automatic Grading**
   - Transcription is captured
   - Grading logic needs implementation

2. **Voice Quality Settings**
   - Basic voice selection exists
   - Advanced settings UI needed

## How to Use

### 1. Access Voice Demo
```
http://127.0.0.1:5001/voice-demo
```

### 2. Create Exam with Voice Questions
1. Go to Admin Dashboard
2. Click "Create Exam"
3. Add questions
4. Select "Audio Response" as question type
5. Enter question text (preferably in Arabic)
6. Set points and duration

### 3. Student Experience
1. Students access exam via shared link
2. For audio questions:
   - They hear the question spoken aloud
   - No text is displayed
   - They click "Start Recording" to answer
   - Their response is transcribed in real-time
   - Audio is saved to server

## Technical Details

### Audio Processing
```typescript
// Audio encoding for upload
const audioBlob = new Blob(chunks, { type: 'audio/webm' });
const formData = new FormData();
formData.append('audio', audioBlob, `answer_${Date.now()}.webm`);
```

### Voice Selection
```typescript
const arabicVoices = voices.filter(v => v.lang.startsWith('ar'));
const premiumVoices = arabicVoices.filter(v => 
  v.name.includes('Samira') || 
  v.name.includes('Majed') ||
  v.name.includes('Google') ||
  v.name.includes('Microsoft')
);
```

### Transcript Management
```typescript
// Each question maintains its own transcript
const [transcript, setTranscript] = useState('');
// Reset on question change
useEffect(() => {
  setTranscript('');
}, [questionId]);
```

## API Endpoints

### Audio Upload
```
POST /api/upload-audio
Content-Type: multipart/form-data
Body: FormData with 'audio' field
```

### Question Creation
```json
{
  "type": "audio_response",
  "question": "السؤال بالعربية",
  "points": 20,
  "timeLimit": 180,
  "metadata": {
    "audioLanguage": "ar",
    "voiceType": "FEMALE_STANDARD"
  }
}
```

## Future Enhancements

1. **AI-Powered Grading**
   - Use Gemini API to analyze audio responses
   - Compare with expected answers
   - Provide feedback

2. **Multi-Language Support**
   - Extend beyond Arabic
   - Auto-detect language
   - Multiple voice options per language

3. **Accessibility Features**
   - Visual indicators for deaf students
   - Alternative input methods
   - Keyboard shortcuts

4. **Advanced Settings**
   - Voice speed control
   - Pitch adjustment
   - Background noise filtering

## Troubleshooting

### Issue: Voices not loading
```javascript
// Wait for voices to load
window.speechSynthesis.onvoiceschanged = () => {
  const voices = window.speechSynthesis.getVoices();
  // Process voices
};
```

### Issue: Audio not uploading
- Check server middleware for file uploads
- Ensure `express-fileupload` is configured
- Verify upload directory permissions

### Issue: Arabic text not speaking
- Ensure Arabic voices are available
- Check browser compatibility
- Try fallback to Google TTS

## Browser Compatibility
- **Best**: Chrome, Edge (latest versions)
- **Good**: Safari (with limitations)
- **Limited**: Firefox (no speech recognition)

## Testing Checklist
- [ ] Create exam with audio questions
- [ ] Take exam as student
- [ ] Verify audio playback
- [ ] Test voice recording
- [ ] Check transcript accuracy
- [ ] Verify audio file upload
- [ ] Test grading workflow 