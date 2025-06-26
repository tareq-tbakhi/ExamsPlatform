# ExamCraft - AI-Powered Exam Creation Platform with Advanced Proctoring

## Overview

ExamCraft is a comprehensive web application for creating, managing, and taking exams with AI-powered question generation and advanced proctoring capabilities. The platform features:

- **AI Question Generation**: OpenAI GPT-4o integration for automatic question creation
- **Comprehensive Proctoring**: Real-time video recording, screen monitoring, face detection, and browser lockdown
- **Arabic Voice Transcription**: Advanced speech-to-text for Arabic language video responses
- **Security Violations**: Automated detection and reporting of cheating attempts
- **Multi-modal Exam Types**: Traditional questions plus video responses with voice transcription

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript and Vite for development tooling
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: Radix UI primitives with shadcn/ui design system
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state management
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **API Design**: RESTful API with JSON responses
- **AI Integration**: OpenAI GPT-4o for question generation

### Development Environment
- **Platform**: Replit with Node.js 20 and PostgreSQL 16 modules
- **Build Tool**: Vite for frontend bundling, esbuild for backend compilation
- **Hot Reload**: Vite HMR for development with middleware mode

## Key Components

### Database Schema
The application uses eight main entities:
- **Users**: Basic user management with username/password authentication
- **Exams**: Exam metadata including title, subject, duration, settings, and proctoring configuration
- **Questions**: Individual questions with support for multiple choice, short answer, essay, and true/false types
- **Submissions**: Student responses, scoring data, and proctoring violation records
- **ProctoringViolations**: Security violation tracking with timestamps, evidence, and severity levels
- **VideoQuestions**: Video-based questions with Arabic speech transcription support
- **VideoAnswers**: Student video responses with automated transcription and confidence scoring

### Frontend Components
- **ExamPlatform**: Main dashboard with tabbed interface for creating, managing, and viewing results
- **ExamCreator**: Form-based exam creation with AI question generation and proctoring configuration
- **StudentExam**: Exam-taking interface with timer, navigation, submission handling, and integrated proctoring
- **QuestionForms**: Dynamic question creation forms supporting multiple question types
- **AIGenerator**: Interface for AI-powered question generation
- **ProctoringManager**: Real-time monitoring system with video recording, screen capture, and face detection
- **ProctoringSetup**: Permission setup and system compatibility checking for secure exam environment
- **VideoQuestion**: Arabic voice transcription interface for video-based responses
- **ProctoringSettings**: Configuration panel for exam creators to enable and customize proctoring features

### Backend Services
- **Storage Layer**: PostgreSQL database with Drizzle ORM using DatabaseStorage implementation
- **OpenAI Service**: Question generation using GPT-4o with structured prompts
- **RESTful API**: Complete CRUD operations for exams, questions, submissions, and proctoring data
- **Proctoring API**: Video upload endpoints, violation tracking, and security monitoring
- **Video Processing**: Video answer upload and storage with transcription support

## Data Flow

1. **Exam Creation**: Educators create exams through the ExamCreator component, optionally using AI to generate questions
2. **Question Management**: Questions are created manually or via AI, with support for multiple question types
3. **Exam Taking**: Students access exams via direct links, complete questions with timer functionality
4. **Submission Processing**: Answers are submitted and scored, with results stored for review
5. **Results Analysis**: Educators can view submission statistics and individual responses

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Neon PostgreSQL database connection
- **drizzle-orm**: Type-safe database ORM with PostgreSQL dialect
- **openai**: Official OpenAI API client for question generation
- **@tanstack/react-query**: Server state management and caching
- **react-hook-form**: Form state management with validation

