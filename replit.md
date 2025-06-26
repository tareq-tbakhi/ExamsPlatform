# ExamCraft - AI-Powered Exam Creation Platform

## Overview

ExamCraft is a modern web application for creating, managing, and taking exams with AI-powered question generation capabilities. The platform allows educators to create comprehensive exams with multiple question types and provides students with an intuitive exam-taking experience.

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
The application uses four main entities:
- **Users**: Basic user management with username/password authentication
- **Exams**: Exam metadata including title, subject, duration, and settings
- **Questions**: Individual questions with support for multiple choice, short answer, essay, and true/false types
- **Submissions**: Student responses and scoring data

### Frontend Components
- **ExamPlatform**: Main dashboard with tabbed interface for creating, managing, and viewing results
- **ExamCreator**: Form-based exam creation with AI question generation
- **StudentExam**: Exam-taking interface with timer, navigation, and submission handling
- **QuestionForms**: Dynamic question creation forms supporting multiple question types
- **AIGenerator**: Interface for AI-powered question generation

### Backend Services
- **Storage Layer**: PostgreSQL database with Drizzle ORM using DatabaseStorage implementation
- **OpenAI Service**: Question generation using GPT-4o with structured prompts
- **RESTful API**: Complete CRUD operations for exams, questions, and submissions

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

## Changelog

```
Changelog:
- June 26, 2025. Initial setup with in-memory storage
- June 26, 2025. Added PostgreSQL database integration with Drizzle ORM
- June 26, 2025. Fixed exam-taking page routing and query issues
- June 26, 2025. Successfully tested AI question generation with Arabic content
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```