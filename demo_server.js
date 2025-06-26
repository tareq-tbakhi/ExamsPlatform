const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Enhanced AI Analysis endpoint
app.post('/api/analyze/enhanced-analysis', (req, res) => {
  console.log('Enhanced AI Analysis Request:', req.body);
  
  // Simulate comprehensive AI analysis with all requested features
  const enhancedAnalysis = {
    overallSuspicion: Math.floor(Math.random() * 30) + 65,
    violations: [
      {
        severity: 'critical',
        confidence: 0.95,
        description: 'Advanced facial recognition detected multiple identity inconsistencies and suspicious eye movement patterns during critical exam moments.',
        recommendations: [
          'Immediate manual review of identity verification',
          'Cross-reference with enrolled student photos',
          'Investigate eye tracking anomalies'
        ],
        suspiciousActivities: [
          'Identity confidence below threshold',
          'Suspicious gaze patterns detected',
          'Multiple face detection triggered'
        ],
        facialRecognition: {
          identityVerification: {
            faceVisibilityPercentage: Math.floor(Math.random() * 20) + 75,
            identityConfidenceScore: Math.floor(Math.random() * 25) + 70,
            multipleFacesDetected: true,
            photoSpoofingDetected: false,
            consistentIdentity: false
          },
          eyeTracking: {
            gazeDirection: 'off-screen, unauthorized materials detected',
            lookingAwayDuration: Math.floor(Math.random() * 45) + 25,
            screenFocusPercentage: Math.floor(Math.random() * 20) + 65,
            suspiciousGazePatterns: ['Looking at secondary device', 'Reading from notes', 'Frequent off-screen glances'],
            attentionScore: Math.floor(Math.random() * 25) + 60
          }
        },
        behaviorAnalysis: {
          emotionDetection: {
            stress: Math.floor(Math.random() * 30) + 65,
            anxiety: Math.floor(Math.random() * 25) + 60,
            frustration: Math.floor(Math.random() * 20) + 35,
            confidence: Math.floor(Math.random() * 25) + 30
          },
          movementAnalysis: {
            suspiciousMovements: ['Reaching for hidden materials', 'Hand movements toward secondary device', 'Covering camera intermittently'],
            postureCompliance: Math.floor(Math.random() * 20) + 65,
            headMovementPattern: 'Frequent turning away from screen',
            eyeGazeDirection: 'Multiple unauthorized directions'
          },
          microExpressions: {
            detected: true,
            type: ['Deception indicators', 'Stress markers', 'Cognitive overload signs'],
            suspicionLevel: Math.floor(Math.random() * 25) + 55
          }
        },
        audioAnalysis: {
          multipleSpeakers: true,
          backgroundVoices: true,
          whisperingDetected: true,
          voicePatternMatch: Math.floor(Math.random() * 20) + 65,
          audioAnomalies: ['Background conversation', 'Phone notification sounds', 'Keyboard typing from other source'],
          ambientNoise: 'Moderate background activity with suspicious sounds'
        }
      },
      {
        severity: 'major',
        confidence: 0.85,
        description: 'Behavioral analysis detected high stress levels and micro-expressions consistent with deceptive behavior patterns.',
        recommendations: [
          'Review behavioral timeline for stress spikes',
          'Correlate with exam question difficulty',
          'Consider psychological evaluation protocols'
        ],
        suspiciousActivities: [
          'Elevated stress indicators throughout exam',
          'Micro-expressions indicating deception',
          'Inconsistent voice patterns'
        ],
        facialRecognition: {
          identityVerification: {
            faceVisibilityPercentage: Math.floor(Math.random() * 15) + 80,
            identityConfidenceScore: Math.floor(Math.random() * 15) + 80,
            multipleFacesDetected: false,
            photoSpoofingDetected: false,
            consistentIdentity: true
          },
          eyeTracking: {
            gazeDirection: 'screen-focused with periodic deviations',
            lookingAwayDuration: Math.floor(Math.random() * 15) + 15,
            screenFocusPercentage: Math.floor(Math.random() * 15) + 80,
            suspiciousGazePatterns: ['Reading from notes below screen', 'Glancing at secondary monitor'],
            attentionScore: Math.floor(Math.random() * 15) + 75
          }
        },
        behaviorAnalysis: {
          emotionDetection: {
            stress: Math.floor(Math.random() * 20) + 70,
            anxiety: Math.floor(Math.random() * 25) + 55,
            frustration: Math.floor(Math.random() * 20) + 30,
            confidence: Math.floor(Math.random() * 20) + 45
          },
          movementAnalysis: {
            suspiciousMovements: ['Nervous fidgeting', 'Covering mouth while speaking'],
            postureCompliance: Math.floor(Math.random() * 15) + 80,
            headMovementPattern: 'Periodic head turning',
            eyeGazeDirection: 'Generally compliant with deviations'
          },
          microExpressions: {
            detected: true,
            type: ['Stress indicators', 'Brief deception markers'],
            suspicionLevel: Math.floor(Math.random() * 15) + 40
          }
        },
        audioAnalysis: {
          multipleSpeakers: false,
          backgroundVoices: true,
          whisperingDetected: false,
          voicePatternMatch: Math.floor(Math.random() * 10) + 85,
          audioAnomalies: ['Occasional background sounds'],
          ambientNoise: 'Quiet environment with minor disruptions'
        }
      }
    ],
    timeline: [
      {
        timestamp: Date.now() - 300000,
        activity: 'Identity verification initiated - multiple faces detected',
        severity: 'critical'
      },
      {
        timestamp: Date.now() - 240000,
        activity: 'Stress level spike detected - micro-expressions analyzed',
        severity: 'major'
      },
      {
        timestamp: Date.now() - 180000,
        activity: 'Suspicious gaze pattern - looking away for extended period',
        severity: 'major'
      },
      {
        timestamp: Date.now() - 120000,
        activity: 'Audio anomaly detected - background conversation',
        severity: 'critical'
      },
      {
        timestamp: Date.now() - 60000,
        activity: 'Eye tracking shows attention to unauthorized materials',
        severity: 'critical'
      }
    ],
    summary: "Comprehensive analysis reveals multiple security concerns including identity verification issues, suspicious behavioral patterns, elevated stress indicators, and audio anomalies. The combination of facial recognition alerts, eye tracking violations, and behavioral analysis suggests potential academic misconduct requiring immediate review."
  };

  console.log('Sending enhanced analysis response with', enhancedAnalysis.violations.length, 'violations');
  res.json(enhancedAnalysis);
});

// Basic stats endpoint
app.get('/api/stats', (req, res) => {
  res.json({
    totalExams: 2,
    totalSubmissions: 10,
    averageScore: 85.5,
    passRate: 70.0
  });
});

app.listen(6000, () => {
  console.log('Demo server running on port 6000');
  console.log('Enhanced AI Analysis endpoint: POST /api/analyze/enhanced-analysis');
});