### UI Libraries
- **@radix-ui/***: Accessible UI primitive components
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library
- **wouter**: Lightweight React router

### Development Tools
- **vite**: Frontend build tool and development server
- **typescript**: Type safety and development experience
- **zod**: Runtime type validation and schema definition

## Deployment Strategy

### Replit Deployment
- **Target**: Autoscale deployment on Replit infrastructure
- **Build Process**: Frontend builds to `dist/public`, backend compiles with esbuild
- **Port Configuration**: Application runs on port 5000, exposed as port 80
- **Environment**: Production mode uses compiled JavaScript, development uses tsx

### Database Configuration
- **Provider**: Neon Database (serverless PostgreSQL)
- **Connection**: Environment variable `DATABASE_URL` required
- **Migrations**: Drizzle Kit for schema migrations to `./migrations`
- **Schema Location**: Shared schema definitions in `./shared/schema.ts`

### Build Commands
- **Development**: `npm run dev` - Runs backend with tsx and frontend with Vite
- **Production Build**: `npm run build` - Compiles both frontend and backend
- **Production Start**: `npm run start` - Runs compiled application
- **Database**: `npm run db:push` - Pushes schema changes to database

## Proctoring Features

### AI-Powered Monitoring System
- **Continuous Video Recording**: 40-second chunks with automatic upload and storage
- **Screen Recording**: Full desktop capture with tab switching detection
- **Face Detection**: Real-time monitoring using computer vision for identity verification
- **Browser Lockdown**: Prevents copy/paste, developer tools, right-click, and other cheating attempts
- **Violation Detection**: Automated classification of security violations (Critical, Major, Minor)

### Video Questions with Arabic Transcription
- **Voice-to-Text**: Real-time Arabic speech recognition and transcription
- **Video Recording**: High-quality video capture for oral responses
- **Confidence Scoring**: Transcription accuracy measurement
- **Multi-language Support**: Optimized for Arabic language with fallback support

### Security Violation Categories
- **Critical**: No face detected, multiple faces, identity mismatch, camera access denied
- **Major**: Tab switching, copy/paste attempts, developer tools access, window focus loss
- **Minor**: Right-click attempts, brief face loss, keyboard shortcuts, text selection

## AI-Powered Analysis Features

### Gemini AI Integration
- **Violation Analysis**: Real-time AI analysis of proctoring violations using Gemini computer vision
- **Video Recording Analysis**: Comprehensive AI review of exam recordings for suspicious behavior
- **Arabic Audio Transcription**: Advanced speech-to-text with confidence scoring for video responses
- **Automated Report Generation**: AI-generated violation reports with severity assessment and recommendations
- **Smart Evidence Capture**: Automatic screenshot capture during violations for AI analysis

### Analysis Dashboard
- **Multi-tab Interface**: Violations, video analysis, timeline, and AI reports in one view
- **Confidence Scoring**: AI confidence levels for all detections and analyses
- **Real-time Monitoring**: Automatic analysis triggers for critical violations
- **Timeline Visualization**: Chronological view of all detected activities during exam

## Changelog

```
Changelog:
- June 26, 2025. Initial setup with in-memory storage
- June 26, 2025. Added PostgreSQL database integration with Drizzle ORM
- June 26, 2025. Fixed exam-taking page routing and query issues
- June 26, 2025. Successfully tested AI question generation with Arabic content
- June 26, 2025. Implemented comprehensive AI proctoring system with:
  * Real-time video and screen recording
  * Face detection and identity verification
  * Browser lockdown and violation detection
  * Arabic voice transcription for video questions
  * Advanced security monitoring and reporting
- June 26, 2025. Added Gemini AI analysis integration with:
  * Automated violation image analysis with confidence scoring
  * Comprehensive video recording analysis and suspicious behavior detection
  * AI-generated violation reports with severity assessment
  * Real-time analysis dashboard with timeline visualization
  * Enhanced proctoring manager with automatic AI analysis triggers
- June 26, 2025. Enhanced screen recording analysis to 100% functionality with:
  * Complete database storage for all analysis results (8 violations per submission)
  * Enhanced AI prompts for comprehensive violation detection
  * Proper categorization (camera_monitoring vs screen_activity)
  * Full evidence chains with confidence scoring and recommendations
  * Alternative analysis method for reliable screen recording processing
- June 26, 2025. Implemented complete 3-phase proctoring system:
  * PHASE 1: Offline upload queue, adaptive quality control, network recovery system
  * PHASE 2: Multi-monitor detection, application switching alerts, enhanced audio monitoring
  * PHASE 3: Complete browser lockdown, forced fullscreen, kiosk mode, advanced security blocking
  * Real-time status monitoring for all phases with comprehensive violation tracking
  * Enterprise-level exam security with automated AI analysis and database storage
- June 26, 2025. Enhanced AI analysis with comprehensive behavioral and audio analysis:
  * Advanced emotion detection: stress, anxiety, frustration, confidence levels (0-100 scale)
  * Movement analysis: suspicious movements, posture compliance, head patterns, eye gaze direction
  * Micro-expression detection: identifying involuntary facial expressions indicating deception
  * Multi-speaker detection: identifying multiple voices during exam sessions
  * Background voice detection: conversations and external coaching attempts
  * Whispering detection: low-volume communication monitoring
  * Voice pattern matching: consistency analysis throughout exam duration
  * Audio anomaly detection: unusual sounds and technology usage indicators
  * Ambient noise analysis: comprehensive environment assessment
  * Enhanced dashboard UI: behavioral and audio analysis sections with visual indicators
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```