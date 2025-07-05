import express, { type Express, type Request, type Response } from "express";
import { Server } from "node:http";
import type { UploadedFile } from "express-fileupload";
import { storage } from "./storage";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { insertExamSchema, insertQuestionSchema, insertSubmissionSchema, insertProctoringViolationSchema, insertVideoQuestionSchema, insertVideoAnswerSchema, submissions } from "@shared/schema";
import { generateQuestions, type GenerateQuestionsRequest } from "./services/openai";
import { analyzeViolationImage, analyzeVideoRecording, generateViolationReport, analyzeArabicAudioTranscription } from "./services/gemini";
import { aiAssistantService } from "./services/ai-assistant";
import { EmailService } from "./services/emailService";
import { transcriptionService } from "./services/transcription";
import { setupAuth, isAuthenticated, requireAdmin, requireSupervisor, requireTeacher, requireSuperAdmin } from "./replitAuth";
import * as fs from "fs";
import * as path from "path";
import Papa from "papaparse";
import * as crypto from "crypto";

interface RequestWithFiles extends Express.Request {
  files?: { [key: string]: UploadedFile | UploadedFile[] };
  body: any;
  is: (type: string) => boolean;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Email test endpoint (no auth required for testing) - must be before auth setup
  app.post('/api/test-email', async (req, res) => {
    try {
      const { recipientEmail, testType } = req.body;
      
      if (!recipientEmail) {
        return res.status(400).json({ success: false, message: "Recipient email is required" });
      }

      let emailSent = false;
      let message = "";

      if (testType === "user_invitation") {
        emailSent = await EmailService.sendUserInvitation({
          recipientEmail: recipientEmail,
          recipientName: 'Test User',
          inviterName: 'ExamCraft Admin',
          role: 'teacher',
          invitationToken: 'test-token-' + Date.now()
        });
        message = emailSent ? `User invitation email sent successfully to ${recipientEmail}` : "Failed to send user invitation email";
      } else if (testType === "exam_invitation") {
        emailSent = await EmailService.sendExamInvitation({
          recipientEmail: recipientEmail,
          studentName: 'Test Student',
          examTitle: 'Email System Test',
          examSubject: 'Testing',
          teacherName: 'ExamCraft Admin',
          examDateTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          duration: 60,
          invitationToken: 'test-exam-token-' + Date.now(),
          examId: 999
        });
        message = emailSent ? `Exam invitation email sent successfully to ${recipientEmail}` : "Failed to send exam invitation email";
      } else {
        return res.status(400).json({ success: false, message: "Invalid test type" });
      }

      res.json({ success: emailSent, message });
    } catch (error) {
      console.error("Email test error:", error);
      
      // Log detailed error information
      if (error && typeof error === 'object' && 'response' in error) {
        const sgError = error as any;
        console.error("SendGrid error details:", {
          code: sgError.code,
          body: sgError.response?.body,
          headers: sgError.response?.headers
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: `Email test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  });

  // Setup Replit Authentication
  await setupAuth(app);

  // Authentication routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      // Check if running locally
      const isLocalDev = process.env.NODE_ENV === 'development' && !process.env.REPLIT_DEPLOYMENT;
      
      if (isLocalDev && req.user?.claims?.sub === "local-dev-user") {
        // Return mock user for local development
        return res.json({
          id: "local-dev-user",
          email: "dev@localhost",
          firstName: "Dev",
          lastName: "User",
          role: "super_admin",
          isActive: true,
          profileImageUrl: ""
        });
      }
      
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Email/password login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // In a production system, you'd verify the password hash here
      // For now, we'll check if the user exists and has a role
      if (!user.role || !user.isActive) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Set session
      (req.session as any).userId = user.id;
      (req.session as any).userEmail = user.email;
      (req.session as any).userRole = user.role;
      
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Failed to create session" });
        }
        res.json({ success: true, user: { id: user.id, email: user.email, role: user.role } });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User management routes (Admin only)
  app.get('/api/admin/users', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch('/api/admin/users/:id/role', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      
      if (!['admin', 'teacher_supervisor', 'teacher', 'student'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      
      const user = await storage.updateUserRole(id, role);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.patch('/api/admin/users/:id/status', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      
      const user = await storage.activateUser(id, isActive);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  // User Invitation Management Routes (Super Admin only)
  app.post('/api/admin/invite-user', isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const { email, firstName, lastName, role } = req.body;
      const user = req.user as any;
      const invitedBy = user.claims.sub;

      // Check if user already has an invitation or account
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const existingInvitation = await storage.getUserInvitationByEmail(email);
      if (existingInvitation) {
        return res.status(400).json({ message: "User already has a pending invitation" });
      }

      // Generate unique invitation token
      const inviteToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invitation = await storage.createUserInvitation({
        email,
        firstName,
        lastName,
        role,
        invitedBy,
        inviteToken,
        inviteStatus: 'pending',
        expiresAt
      });

      // Send invitation email
      const inviterUser = await storage.getUser(invitedBy);
      const inviterName = inviterUser ? `${inviterUser.firstName} ${inviterUser.lastName}`.trim() || inviterUser.email : 'ExamCraft Admin';
      
      const emailSent = await EmailService.sendUserInvitation({
        recipientEmail: email,
        recipientName: firstName ? `${firstName} ${lastName || ''}`.trim() : undefined,
        inviterName,
        role,
        invitationToken: inviteToken
      });

      const inviteUrl = `${req.protocol}://${req.get('host')}/accept-invitation?token=${inviteToken}`;
      
      res.json({ 
        invitation, 
        inviteUrl,
        emailSent,
        message: emailSent ? "User invitation created and email sent successfully" : "User invitation created (email failed to send)"
      });
    } catch (error) {
      console.error("Error creating user invitation:", error);
      res.status(500).json({ message: "Failed to create user invitation" });
    }
  });

  // Create user invitation (simplified endpoint)
  app.post('/api/user-invitations', isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const { email, firstName, lastName, role } = req.body;
      const user = req.user as any;
      const invitedBy = user.claims.sub;

      // Check if user already has an invitation or account
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const existingInvitation = await storage.getUserInvitationByEmail(email);
      if (existingInvitation) {
        return res.status(400).json({ message: "User already has a pending invitation" });
      }

      // Generate unique invitation token
      const inviteToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invitation = await storage.createUserInvitation({
        email,
        firstName,
        lastName,
        role,
        invitedBy,
        inviteToken,
        inviteStatus: 'pending',
        expiresAt
      });

      // Send invitation email
      const inviterUser = await storage.getUser(invitedBy);
      const inviterName = inviterUser ? `${inviterUser.firstName} ${inviterUser.lastName}`.trim() || inviterUser.email : 'ExamCraft Admin';
      
      const emailSent = await EmailService.sendUserInvitation({
        recipientEmail: email,
        recipientName: firstName ? `${firstName} ${lastName || ''}`.trim() : undefined,
        inviterName,
        role,
        invitationToken: inviteToken
      });

      const inviteUrl = `${req.protocol}://${req.get('host')}/accept-invitation?token=${inviteToken}`;
      
      res.json({ 
        invitation, 
        inviteUrl,
        emailSent,
        message: emailSent ? "User invitation created and email sent successfully" : "User invitation created (email failed to send)"
      });
    } catch (error) {
      console.error("Error creating user invitation:", error);
      res.status(500).json({ message: "Failed to create user invitation" });
    }
  });

  // Get user invitations (for both admin paths)
  app.get('/api/user-invitations', isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const invitations = await storage.getUserInvitations();
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching user invitations:", error);
      res.status(500).json({ message: "Failed to fetch user invitations" });
    }
  });

  // Delete user invitation (simplified endpoint)
  app.delete('/api/user-invitations/:id', isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteUserInvitation(parseInt(id));
      
      if (!success) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      
      res.json({ message: "Invitation deleted successfully" });
    } catch (error) {
      console.error("Error deleting user invitation:", error);
      res.status(500).json({ message: "Failed to delete user invitation" });
    }
  });

  // Resend user invitation
  app.post('/api/user-invitations/:id/resend', isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as any;
      const invitedBy = user.claims.sub;
      
      // Get the existing invitation
      const invitation = await storage.getUserInvitationById(parseInt(id));
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      
      if (invitation.inviteStatus !== 'pending') {
        return res.status(400).json({ message: "Cannot resend non-pending invitation" });
      }
      
      // Generate new token and extend expiration
      const newToken = crypto.randomUUID();
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      
      // Update the invitation with new token and expiration
      await storage.updateUserInvitation(parseInt(id), {
        inviteToken: newToken,
        expiresAt: newExpiresAt
      });
      
      // Send invitation email
      const inviterUser = await storage.getUser(invitedBy);
      const inviterName = inviterUser ? `${inviterUser.firstName} ${inviterUser.lastName}`.trim() || inviterUser.email : 'ExamCraft Admin';
      
      console.log('📨 Attempting to resend invitation email:', {
        recipientEmail: invitation.email,
        recipientName: invitation.firstName ? `${invitation.firstName} ${invitation.lastName || ''}`.trim() : undefined,
        inviterName,
        role: invitation.role,
        newToken
      });
      
      const emailSent = await EmailService.sendUserInvitation({
        recipientEmail: invitation.email,
        recipientName: invitation.firstName ? `${invitation.firstName} ${invitation.lastName || ''}`.trim() : undefined,
        inviterName,
        role: invitation.role,
        invitationToken: newToken
      });
      
      console.log('📨 Email send result:', emailSent);
      
      const inviteUrl = `${req.protocol}://${req.get('host')}/accept-invitation?token=${newToken}`;
      
      res.json({ 
        message: emailSent ? "Invitation resent successfully" : "Invitation updated (email failed to send)",
        inviteUrl,
        emailSent,
        newToken
      });
    } catch (error) {
      console.error("Error resending user invitation:", error);
      res.status(500).json({ message: "Failed to resend user invitation" });
    }
  });

  app.get('/api/admin/user-invitations', isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const invitations = await storage.getUserInvitations();
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching user invitations:", error);
      res.status(500).json({ message: "Failed to fetch user invitations" });
    }
  });

  app.delete('/api/admin/user-invitations/:id', isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteUserInvitation(parseInt(id));
      
      if (!success) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      
      res.json({ message: "Invitation deleted successfully" });
    } catch (error) {
      console.error("Error deleting user invitation:", error);
      res.status(500).json({ message: "Failed to delete user invitation" });
    }
  });

  app.get('/api/invite/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getUserInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invalid invitation token" });
      }

      if (invitation.inviteStatus !== 'pending') {
        return res.status(400).json({ message: "Invitation already used" });
      }

      if (new Date() > invitation.expiresAt) {
        return res.status(400).json({ message: "Invitation expired" });
      }

      res.json({ invitation });
    } catch (error) {
      console.error("Error validating invitation:", error);
      res.status(500).json({ message: "Failed to validate invitation" });
    }
  });

  app.post('/api/accept-invitation/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getUserInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invalid invitation token" });
      }

      if (invitation.inviteStatus !== 'pending') {
        return res.status(400).json({ message: "Invitation already used" });
      }

      if (new Date() > invitation.expiresAt) {
        return res.status(400).json({ message: "Invitation expired" });
      }

      // Mark invitation as accepted
      await storage.updateUserInvitationStatus(invitation.id, 'accepted', new Date());

      // Redirect to login to complete account setup via Replit Auth
      res.json({ 
        message: "Invitation accepted. Please log in to complete setup.",
        redirectTo: "/api/login"
      });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Exam Assignment Routes for Team Management
  app.post("/api/exams/:examId/assign", isAuthenticated, requireSupervisor, async (req, res) => {
    try {
      const { examId } = req.params;
      const { assignedTo, canEdit, canViewResults } = req.body;
      const currentUser = req.user as any;
      const assignedBy = currentUser.claims.sub;

      // Verify the exam belongs to the current user
      const exam = await storage.getExam(parseInt(examId));
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      if (exam.createdBy !== assignedBy && currentUser.role !== 'super_admin') {
        return res.status(403).json({ message: "You can only assign your own exams" });
      }

      // Verify the assignee exists
      const assignee = await storage.getUser(assignedTo);
      if (!assignee) {
        return res.status(404).json({ message: "Assignee not found" });
      }

      // Check if assignment already exists
      const existingAssignments = await storage.getExamAssignmentsByExam(parseInt(examId));
      const alreadyAssigned = existingAssignments.find(a => a.assignedTo === assignedTo);
      
      if (alreadyAssigned) {
        return res.status(400).json({ message: "Exam already assigned to this user" });
      }

      const assignment = await storage.createExamAssignment({
        examId: parseInt(examId),
        assignedTo,
        assignedBy,
        canEdit: canEdit || false,
        canViewResults: canViewResults !== false
      });

      res.json(assignment);
    } catch (error) {
      console.error("Error assigning exam:", error);
      res.status(500).json({ message: "Failed to assign exam" });
    }
  });

  app.get("/api/exams/:examId/assignments", isAuthenticated, requireSupervisor, async (req, res) => {
    try {
      const { examId } = req.params;
      const currentUser = req.user as any;

      // Verify the exam belongs to the current user or user is super admin
      const exam = await storage.getExam(parseInt(examId));
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      if (exam.createdBy !== currentUser.claims.sub && currentUser.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const assignments = await storage.getExamAssignmentsByExam(parseInt(examId));
      
      // Get user details for each assignment
      const assignmentsWithUsers = await Promise.all(
        assignments.map(async (assignment) => {
          const user = await storage.getUser(assignment.assignedTo);
          return {
            ...assignment,
            assignedUser: user ? {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role
            } : null
          };
        })
      );

      res.json(assignmentsWithUsers);
    } catch (error) {
      console.error("Error fetching exam assignments:", error);
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  app.delete("/api/exam-assignments/:assignmentId", isAuthenticated, requireSupervisor, async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const currentUser = req.user as any;

      // Get the assignment to verify ownership
      const assignments = await storage.getExamAssignmentsByUser(currentUser.claims.sub);
      const assignment = assignments.find(a => a.id === parseInt(assignmentId));
      
      if (!assignment && currentUser.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const success = await storage.deleteExamAssignment(parseInt(assignmentId));
      
      if (!success) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      res.json({ message: "Assignment removed successfully" });
    } catch (error) {
      console.error("Error removing exam assignment:", error);
      res.status(500).json({ message: "Failed to remove assignment" });
    }
  });

  // Enhanced analysis endpoint
  app.post("/api/analyze/enhanced-analysis", isAuthenticated, async (req, res) => {
    try {
      const { submissionId, examContext } = req.body;
      console.log('Enhanced analysis request:', { submissionId, examContext });
      
      // Fetch all videos for this submission
      const port = process.env.PORT || 5001;
      const videosResponse = await fetch(`http://localhost:${port}/api/videos/submission/${submissionId}`);
      const videos = await videosResponse.json();
      
      if (!videos.proctoringVideos?.length) {
        return res.status(400).json({ message: "No videos found for analysis" });
      }

      console.log(`Found ${videos.proctoringVideos.length} videos for analysis`);
      
      // Analyze both camera and screen videos
      const allViolations = [];
      const allTimeline = [];
      let combinedSuspicion = 0;
      let videoCount = 0;
      
      for (const video of videos.proctoringVideos) {
        try {
          console.log(`Analyzing video: ${video.filename}`);
          const analysis = await analyzeVideoRecording(video.url, `${examContext} - ${video.type} video`);
          
          // Combine results
          allViolations.push(...analysis.violations);
          allTimeline.push(...analysis.timeline);
          combinedSuspicion += analysis.overallSuspicion;
          videoCount++;
          
          console.log(`Analysis completed for ${video.filename}: ${analysis.violations.length} violations`);
        } catch (videoError) {
          console.error(`Error analyzing video ${video.filename}:`, videoError);
          // Continue with other videos
        }
      }
      
      // Create combined analysis result
      const enhancedAnalysis = {
        overallSuspicion: videoCount > 0 ? Math.round(combinedSuspicion / videoCount) : 0,
        violations: allViolations,
        timeline: allTimeline.sort((a, b) => a.timestamp - b.timestamp),
        summary: `Combined analysis of ${videoCount} videos found ${allViolations.length} violations with ${Math.round(combinedSuspicion / videoCount)}% overall suspicion level.`
      };
      
      console.log('Combined AI analysis completed:', enhancedAnalysis);

      // Store AI analysis results in new database tables
      if (submissionId) {
        try {
          // Create main analysis result entry
          const analysisResult = await storage.createAiAnalysisResult({
            submissionId: parseInt(submissionId),
            videoPath: `Combined analysis of ${videoCount} videos`,
            overallSuspicion: Math.round(enhancedAnalysis.overallSuspicion * 100),
            summary: enhancedAnalysis.summary
          });

          // Store violations
          if (enhancedAnalysis.violations.length > 0) {
            const violationsToInsert = enhancedAnalysis.violations.map(violation => ({
              analysisId: analysisResult.id,
              severity: violation.severity || 'minor',
              confidence: Math.round(violation.confidence * 100),
              description: violation.description,
              recommendations: violation.recommendations,
              suspiciousActivities: violation.suspiciousActivities
            }));
            await storage.createAnalysisViolations(violationsToInsert);
          }

          // Store timeline
          if (enhancedAnalysis.timeline.length > 0) {
            const timelineToInsert = enhancedAnalysis.timeline.map(item => ({
              analysisId: analysisResult.id,
              timestamp: item.timestamp,
              activity: item.activity,
              severity: item.severity || 'minor'
            }));
            await storage.createAnalysisTimeline(timelineToInsert);
          }

          console.log(`AI analysis results stored for submission ${submissionId} with ${enhancedAnalysis.violations.length} violations`);
        } catch (dbError) {
          console.error('Database error storing AI analysis results:', dbError);
          // Continue with response even if database fails
        }
      }

      res.json(enhancedAnalysis);
    } catch (error) {
      console.error('Enhanced analysis error:', error);
      res.status(500).json({ message: "Failed to perform enhanced analysis", error: (error as Error).message });
    }
  });

  // Get stored AI analysis results for a submission
  app.get("/api/analyze/results/:submissionId", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      const analysisResults = await storage.getAnalysisResultsBySubmission(submissionId);
      res.json(analysisResults);
    } catch (error) {
      console.error('Failed to fetch AI analysis results:', error);
      res.status(500).json({ message: "Failed to fetch analysis results", error: (error as Error).message });
    }
  });

  // Analyze submission - trigger AI analysis for a submission
  app.post("/api/analyze/submission/:submissionId", isAuthenticated, async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      
      console.log(`Starting AI analysis for submission ${submissionId}`);
      
      // Get submission data
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Get exam data for context
      const exam = await storage.getExam(submission.examId);
      const examContext = `${exam?.title || 'Unknown Exam'} - ${exam?.subject || 'General'}`;

      // Check if analysis already exists (but allow re-analysis for missing transcripts)
      const existingAnalysis = await storage.getAnalysisResultsBySubmission(submissionId);
      console.log(`Found ${existingAnalysis.length} existing analysis results for submission ${submissionId}`);
      
      // Check if there are any responses without transcripts that need analysis
      const answers = (submission.answers as Record<string, any>) || {};
      const needsAnalysis = Object.values(answers).some((answer: any) => 
        answer && typeof answer === 'object' && 
        (answer.type === 'audio_response' || answer.type === 'video_response') &&
        (!answer.transcription || answer.transcription.trim() === '')
      );
      
      if (existingAnalysis.length > 0 && !needsAnalysis) {
        console.log(`Analysis already completed and all responses have transcripts for submission ${submissionId}`);
        return res.json({ 
          success: true, 
          message: "Analysis already completed - all responses have transcripts",
          analysisCount: existingAnalysis.length 
        });
      }
      
      console.log(`Proceeding with analysis - ${needsAnalysis ? 'some responses need transcripts' : 'no existing analysis'}`);

      // Analyze audio responses
      const audioAnalysisPromises = [];
      const videoAnalysisPromises = [];
      
      for (const [questionId, answer] of Object.entries(answers)) {
        if (typeof answer === 'object' && answer !== null) {
          const answerObj = answer as any;
          
          // Handle audio responses
          if (answerObj.type === 'audio_response' && answerObj.audioUrl) {
            const audioPath = path.join(process.cwd(), 'uploads', 'audio', path.basename(answerObj.audioUrl));
            if (fs.existsSync(audioPath)) {
              console.log(`Queuing audio analysis for question ${questionId}`);
              audioAnalysisPromises.push(
                transcriptionService.transcribeAudio(audioPath, 'ar')
                  .then(result => ({
                    questionId,
                    type: 'audio',
                    transcription: result,
                    path: audioPath
                  }))
                  .catch(error => {
                    console.error(`Audio analysis failed for question ${questionId}:`, error);
                    return null;
                  })
              );
            }
          }
          
          // Handle video responses
          if (answerObj.type === 'video_response' && answerObj.videoUrl) {
            const videoPath = path.join(process.cwd(), 'uploads', 'videos', path.basename(answerObj.videoUrl));
            if (fs.existsSync(videoPath)) {
              console.log(`Queuing video analysis for question ${questionId}`);
              videoAnalysisPromises.push(
                transcriptionService.transcribeVideoAudio(videoPath, 'ar')
                  .then(result => ({
                    questionId,
                    type: 'video',
                    transcription: result,
                    path: videoPath
                  }))
                  .catch(error => {
                    console.error(`Video analysis failed for question ${questionId}:`, error);
                    return null;
                  })
              );
            }
          }
        }
      }

      // Process all analyses
      const allAnalyses = await Promise.all([
        ...audioAnalysisPromises,
        ...videoAnalysisPromises
      ]);

      const validAnalyses = allAnalyses.filter(analysis => analysis !== null);
      
      console.log(`Completed ${validAnalyses.length} analyses for submission ${submissionId}`);

      // Store analysis results and update submission answers with transcripts
      const storedResults = [];
      const updatedAnswers = { ...answers };
      
      for (const analysis of validAnalyses) {
        if (analysis) {
          try {
            // Store AI analysis result
            const analysisResult = await storage.createAiAnalysisResult({
              submissionId,
              videoPath: `${analysis.type}_question_${analysis.questionId}`,
              overallSuspicion: analysis.transcription.confidence < 70 ? 30 : 10,
              summary: `${analysis.type} analysis: ${analysis.transcription.wordCount} words, ${analysis.transcription.confidence}% confidence - "${analysis.transcription.text.substring(0, 100)}..."`
            });
            storedResults.push(analysisResult);
            
            // Update the submission answer with the transcript
            const questionId = analysis.questionId;
            if (updatedAnswers[questionId]) {
              updatedAnswers[questionId] = {
                ...updatedAnswers[questionId],
                transcription: analysis.transcription.text,
                confidence: analysis.transcription.confidence,
                aiAnalysis: {
                  wordCount: analysis.transcription.wordCount,
                  duration: analysis.transcription.duration,
                  quality: analysis.transcription.quality,
                  sentiment: analysis.transcription.sentiment,
                  keywords: analysis.transcription.keywords,
                  summary: analysis.transcription.summary
                }
              };
              console.log(`Updated transcript for question ${questionId}: "${analysis.transcription.text.substring(0, 50)}..."`);
            }
          } catch (dbError) {
            console.error(`Failed to store analysis for question ${analysis.questionId}:`, dbError);
          }
        }
      }
      
      // Update the submission with enhanced answers including transcripts
      if (validAnalyses.length > 0) {
        try {
          // Direct database update for submission answers
          await db
            .update(submissions)
            .set({ answers: updatedAnswers })
            .where(eq(submissions.id, submissionId));
          console.log(`Updated submission ${submissionId} with ${validAnalyses.length} transcripts`);
        } catch (updateError) {
          console.error(`Failed to update submission answers:`, updateError);
        }
      }

      // Also analyze proctoring videos if they exist
      try {
        const proctoringPath = path.join(process.cwd(), 'uploads', 'proctoring');
        if (fs.existsSync(proctoringPath)) {
          const proctoringFiles = fs.readdirSync(proctoringPath)
            .filter(file => file.includes(`session_${submissionId}_`) || file.includes(`_${submissionId}_`))
            .slice(0, 3); // Limit to first 3 files to avoid quota issues

          for (const file of proctoringFiles) {
            try {
              const filePath = path.join(proctoringPath, file);
              const analysis = await analyzeVideoRecording(`/api/videos/proctoring/${file}`, examContext);
              
              const analysisResult = await storage.createAiAnalysisResult({
                submissionId,
                videoPath: `/api/videos/proctoring/${file}`,
                overallSuspicion: analysis.overallSuspicion,
                summary: analysis.summary
              });
              
              storedResults.push(analysisResult);
              console.log(`Proctoring analysis completed for ${file}`);
            } catch (error) {
              console.error(`Proctoring analysis failed for ${file}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('Proctoring analysis error:', error);
      }

      res.json({ 
        success: true, 
        message: `Analysis completed for submission ${submissionId}`,
        analysisCount: storedResults.length,
        audioAnalyses: validAnalyses.filter(a => a?.type === 'audio').length,
        videoAnalyses: validAnalyses.filter(a => a?.type === 'video').length
      });

    } catch (error) {
      console.error('Submission analysis error:', error);
      res.status(500).json({ 
        message: "Failed to analyze submission", 
        error: (error as Error).message 
      });
    }
  });

  // Generate AI violation report
  app.post("/api/analyze/generate-report", async (req, res) => {
    try {
      const { submissionId } = req.body;
      
      if (!submissionId) {
        return res.status(400).json({ message: "Submission ID is required" });
      }

      console.log(`Generating AI report for submission ${submissionId}`);

      // Get submission data
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Get exam data
      const exam = await storage.getExam(submission.examId);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      // Get violations for this submission
      const violations = await storage.getViolationsBySubmission(submissionId);
      
      // Get stored AI analysis results
      const analysisResults = await storage.getAnalysisResultsBySubmission(submissionId);
      
      console.log(`Found ${violations.length} violations and ${analysisResults.length} analysis results for submission ${submissionId}`);

      // Check if a report already exists for this submission
      const existingReports = await storage.getAiReportsBySubmission(submissionId);
      if (existingReports.length > 0) {
        console.log(`Returning existing AI report for submission ${submissionId}`);
        return res.json({
          success: true,
          report: existingReports[0].content,
          submissionId,
          violationCount: existingReports[0].violationCount,
          cached: true,
          generatedAt: existingReports[0].generatedAt
        });
      }

      // Prepare exam info for report generation
      const examInfo = {
        title: exam.title,
        duration: exam.duration,
        studentName: submission.studentName,
        submissionId: submissionId,
        submittedAt: submission.submittedAt
      };

      // Combine violations and analysis data
      const allViolationData = [
        ...violations,
        ...analysisResults.map(result => ({
          type: result.overallSuspicion > 80 ? 'critical' : result.overallSuspicion > 50 ? 'major' : 'minor',
          category: 'ai_analysis',
          description: result.summary,
          evidence: { suspicionLevel: result.overallSuspicion }
        }))
      ];

      // Calculate overall suspicion level
      const overallSuspicion = analysisResults.length > 0 
        ? Math.round(analysisResults.reduce((sum, result) => sum + result.overallSuspicion, 0) / analysisResults.length)
        : (violations.length > 0 ? Math.min(violations.length * 20, 100) : 0);

      // Generate the report using Gemini AI
      const { generateViolationReport } = await import("./services/gemini");
      const report = await generateViolationReport(allViolationData, examInfo);
      
      console.log(`Generated AI report for submission ${submissionId} (length: ${report.length} characters)`);

      // Store the generated report in the database
      try {
        const storedReport = await storage.createAiReport({
          submissionId: submissionId,
          reportType: 'violation_report',
          content: report,
          violationCount: allViolationData.length,
          suspicionLevel: overallSuspicion
        });
        
        console.log(`Stored AI report in database with ID: ${storedReport.id}`);
      } catch (dbError) {
        console.error('Failed to store AI report in database:', dbError);
        // Continue with response even if storage fails
      }

      res.json({ 
        success: true, 
        report,
        submissionId,
        violationCount: allViolationData.length,
        suspicionLevel: overallSuspicion,
        cached: false
      });
    } catch (error) {
      console.error('Failed to generate AI report:', error);
      res.status(500).json({ 
        message: "Failed to generate AI report", 
        error: (error as Error).message 
      });
    }
  });

  // Get stored AI reports for a submission
  app.get("/api/reports/:submissionId", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      const reports = await storage.getAiReportsBySubmission(submissionId);
      
      console.log(`Retrieved ${reports.length} stored AI reports for submission ${submissionId}`);
      res.json(reports);
    } catch (error) {
      console.error('Failed to fetch AI reports:', error);
      res.status(500).json({ message: "Failed to fetch AI reports", error: (error as Error).message });
    }
  });

  // Get stored timeline data for a submission
  app.get("/api/timeline/:submissionId", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      
      // Get all analysis results for this submission
      const analysisResults = await storage.getAnalysisResultsBySubmission(submissionId);
      
      // Collect timeline data from all analysis results
      const allTimeline = [];
      for (const analysis of analysisResults) {
        const timeline = await storage.getTimelineByAnalysisId(analysis.id);
        allTimeline.push(...timeline);
      }
      
      // Sort by timestamp
      allTimeline.sort((a, b) => a.timestamp - b.timestamp);
      
      console.log(`Retrieved ${allTimeline.length} timeline events for submission ${submissionId}`);
      res.json(allTimeline);
    } catch (error) {
      console.error('Failed to fetch timeline data:', error);
      res.status(500).json({ message: "Failed to fetch timeline data", error: (error as Error).message });
    }
  });

  // Auto-grade a submission
  app.post("/api/submissions/:submissionId/grade", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      const { gradingService } = await import("./services/grading");
      
      // Get submission and related data
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const questions = await storage.getQuestionsByExam(submission.examId);
      const testCases = await Promise.all(
        questions.map(q => storage.getCodingTestCasesByQuestion(q.id))
      ).then(results => results.flat());

      // Grade the submission
      const gradingResult = await gradingService.gradeSubmission(questions, submission.answers, testCases);

      // Store individual question grades
      for (const questionGrade of gradingResult.questionGrades) {
        await storage.createQuestionGrade({
          submissionId,
          questionId: questionGrade.questionId,
          answer: submission.answers[questionGrade.questionId.toString()],
          score: questionGrade.score,
          maxScore: questionGrade.maxScore,
          isCorrect: questionGrade.isCorrect,
          gradingType: questionGrade.gradingType,
          feedback: questionGrade.feedback,
          gradedBy: "system"
        });
      }

      // Update submission with grading results
      const autoGradedScore = gradingResult.questionGrades
        .filter(g => g.gradingType === "auto" || g.gradingType === "ai")
        .reduce((sum, g) => sum + g.score, 0);

      const manualGradingRequired = gradingResult.questionGrades.some(g => g.gradingType === "manual");

      await storage.updateSubmissionGrading(submissionId, {
        score: gradingResult.totalScore,
        weightedScore: gradingResult.weightedScore,
        passingStatus: gradingResult.passingStatus,
        gradingStatus: gradingResult.gradingStatus,
        autoGradedScore,
        manualGradedScore: manualGradingRequired ? 0 : undefined,
        scoreBreakdown: gradingResult.scoreBreakdown
      });

      console.log(`Graded submission ${submissionId}: ${gradingResult.totalScore}/${gradingResult.totalPossible} points`);
      res.json(gradingResult);
    } catch (error) {
      console.error('Failed to grade submission:', error);
      res.status(500).json({ message: "Failed to grade submission", error: (error as Error).message });
    }
  });

  // Get detailed grading results for a submission
  app.get("/api/submissions/:submissionId/grades", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      const grades = await storage.getQuestionGradesBySubmission(submissionId);
      res.json(grades);
    } catch (error) {
      console.error('Failed to fetch grades:', error);
      res.status(500).json({ message: "Failed to fetch grades", error: (error as Error).message });
    }
  });

  // Get score analytics for an exam
  app.get("/api/exams/:examId/analytics", async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);
      const submissions = await storage.getSubmissionsByExam(examId);
      
      const analytics = {
        totalSubmissions: submissions.length,
        gradedSubmissions: submissions.filter(s => s.gradingStatus === "completed").length,
        averageScore: submissions.length > 0 
          ? submissions.reduce((sum, s) => sum + (s.score || 0), 0) / submissions.length
          : 0,
        passRate: submissions.length > 0
          ? (submissions.filter(s => s.passingStatus === "passed").length / submissions.length) * 100
          : 0,
        scoreDistribution: {
          "90-100": 0,
          "80-89": 0,
          "70-79": 0,
          "60-69": 0,
          "50-59": 0,
          "0-49": 0
        },
        questionTypeBreakdown: {} as Record<string, { averageScore: number; totalQuestions: number }>
      };

      // Calculate score distribution
      submissions.forEach(submission => {
        if (submission.score !== null && submission.totalPoints > 0) {
          const percentage = (submission.score / submission.totalPoints) * 100;
          if (percentage >= 90) analytics.scoreDistribution["90-100"]++;
          else if (percentage >= 80) analytics.scoreDistribution["80-89"]++;
          else if (percentage >= 70) analytics.scoreDistribution["70-79"]++;
          else if (percentage >= 60) analytics.scoreDistribution["60-69"]++;
          else if (percentage >= 50) analytics.scoreDistribution["50-59"]++;
          else analytics.scoreDistribution["0-49"]++;
        }
      });

      res.json(analytics);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      res.status(500).json({ message: "Failed to fetch analytics", error: (error as Error).message });
    }
  });

  // Transcribe audio file
  app.post("/api/transcribe/audio", async (req: RequestWithFiles, res) => {
    try {
      const { transcriptionService } = await import("./services/transcription");
      
      if (!req.files?.audio) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      const audioFile = Array.isArray(req.files.audio) ? req.files.audio[0] : req.files.audio;
      const language = req.body.language || "ar";
      
      // Save uploaded file temporarily
      const uploadPath = `uploads/temp/${Date.now()}_${audioFile.name}`;
      await audioFile.mv(uploadPath);

      // Transcribe the audio
      const result = await transcriptionService.transcribeAudio(uploadPath, language);

      // Clean up temporary file
      try {
        const fs = await import("fs");
        fs.unlinkSync(uploadPath);
      } catch (cleanupError) {
        console.warn("Failed to clean up temporary file:", cleanupError);
      }

      console.log(`Audio transcription completed: ${result.wordCount} words, ${result.confidence}% confidence`);
      res.json(result);
    } catch (error) {
      console.error('Failed to transcribe audio:', error);
      res.status(500).json({ message: "Failed to transcribe audio", error: (error as Error).message });
    }
  });

  // Transcribe video audio
  app.post("/api/transcribe/video", async (req: RequestWithFiles, res) => {
    try {
      const { transcriptionService } = await import("./services/transcription");
      
      if (!req.files?.video) {
        return res.status(400).json({ message: "No video file provided" });
      }

      const videoFile = Array.isArray(req.files.video) ? req.files.video[0] : req.files.video;
      const language = req.body.language || "ar";
      
      // Save uploaded file temporarily
      const uploadDir = `uploads/temp`;
      const fs = await import("fs");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const uploadPath = `${uploadDir}/${Date.now()}_${videoFile.name}`;
      await videoFile.mv(uploadPath);

      // Use OpenAI Whisper directly (bypass rate-limited Gemini)
      console.log(`Transcribing video: ${videoFile.name} (${(videoFile.size / (1024 * 1024)).toFixed(2)}MB)`);

      const openai = await import("openai");
      const client = new openai.default({ 
        apiKey: process.env.OPENAI_API_KEY 
      });

      const audioReadStream = fs.createReadStream(uploadPath);
      
      const transcription = await client.audio.transcriptions.create({
        file: audioReadStream,
        model: "whisper-1",
        language: language === "ar" ? "ar" : "en",
        response_format: "verbose_json"
      });

      // Clean up temporary file
      try {
        fs.unlinkSync(uploadPath);
      } catch (cleanupError) {
        console.warn("Failed to clean up temporary file:", cleanupError);
      }

      const wordCount = transcription.text.trim().split(/\s+/).filter(word => word.length > 0).length;
      const confidence = 0.85; // OpenAI Whisper typical confidence

      console.log(`Video transcription completed: ${wordCount} words, ${Math.round(confidence * 100)}% confidence`);

      res.json({
        transcription: transcription.text,
        confidence: confidence,
        language: transcription.language || language,
        duration: transcription.duration || 0,
        wordCount: wordCount
      });
    } catch (error) {
      console.error('Failed to transcribe video:', error);
      res.status(500).json({ message: "Failed to transcribe video", error: (error as Error).message });
    }
  });

  // Get supported transcription formats
  app.get("/api/transcribe/formats", async (req, res) => {
    try {
      const { transcriptionService } = await import("./services/transcription");
      const formats = transcriptionService.getSupportedFormats();
      res.json(formats);
    } catch (error) {
      console.error('Failed to get supported formats:', error);
      res.status(500).json({ message: "Failed to get supported formats", error: (error as Error).message });
    }
  });

  // Stats endpoint
  app.get("/api/stats", async (req, res) => {
    try {
      const recentSubmissions = await storage.getRecentSubmissions(100);
      const totalSubmissions = recentSubmissions.length;
      const averageScore = totalSubmissions > 0 
        ? recentSubmissions.reduce((sum, sub) => sum + (sub.score || 0), 0) / totalSubmissions 
        : 0;
      const passRate = totalSubmissions > 0 
        ? (recentSubmissions.filter(sub => (sub.score || 0) >= 70).length / totalSubmissions) * 100 
        : 0;

      const uniqueExamIds = new Set(recentSubmissions.map(sub => sub.examId));
      const totalExams = uniqueExamIds.size;

      res.json({
        totalExams,
        totalSubmissions,
        averageScore: parseFloat(averageScore.toFixed(2)),
        passRate: parseFloat(passRate.toFixed(2))
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get stats", error: (error as Error).message });
    }
  });

  // Get violations for a submission
  app.get("/api/violations/:submissionId", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      const violations = await storage.getViolationsBySubmission(submissionId);
      res.json(violations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch violations", error: (error as Error).message });
    }
  });

  // Get videos for a submission
  app.get("/api/videos/submission/:submissionId", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      console.log(`Getting videos for submission ${submissionId}`);
      
      const submission = await storage.getSubmission(submissionId);
      
      if (!submission) {
        console.log(`Submission ${submissionId} not found`);
        return res.status(404).json({ message: "Submission not found" });
      }

      const proctoringDir = path.join(process.cwd(), 'uploads', 'proctoring');
      const videosDir = path.join(process.cwd(), 'uploads', 'videos');

      let proctoringVideos: any[] = [];
      let answerVideos: any[] = [];

      if (fs.existsSync(proctoringDir)) {
        const files = fs.readdirSync(proctoringDir);
        console.log(`Found files in proctoring dir:`, files);
        
        // Try multiple patterns to match videos to submissions
        // Pattern 1: Direct submission ID match (_submissionId_)
        // Pattern 2: Session ID match (videos recorded during exam session)
        // Pattern 3: Exam ID match for submissions from same exam (fallback)
        let filteredFiles = files.filter(file => file.includes(`_${submissionId}_`) && file.endsWith('.webm'));
        
        if (filteredFiles.length === 0 && submission.sessionId) {
          // Try session ID match - videos recorded with session ID during exam
          filteredFiles = files.filter(file => 
            file.includes(`_${submission.sessionId}_`) && file.endsWith('.webm')
          );
          console.log(`Session ID match for ${submission.sessionId}: found ${filteredFiles.length} files:`, filteredFiles);
        }
        
        if (filteredFiles.length === 0) {
          // Enhanced fallback: Try exam ID match plus timestamp-based sorting for most recent videos
          const examFiles = files.filter(file => 
            file.includes(`_${submission.examId}_`) && file.endsWith('.webm')
          );
          
          // Sort by modification time to get most recent videos for this exam
          if (examFiles.length > 0) {
            const fileStats = examFiles.map(filename => {
              try {
                const filePath = path.join(proctoringDir, filename);
                const stats = fs.statSync(filePath);
                return { filename, mtime: stats.mtime.getTime() };
              } catch (error) {
                return { filename, mtime: 0 };
              }
            });
            
            // Sort by modification time (newest first) and take files from around submission time
            fileStats.sort((a, b) => b.mtime - a.mtime);
            const submissionTime = submission.submittedAt ? new Date(submission.submittedAt).getTime() : Date.now();
            
            // Filter videos that were created within 2 hours of submission time
            const timeWindow = 2 * 60 * 60 * 1000; // 2 hours
            filteredFiles = fileStats
              .filter(file => Math.abs(file.mtime - submissionTime) < timeWindow)
              .map(file => file.filename);
              
            console.log(`Exam ID ${submission.examId} + time window match for submission ${submissionId}: ${filteredFiles.length} files out of ${examFiles.length} total exam files`);
          }
        }
        
        console.log(`Filtered files for submission ${submissionId}:`, filteredFiles);
        
        proctoringVideos = filteredFiles.map(filename => {
          try {
            const filePath = path.join(proctoringDir, filename);
            const stats = fs.statSync(filePath);
            
            return {
              filename,
              url: `/api/videos/proctoring/${filename}`,
              type: filename.startsWith('screen_') ? 'screen' : 'proctoring',
              size: stats.size,
              timestamp: stats.mtime.toISOString()
            };
          } catch (error) {
            console.log(`Error processing file ${filename}:`, error);
            return null;
          }
        }).filter(Boolean);
      }

      if (fs.existsSync(videosDir)) {
        const files = fs.readdirSync(videosDir);
        answerVideos = files
          .filter(file => file.includes(`submission_${submissionId}_`) && file.endsWith('.webm'))
          .map(filename => {
            const filePath = path.join(videosDir, filename);
            const stats = fs.statSync(filePath);
            
            return {
              filename,
              url: `/api/videos/answers/${filename}`,
              type: 'answer',
              size: stats.size,
              timestamp: stats.mtime.toISOString()
            };
          });
      }

      res.json({
        proctoringVideos,
        answerVideos,
        totalVideos: proctoringVideos.length + answerVideos.length
      });

    } catch (error) {
      res.status(500).json({ message: "Failed to fetch videos", error: (error as Error).message });
    }
  });

  // Serve video files
  app.get("/api/videos/:type/:filename", (req, res) => {
    const { type, filename } = req.params;
    let filePath: string;

    if (type === 'proctoring') {
      filePath = path.join(process.cwd(), 'uploads', 'proctoring', filename);
    } else if (type === 'answers') {
      filePath = path.join(process.cwd(), 'uploads', 'videos', filename);
    } else {
      return res.status(404).json({ message: "Invalid video type" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Video file not found" });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/webm',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/webm',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  });

  // Serve audio files
  app.get("/uploads/audio/:filename", (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(process.cwd(), 'uploads', 'audio', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Audio file not found" });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/webm',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'audio/webm',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  });

  // Upload proctoring video chunks
  app.post("/api/upload-proctoring-video", async (req: RequestWithFiles, res) => {
    try {
      if (!req.files || !req.files.video) {
        return res.status(400).json({ message: "No video file provided" });
      }

      const videoFile = req.files.video as UploadedFile;
      const { examId, submissionId, sessionId, type } = req.body;
      
      console.log(`Uploading proctoring video: ${videoFile.name}, Type: ${type}, Exam: ${examId}, Submission: ${submissionId}, Session: ${sessionId}`);

      // Create upload directory if it doesn't exist
      const uploadDir = path.join(process.cwd(), 'uploads', 'proctoring');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Generate unique filename
      const filename = videoFile.name || `${type}_${examId}_${submissionId || sessionId}_${Date.now()}.webm`;
      const filePath = path.join(uploadDir, filename);

      // Save the file
      await videoFile.mv(filePath);
      
      console.log(`Proctoring video saved: ${filePath} (${(videoFile.size / 1024 / 1024).toFixed(2)}MB)`);

      res.json({ 
        success: true, 
        filename,
        url: `/api/videos/proctoring/${filename}`,
        size: videoFile.size 
      });
    } catch (error) {
      console.error("Failed to upload proctoring video:", error);
      res.status(500).json({ message: "Failed to upload video", error: (error as Error).message });
    }
  });

  // Upload video answer
  app.post("/api/upload-video-answer", async (req: RequestWithFiles, res) => {
    try {
      if (!req.files || !req.files.video) {
        return res.status(400).json({ message: "No video file provided" });
      }

      const videoFile = req.files.video as UploadedFile;
      const { questionId, transcript, confidence, duration, submissionId, sessionId } = req.body;

      console.log("Video answer upload request:", { 
        questionId, 
        submissionId, 
        sessionId,
        transcript: transcript?.substring(0, 50) + "..." 
      });

      // Create upload directory if it doesn't exist
      const uploadDir = path.join(process.cwd(), 'uploads', 'videos');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Generate unique filename
      const filename = videoFile.name || `answer_${questionId}_${Date.now()}.webm`;
      const filePath = path.join(uploadDir, filename);

      // Save the file
      await videoFile.mv(filePath);

      const videoUrl = `/api/videos/answers/${filename}`;

      // Save video answer to database
      let videoAnswer = null;
      
      // If we have a submission ID, save normally
      if (submissionId && submissionId !== 'null' && submissionId !== 'undefined') {
        try {
          videoAnswer = await storage.createVideoAnswer({
            submissionId: parseInt(submissionId),
            videoQuestionId: parseInt(questionId),
            videoUrl,
            transcript: transcript || null,
            confidence: confidence ? parseInt(confidence) : null,
            duration: duration ? parseInt(duration) : null
          });
          console.log("Video answer saved to database with submission:", videoAnswer.id);
        } catch (dbError) {
          console.error("Failed to save video answer to database:", dbError);
        }
      } else if (sessionId) {
        // If no submission ID yet, store temporarily with session ID
        console.log("Storing video answer temporarily with session ID:", sessionId);
        // For now, just save the file and return the URL
        // The video will be associated with the submission later
      }

      res.json({ 
        success: true, 
        videoUrl,
        filename,
        videoAnswer,
        temporaryStorage: !submissionId
      });
    } catch (error) {
      console.error("Failed to upload video answer:", error);
      res.status(500).json({ message: "Failed to upload video answer", error: (error as Error).message });
    }
  });

  // Create submission
  app.post("/api/submissions", async (req, res) => {
    try {
      console.log("Submissions endpoint hit with data:", req.body);
      console.log("Session ID in submission:", req.body.sessionId);
      
      const submissionData = insertSubmissionSchema.parse(req.body);
      const submission = await storage.createSubmission(submissionData);
      
      console.log("Submission created successfully:", submission);
      console.log("Created submission has session ID:", submission.sessionId);
      
      // Update any video files that were uploaded with this session ID
      if (submission.sessionId) {
        const videoDir = path.join(process.cwd(), 'uploads', 'videos');
        if (fs.existsSync(videoDir)) {
          console.log(`Looking for video answers with session ID: ${submission.sessionId}`);
        }
      }
      
      // Check if there are video answers in the submission data
      const videoAnswers = [];
      if (submission.answers && typeof submission.answers === 'object') {
        const answers = submission.answers as Record<string, any>;
        
        for (const [questionId, answer] of Object.entries(answers)) {
          if (answer && typeof answer === 'object' && 
              (answer.type === 'video_response' || answer.type === 'audio_response')) {
            
            console.log(`Processing ${answer.type} for question ${questionId}:`, answer);
            
            // Check if we need to create a video answer record
            if (answer.videoUrl || answer.transcription) {
              try {
                // First check if a video answer already exists for this question and submission
                const existingVideoAnswers = await storage.getVideoAnswersBySubmission(submission.id);
                const existingAnswer = existingVideoAnswers.find(va => va.videoQuestionId === parseInt(questionId));
                
                if (!existingAnswer) {
                  const videoAnswer = await storage.createVideoAnswer({
                    submissionId: submission.id,
                    videoQuestionId: parseInt(questionId),
                    videoUrl: answer.videoUrl || `/api/videos/answers/answer_${questionId}_placeholder.webm`,
                    transcript: answer.transcription || answer.transcript || null,
                    confidence: answer.confidence ? Math.round(answer.confidence * 100) : 85,
                    duration: answer.duration || null
                  });
                  videoAnswers.push(videoAnswer);
                  console.log(`Created video answer for question ${questionId}:`, videoAnswer.id);
                } else {
                  console.log(`Video answer already exists for question ${questionId}`);
                }
              } catch (err) {
                console.error(`Failed to create video answer for question ${questionId}:`, err);
              }
            }
          }
        }
      }
      
      console.log(`Created ${videoAnswers.length} video answer records for submission ${submission.id}`);
      
      res.json(submission);
    } catch (error) {
      console.error("Failed to create submission:", error);
      res.status(500).json({ message: "Failed to create submission", error: (error as Error).message });
    }
  });

  // Get submission details with videos and analysis
  app.get("/api/submissions/:id/details", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.id);
      
      // Get submission data
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      
      // Get exam details
      const exam = await storage.getExamWithQuestions(submission.examId);
      if (!exam) {
        return res.status(404).json({ error: "Exam not found" });
      }
      
      // Get video answers for video questions
      const videoAnswers = await storage.getVideoAnswersBySubmission(submissionId);
      
      // Get proctoring videos
      let proctoringVideos: any[] = [];
      const proctoringDir = path.join(process.cwd(), 'uploads', 'proctoring');
      
      if (fs.existsSync(proctoringDir)) {
        const files = fs.readdirSync(proctoringDir);
        
        // Try session ID match first
        let filteredFiles = files.filter(file => 
          submission.sessionId && file.includes(submission.sessionId) && file.endsWith('.webm')
        );
        
        // Fallback to exam ID match if no session match
        if (filteredFiles.length === 0) {
          filteredFiles = files.filter(file => 
            file.includes(`_${submission.examId}_`) && file.endsWith('.webm')
          );
        }
        
        proctoringVideos = filteredFiles.map(filename => ({
          filename,
          url: `/api/videos/proctoring/${filename}`,
          type: filename.includes('camera') ? 'camera' : filename.includes('screen') ? 'screen' : 'unknown',
          uploadedAt: fs.statSync(path.join(proctoringDir, filename)).mtime
        }));
      }
      
      // Parse answers from JSON
      let answers = {};
      try {
        answers = typeof submission.answers === 'string' 
          ? JSON.parse(submission.answers) 
          : submission.answers || {};
        console.log(`Submission ${submissionId} answers:`, answers);
        console.log(`Raw submission.answers:`, submission.answers);
      } catch (error) {
        console.error("Error parsing answers:", error);
      }
      
      res.json({
        submission,
        exam,
        answers,
        videoAnswers,
        proctoringVideos
      });
    } catch (error) {
      console.error("Error getting submission details:", error);
      res.status(500).json({ error: "Failed to get submission details" });
    }
  });

  // Get submissions by exam ID
  app.get("/api/submissions/exam/:examId", isAuthenticated, async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);
      const submissions = await storage.getSubmissionsByExam(examId);
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching submissions by exam:", error);
      res.status(500).json({ error: "Failed to get submissions by exam" });
    }
  });

  // Get recent submissions
  app.get("/api/submissions/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const submissions = await storage.getRecentSubmissions(limit);
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent submissions", error: (error as Error).message });
    }
  });

  // Get exams accessible to current user (own exams + assigned exams)
  app.get("/api/exams", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.claims.sub;
      const exams = await storage.getAccessibleExams(userId);
      res.json(exams);
    } catch (error) {
      console.error("Failed to fetch accessible exams:", error);
      res.status(500).json({ message: "Failed to fetch exams" });
    }
  });

  // Get exams by creator
  app.get("/api/exams/creator/:userId", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const currentUser = req.user as any;
      
      // Super admin can see anyone's exams, others can only see their own
      if (currentUser.claims.sub !== userId && currentUser.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const exams = await storage.getExamsByCreator(userId);
      res.json(exams);
    } catch (error) {
      console.error("Failed to fetch exams by creator:", error);
      res.status(500).json({ message: "Failed to fetch exams", error: (error as Error).message });
    }
  });

  // Get single exam with questions by ID
  app.get("/api/exams/:id", async (req, res) => {
    try {
      const examId = parseInt(req.params.id);
      const exam = await storage.getExamWithQuestions(examId);
      
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }
      
      res.json(exam);
    } catch (error) {
      console.error("Failed to fetch exam:", error);
      res.status(500).json({ message: "Failed to fetch exam", error: (error as Error).message });
    }
  });

  // Create exam
  app.post("/api/exams", async (req, res) => {
    try {
      console.log("Creating exam with data:", JSON.stringify(req.body, null, 2));
      const examData = insertExamSchema.parse(req.body);
      console.log("Parsed exam data:", JSON.stringify(examData, null, 2));
      const exam = await storage.createExam(examData);
      console.log("Exam created successfully:", exam);
      res.json(exam);
    } catch (error) {
      console.error("Failed to create exam. Error details:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create exam", error: (error as Error).message });
    }
  });

  // Update exam
  app.put("/api/exams/:id", async (req, res) => {
    try {
      const examId = parseInt(req.params.id);
      console.log(`Updating exam ${examId} with data:`, JSON.stringify(req.body, null, 2));
      const examData = insertExamSchema.partial().parse(req.body);
      const updatedExam = await storage.updateExam(examId, examData);
      
      if (!updatedExam) {
        return res.status(404).json({ message: "Exam not found" });
      }
      
      console.log("Exam updated successfully:", updatedExam);
      res.json(updatedExam);
    } catch (error) {
      console.error("Failed to update exam:", error);
      res.status(500).json({ message: "Failed to update exam", error: (error as Error).message });
    }
  });

  // Patch exam (for status updates like publishing)
  app.patch("/api/exams/:id", async (req, res) => {
    try {
      const examId = parseInt(req.params.id);
      console.log(`Patching exam ${examId} with data:`, JSON.stringify(req.body, null, 2));
      const examData = insertExamSchema.partial().parse(req.body);
      const updatedExam = await storage.updateExam(examId, examData);
      
      if (!updatedExam) {
        return res.status(404).json({ message: "Exam not found" });
      }
      
      console.log("Exam patched successfully:", updatedExam);
      res.json(updatedExam);
    } catch (error) {
      console.error("Failed to patch exam:", error);
      res.status(500).json({ message: "Failed to patch exam", error: (error as Error).message });
    }
  });

  // Upload CSV/Excel file for bulk student invitations
  app.post("/api/exams/:id/upload-students", requireTeacher, async (req: RequestWithFiles, res) => {
    try {
      const examId = parseInt(req.params.id);
      
      // Check if exam exists
      const exam = await storage.getExam(examId);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      // Check if file was uploaded
      if (!req.files || !req.files.csvFile) {
        return res.status(400).json({ message: "No CSV file uploaded" });
      }

      const uploadedFile = req.files.csvFile as UploadedFile;
      
      // Check file type
      const allowedTypes = ['.csv', '.xlsx', '.xls'];
      const fileExt = path.extname(uploadedFile.name).toLowerCase();
      if (!allowedTypes.includes(fileExt)) {
        return res.status(400).json({ message: "Only CSV and Excel files are allowed" });
      }

      // Parse CSV file
      const fileContent = uploadedFile.data.toString('utf8');
      
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const students = results.data as any[];
            console.log(`Processing ${students.length} students for exam ${examId}`);

            // Validate and prepare student data
            const validStudents = [];
            const errors = [];

            for (let i = 0; i < students.length; i++) {
              const student = students[i];
              const row = i + 1;

              // Check for required email field
              const email = student.email || student.Email || student.EMAIL || student['Student Email'] || student['student_email'];
              if (!email || !email.includes('@')) {
                errors.push(`Row ${row}: Invalid or missing email address`);
                continue;
              }

              // Extract other fields with various possible column names
              const name = student.name || student.Name || student.NAME || student['Student Name'] || student['student_name'] || '';
              const regNumber = student.registration || student.Registration || student.REGISTRATION || 
                               student['Registration Number'] || student['registration_number'] || student.id || student.ID || '';

              validStudents.push({
                examId,
                studentEmail: email.trim().toLowerCase(),
                studentName: name.trim() || null,
                registrationNumber: regNumber.toString().trim() || null,
                inviteStatus: 'pending',
                inviteToken: crypto.randomUUID(),
              });
            }

            if (errors.length > 0 && validStudents.length === 0) {
              return res.status(400).json({ 
                message: "No valid students found", 
                errors 
              });
            }

            // Create bulk invitations
            const createdInvitations = await storage.createBulkExamInvitations(validStudents);
            
            console.log(`Successfully created ${createdInvitations.length} invitations for exam ${examId}`);

            // Get exam details for email
            const exam = await storage.getExam(examId);
            if (!exam) {
              return res.status(404).json({ message: "Exam not found" });
            }

            // Get teacher details
            const teacherUser = await storage.getUser(exam.createdBy);
            const teacherName = teacherUser ? `${teacherUser.firstName || ''} ${teacherUser.lastName || ''}`.trim() || teacherUser.email : 'ExamCraft Teacher';

            // Send emails to all students
            let emailsSent = 0;
            const emailPromises = createdInvitations.map(async (invitation) => {
              try {
                const emailSent = await EmailService.sendExamInvitation({
                  recipientEmail: invitation.studentEmail,
                  studentName: invitation.studentName || 'Student',
                  examTitle: exam.title,
                  examSubject: exam.subject || 'General',
                  teacherName,
                  examDateTime: new Date().toISOString(), // Use current date as placeholder
                  duration: exam.duration,
                  invitationToken: invitation.inviteToken || '',
                  examId: examId
                });
                if (emailSent) emailsSent++;
                return emailSent;
              } catch (error: any) {
                console.error(`Failed to send email to ${invitation.studentEmail}:`, error);
                return false;
              }
            });

            await Promise.all(emailPromises);

            res.json({
              message: `Successfully uploaded ${createdInvitations.length} student invitations`,
              totalProcessed: students.length,
              successfulInvitations: createdInvitations.length,
              emailsSent,
              errors,
              invitations: createdInvitations
            });

          } catch (error) {
            console.error('Error processing CSV data:', error);
            res.status(500).json({ message: "Failed to process student data", error: (error as Error).message });
          }
        },
        error: (error) => {
          console.error('CSV parsing error:', error);
          res.status(400).json({ message: "Failed to parse CSV file", error: error.message });
        }
      });

    } catch (error) {
      console.error("Failed to upload students:", error);
      res.status(500).json({ message: "Failed to upload students", error: (error as Error).message });
    }
  });

  // Get student invitations for an exam
  app.get("/api/exams/:id/invitations", requireTeacher, async (req, res) => {
    try {
      const examId = parseInt(req.params.id);
      const invitations = await storage.getExamInvitations(examId);
      res.json(invitations);
    } catch (error) {
      console.error("Failed to fetch invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations", error: (error as Error).message });
    }
  });

  // Student Authentication and Access
  app.post("/api/student/login", async (req, res) => {
    try {
      const { name, email, registrationNumber } = req.body;
      
      if (!name || !email || !registrationNumber) {
        return res.status(400).json({ error: "All fields are required" });
      }

      // Find invitation matching the student details
      const invitation = await storage.getInvitationByStudentDetails(name, email, registrationNumber);
      
      if (!invitation) {
        return res.status(404).json({ error: "No invitation found. Please check your details or contact your instructor." });
      }

      // Update invitation status to accessed if it's the first time
      if (invitation.inviteStatus === "pending") {
        await storage.updateInvitationStatus(invitation.id, "accessed", new Date());
      }

      // Return student session data
      res.json({
        success: true,
        student: {
          id: invitation.id,
          name: invitation.studentName,
          email: invitation.studentEmail,
          registrationNumber: invitation.registrationNumber
        }
      });
    } catch (error) {
      console.error("Student login error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  app.get("/api/student/exams", async (req, res) => {
    try {
      const { email } = req.query;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Get all invitations for this student
      const invitations = await storage.getInvitationsByEmail(email as string);
      
      if (!invitations.length) {
        return res.json([]);
      }

      // Get exam details for each invitation
      const assignedExams = [];
      for (const invitation of invitations) {
        const exam = await storage.getExam(invitation.examId);
        if (exam) {
          const questions = await storage.getQuestionsByExam(exam.id);
          assignedExams.push({
            id: exam.id,
            title: exam.title,
            subject: exam.subject,
            duration: exam.duration,
            questionsCount: questions.length,
            status: exam.status,
            invitationStatus: invitation.inviteStatus,
            accessedAt: invitation.accessedAt,
            completedAt: null, // Not available in current schema
            score: null // Not available in current schema
          });
        }
      }

      res.json(assignedExams);
    } catch (error) {
      console.error("Get student exams error:", error);
      res.status(500).json({ error: "Failed to fetch assigned exams" });
    }
  });

  // Create question
  app.post("/api/questions", async (req, res) => {
    try {
      console.log("Creating question with data:", req.body);
      const questionData = insertQuestionSchema.parse(req.body);
      const question = await storage.createQuestion(questionData);
      console.log("Question created successfully:", question);
      res.json(question);
    } catch (error) {
      console.error("Failed to create question:", error);
      res.status(500).json({ message: "Failed to create question", error: (error as Error).message });
    }
  });

  // Generate questions using AI - DEPRECATED (requires examId which doesn't work for pre-exam generation)
  // This endpoint is replaced by the one below that doesn't require examId
  /*
  app.post("/api/generate-questions", async (req, res) => {
    try {
      console.log("AI Question Generation Request received:", req.body);
      const requestData: GenerateQuestionsRequest = req.body;
      
      // Validate request data
      const schema = z.object({
        topic: z.string().min(1),
        count: z.number().min(1).max(50),
        difficulty: z.enum(['easy', 'medium', 'hard']),
        type: z.enum(['multiple_choice', 'true_false', 'short_answer', 'essay', 'coding', 'video_response', 'audio_response']),
        language: z.string().optional().default('en'),
        examId: z.number()
      });

      const validatedData = schema.parse(requestData);
      
      const questions = await generateQuestions(
        validatedData.topic,
        validatedData.count,
        validatedData.difficulty,
        validatedData.type,
        validatedData.language
      );

      // Save questions to database
      const savedQuestions = [];
      for (const question of questions) {
        const savedQuestion = await storage.createQuestion({
          examId: validatedData.examId,
          type: question.type,
          question: question.question,
          options: question.options || [],
          correctAnswer: question.correctAnswer,
          points: question.points,
          order: savedQuestions.length + 1,
          weight: 1,
          autoGraded: true,
          metadata: question.metadata || {}
        });
        savedQuestions.push(savedQuestion);
      }

      console.log(`Generated and saved ${savedQuestions.length} questions`);
      res.json({ questions: savedQuestions });
    } catch (error) {
      console.error("Failed to generate questions:", error);
      res.status(500).json({ message: "Failed to generate questions", error: (error as Error).message });
    }
  });
  */

  // Validate video/audio answer using OpenAI
  app.post("/api/validate-answer", async (req, res) => {
    try {
      const { questionId, submissionId, transcription, questionType, audioQuality, confidence } = req.body;
      
      // Get the question details
      const question = await storage.getQuestion(questionId);
      if (!question) {
        return res.status(404).json({ success: false, error: "Question not found" });
      }

      // Use OpenAI to validate the answer
      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert exam evaluator. Evaluate the student's ${questionType} response based on the question requirements. 

              Criteria for evaluation:
              - Content accuracy and relevance (40%)
              - Completeness of answer (30%)
              - Clarity and coherence (20%)
              - Language proficiency (10%)

              Provide a score from 0-100 and detailed feedback.
              If the transcription confidence is low (< 0.7), consider partial credit.
              
              Return JSON in this format:
              {
                "score": number,
                "isValid": boolean,
                "feedback": "detailed feedback",
                "contentAnalysis": {
                  "accuracy": number,
                  "completeness": number,
                  "clarity": number,
                  "language": number
                }
              }`
            },
            {
              role: "user",
              content: `Question: ${question.question}
              Expected Answer: ${question.correctAnswer}
              Student's Response: ${transcription}
              Transcription Confidence: ${confidence}
              Question Type: ${questionType}
              Audio Quality: ${JSON.stringify(audioQuality)}`
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      const openaiResult = await openaiResponse.json();
      
      if (!openaiResponse.ok) {
        throw new Error(`OpenAI API error: ${openaiResult.error?.message || "Unknown error"}`);
      }

      const evaluation = JSON.parse(openaiResult.choices[0].message.content);
      
      // Save the video/audio answer to database
      const videoAnswer = await storage.createVideoAnswer({
        submissionId,
        videoQuestionId: questionId, // Map questionId to videoQuestionId
        transcript: transcription,
        confidence,
        videoUrl: null // We'll update this after file upload
      });

      console.log("Answer validated and saved:", videoAnswer);

      res.json({
        success: true,
        score: evaluation.score,
        isValid: evaluation.isValid,
        feedback: evaluation.feedback,
        contentAnalysis: evaluation.contentAnalysis,
        videoAnswerId: videoAnswer.id
      });
    } catch (error) {
      console.error("Failed to validate answer:", error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Generate questions using AI (continued)
  app.post("/api/generate-questions", async (req, res) => {
    try {
      console.log("AI Question Generation Request received:", req.body);
      
      // Validate request data
      const schema = z.object({
        topic: z.string().min(1),
        questionType: z.enum(["multiple_choice", "true_false", "short_answer", "essay", "coding", "video_response", "audio_response"]),
        difficulty: z.enum(["easy", "medium", "hard"]),
        count: z.number().min(1).max(20),
        subject: z.string().optional(),
        language: z.string().optional().default("english")
      });
      
      const validatedData = schema.parse(req.body);
      console.log("Validated request data:", validatedData);
      
      // Generate questions using OpenAI
      console.log("Calling OpenAI service...");
      const questions = await generateQuestions({
        topic: validatedData.topic,
        questionType: validatedData.questionType,
        difficulty: validatedData.difficulty,
        count: validatedData.count,
        subject: validatedData.subject,
        language: validatedData.language
      });
      console.log("Generated questions:", questions);
      
      res.json({ questions });
    } catch (error) {
      console.error("Failed to generate questions:", error);
      res.status(500).json({ 
        message: "Failed to generate questions", 
        error: (error as Error).message 
      });
    }
  });

  // Dashboard stats endpoint
  app.get("/api/stats", async (req, res) => {
    try {
      // Get all exams
      const allExams = await storage.getExamsByCreator(1); // Mock user ID
      
      // Get all submissions across all exams
      const allSubmissions = await storage.getRecentSubmissions(1000);
      
      // Calculate statistics
      const totalExams = allExams.length;
      const totalSubmissions = allSubmissions.length;
      
      // Calculate average score
      const scoresWithValues = allSubmissions.filter(sub => sub.score !== null);
      const averageScore = scoresWithValues.length > 0 
        ? scoresWithValues.reduce((sum, sub) => sum + (sub.score || 0), 0) / scoresWithValues.length
        : 0;
      
      // Calculate pass rate (assuming passing is 60% or higher)
      const passingGrade = 60;
      const passingCount = scoresWithValues.filter(sub => (sub.score || 0) >= passingGrade).length;
      const passRate = scoresWithValues.length > 0 ? (passingCount / scoresWithValues.length) * 100 : 0;
      
      res.json({
        totalExams,
        totalSubmissions,
        averageScore,
        passRate
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      res.status(500).json({ message: "Failed to fetch stats", error: (error as Error).message });
    }
  });

  // Public invitation acceptance routes (no authentication required)
  app.get("/api/invitation/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      const invitation = await storage.getUserInvitationByToken(token);
      
      if (!invitation || invitation.inviteStatus === 'expired' || 
          (invitation.expiresAt && new Date(invitation.expiresAt) < new Date())) {
        return res.status(404).json({ error: "Invitation not found or expired" });
      }

      res.json(invitation);
    } catch (error) {
      console.error("Failed to fetch invitation:", error);
      res.status(500).json({ error: "Failed to fetch invitation" });
    }
  });

  app.post("/api/accept-invitation", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ error: "Token and password are required" });
      }

      const invitation = await storage.getUserInvitationByToken(token);
      
      if (!invitation || invitation.inviteStatus === 'accepted' || invitation.inviteStatus === 'expired' ||
          (invitation.expiresAt && new Date(invitation.expiresAt) < new Date())) {
        return res.status(400).json({ error: "Invalid or expired invitation" });
      }

      // Create the user account
      const newUser = await storage.upsertUser({
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        role: invitation.role,
        isActive: true,
      });

      // Mark invitation as accepted
      await storage.updateUserInvitationStatus(invitation.id, 'accepted', new Date());

      res.json({
        success: true,
        message: "Account created successfully",
        user: {
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role,
        }
      });
    } catch (error) {
      console.error("Failed to accept invitation:", error);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  // AI Assistant endpoints
  app.post("/api/ai-assistant/chat", isAuthenticated, async (req, res) => {
    try {
      const { message, context } = req.body;
      
      if (!message || !context) {
        return res.status(400).json({ error: "Message and context are required" });
      }

      const response = await aiAssistantService.generateChatResponse({ message, context });
      
      res.json({ response });
    } catch (error) {
      console.error("AI Assistant chat error:", error);
      res.status(500).json({ error: "Failed to generate AI response" });
    }
  });

  app.post("/api/ai-assistant/suggestions", isAuthenticated, async (req, res) => {
    try {
      const { context } = req.body;
      
      if (!context) {
        return res.status(400).json({ error: "Context is required" });
      }

      const suggestions = await aiAssistantService.generateContextualSuggestions({ context });
      
      res.json({ suggestions });
    } catch (error) {
      console.error("AI Assistant suggestions error:", error);
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });

  // Test email endpoint
  app.post("/api/test-email", requireSuperAdmin, async (req, res) => {
    try {
      const { recipientEmail, testType = 'user_invitation' } = req.body;
      
      if (!recipientEmail) {
        return res.status(400).json({ message: "Recipient email is required" });
      }

      const EmailService = await import('./services/emailService').then(module => module.EmailService);
      
      let emailSent = false;
      
      if (testType === 'user_invitation') {
        emailSent = await EmailService.sendUserInvitation({
          recipientEmail,
          recipientName: 'Test User',
          inviterName: 'ExamCraft Admin',
          role: 'teacher',
          invitationToken: 'test-token-123'
        });
      } else if (testType === 'exam_invitation') {
        emailSent = await EmailService.sendExamInvitation({
          recipientEmail,
          studentName: 'Test Student',
          examTitle: 'Sample Exam',
          examSubject: 'Testing',
          teacherName: 'Test Teacher',
          examDateTime: '2025-06-28T10:00:00Z',
          duration: 60,
          invitationToken: 'test-exam-token-123',
          examId: 1
        });
      }

      if (emailSent) {
        res.json({ 
          success: true, 
          message: `Test ${testType} email sent successfully to ${recipientEmail}` 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Failed to send test email. Check SendGrid configuration and API key." 
        });
      }
    } catch (error) {
      console.error("Test email error:", error);
      res.status(500).json({ 
        success: false, 
        message: `Email test failed: ${error.message}` 
      });
    }
  });

  // Google Text-to-Speech endpoint
  app.post("/api/tts/synthesize", async (req, res) => {
    try {
      const { text, voiceConfig, audioConfig } = req.body;
      
      const { config } = await import('./config');
      const GOOGLE_TTS_API_KEY = config.googleTts.apiKey;
      
      if (!GOOGLE_TTS_API_KEY) {
        console.error('Google TTS API key not found in environment');
        return res.status(500).json({ error: 'Google TTS API key not configured' });
      }
      
      console.log('Google TTS endpoint called');
      console.log('Text length:', text?.length || 0);
      console.log('Voice config:', voiceConfig);
      
      // Development mode: Return a mock response if API key starts with "test_"
      if (GOOGLE_TTS_API_KEY.startsWith('test_') || process.env.NODE_ENV === 'development_mock') {
        console.log('Using mock TTS response for development');
        // Return silence audio (very short MP3)
        const silentMp3 = 'SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
        return res.json({ audioContent: silentMp3 });
      }
      
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: { text },
            voice: voiceConfig || {
              languageCode: 'ar-XA',
              name: 'ar-XA-Wavenet-C',
              ssmlGender: 'FEMALE'
            },
            audioConfig: audioConfig || {
              audioEncoding: 'MP3',
              speakingRate: 0.95,
              pitch: 0,
              volumeGainDb: 0
            }
          })
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Google TTS API error:', error);
        console.error('Full error details:', JSON.stringify(error, null, 2));
        
        // If API is not enabled, provide a helpful message
        if (response.status === 403) {
          console.error('Full 403 error details:', JSON.stringify(error, null, 2));
          return res.status(403).json({ 
            error: 'Google Text-to-Speech API is not enabled for this API key. Please enable it in Google Cloud Console.',
            details: error.error?.message,
            instructions: 'Visit https://console.cloud.google.com/apis/library/texttospeech.googleapis.com and click ENABLE'
          });
        }
        
        return res.status(response.status).json({ error: error.error?.message || 'TTS API error' });
      }
      
      const data = await response.json();
      res.json({ audioContent: data.audioContent });
    } catch (error) {
      console.error('TTS synthesis error:', error);
      res.status(500).json({ error: 'Failed to synthesize speech' });
    }
  });

  // Student Exam Invitation API (public access for invitation verification)
  app.get('/api/exam-invitation/:token', async (req, res) => {
    try {
      const token = req.params.token;
      
      if (!token) {
        return res.status(400).json({ error: 'Token required' });
      }

      const invitation = await storage.getInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      // Get exam details
      const exam = await storage.getExam(invitation.examId);
      
      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      res.json({
        id: invitation.id,
        examId: invitation.examId,
        studentEmail: invitation.studentEmail,
        studentName: invitation.studentName,
        registrationNumber: invitation.registrationNumber,
        inviteStatus: invitation.inviteStatus,
        inviteToken: invitation.inviteToken,
        exam: {
          title: exam.title,
          subject: exam.subject,
          duration: exam.duration,
          instructions: exam.instructions,
        }
      });
    } catch (error) {
      console.error('Error fetching exam invitation:', error);
      res.status(500).json({ error: 'Failed to fetch invitation' });
    }
  });

  // Upload audio answer endpoint
  app.post("/api/upload-audio-answer", async (req: RequestWithFiles, res) => {
    try {
      const files = req.files;
      const { questionId, sessionId, transcript } = req.body;

      if (!files || !files.audio) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;
      
      // Generate unique filename
      const filename = `audio_q${questionId}_${sessionId}_${Date.now()}.webm`;
      const audioDir = path.join(process.cwd(), 'uploads', 'audio');
      
      // Create audio directory if it doesn't exist
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }

      const filePath = path.join(audioDir, filename);
      
      // Move the uploaded file
      await audioFile.mv(filePath);
      
      console.log(`Audio answer saved: ${filename} with transcript: "${transcript?.substring(0, 50)}..."`);

      // Store audio answer in temporary storage for later association with submission
      const audioUrl = `/uploads/audio/${filename}`;
      
      // Try to find existing submission with this session ID and create audio answer record
      try {
        const submissions = await storage.getSubmissionsBySessionId(sessionId);
        if (submissions.length > 0) {
          const submission = submissions[0];
          
          // Create audio answer record in database
          const audioAnswer = await storage.createVideoAnswer({
            submissionId: submission.id,
            videoQuestionId: parseInt(questionId),
            videoUrl: audioUrl,
            transcript: transcript || null,
            confidence: 85, // Default confidence for audio
            duration: null
          });
          
          console.log(`Created audio answer record for submission ${submission.id}, question ${questionId}`);
        }
      } catch (dbError) {
        console.log(`Could not create audio answer record yet (submission may not exist): ${dbError.message}`);
      }

      res.json({
        success: true,
        url: audioUrl,
        transcript: transcript || "",
        filename
      });
    } catch (error) {
      console.error("Error uploading audio answer:", error);
      res.status(500).json({ error: "Failed to upload audio answer" });
    }
  });

  // Serve audio files
  app.use('/uploads/audio', express.static(path.join(process.cwd(), 'uploads', 'audio')));

  // Get submission details with all related data
  app.get('/api/submissions/:id/details', isAuthenticated, async (req: any, res) => {
    try {
      const submissionId = parseInt(req.params.id);
      
      const submission = await storage.getSubmissionById(submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const exam = await storage.getExamWithQuestions(submission.examId);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      // Parse the answers JSON
      const answers = submission.answers || {};
      
      // Get video answers from database - include transcripts
      const videoAnswers = await storage.getVideoAnswersBySubmissionId(submissionId);
      
      res.json({ 
        submission, 
        exam, 
        answers,
        videoAnswers: videoAnswers.map(va => ({
          ...va,
          transcript: va.transcript || va.transcription || '' // Support both field names
        }))
      });
    } catch (error) {
      console.error('Error fetching submission details:', error);
      res.status(500).json({ message: "Failed to fetch submission details" });
    }
  });

  // Get proctoring data for a submission
  app.get('/api/submissions/:id/proctoring', isAuthenticated, async (req: any, res) => {
    try {
      const submissionId = parseInt(req.params.id);
      
      // Get submission to access sessionId
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }
      
      // Get proctoring videos from filesystem
      let proctoringVideos: any[] = [];
      const proctoringDir = path.join(process.cwd(), 'uploads', 'proctoring');
      
      if (fs.existsSync(proctoringDir)) {
        const files = fs.readdirSync(proctoringDir);
        
        // Try session ID match first
        let filteredFiles = files.filter(file => 
          submission.sessionId && file.includes(submission.sessionId) && file.endsWith('.webm')
        );
        
        // Fallback to submission ID match
        if (filteredFiles.length === 0) {
          filteredFiles = files.filter(file => 
            file.includes(`_${submissionId}_`) && file.endsWith('.webm')
          );
        }
        
        // Fallback to exam ID match if no session/submission match
        if (filteredFiles.length === 0) {
          filteredFiles = files.filter(file => 
            file.includes(`_${submission.examId}_`) && file.endsWith('.webm')
          );
        }
        
        proctoringVideos = filteredFiles.map(filename => ({
          filename,
          url: `/api/videos/proctoring/${filename}`,
          type: filename.includes('camera') ? 'camera' : filename.includes('screen') ? 'screen' : 'unknown',
          uploadedAt: fs.statSync(path.join(proctoringDir, filename)).mtime
        }));
      }
      
      console.log(`Found ${proctoringVideos.length} proctoring videos for submission ${submissionId}`);
      
      // Get AI analysis/violations if available
      const violations = await storage.getViolationsBySubmissionId(submissionId);
      
      // Calculate integrity scores based on violations
      const criticalViolations = violations.filter((v: any) => v.severity === 'high').length;
      const majorViolations = violations.filter((v: any) => v.severity === 'medium').length;
      const minorViolations = violations.filter((v: any) => v.severity === 'low').length;
      
      // Simple scoring algorithm
      const faceDetectionScore = Math.max(0, 100 - (criticalViolations * 20));
      const behaviorScore = Math.max(0, 100 - (majorViolations * 15) - (minorViolations * 5));
      const overallIntegrity = Math.round((faceDetectionScore + behaviorScore) / 2);
      
      // Group videos by type
      const cameraVideos = proctoringVideos
        .filter((v: any) => v.type === 'camera')
        .map((v: any) => v.url);
      
      const screenVideos = proctoringVideos
        .filter((v: any) => v.type === 'screen')
        .map((v: any) => v.url);
      
      res.json({
        videos: {
          camera: cameraVideos,
          screen: screenVideos
        },
        violations: violations.map((v: any) => ({
          id: v.id,
          type: v.violationType,
          severity: v.severity,
          timestamp: new Date(v.timestamp).toLocaleString(),
          description: v.description,
          evidence: v.evidenceUrl
        })),
        stats: {
          totalViolations: violations.length,
          faceDetectionScore,
          behaviorScore,
          overallIntegrity
        }
      });
    } catch (error) {
      console.error('Error fetching proctoring data:', error);
      res.status(500).json({ 
        videos: { camera: [], screen: [] },
        violations: [],
        stats: {
          totalViolations: 0,
          faceDetectionScore: 100,
          behaviorScore: 100,
          overallIntegrity: 100
        }
      });
    }
  });

  // Helper function to generate comprehensive proctoring report
  async function generateComprehensiveProctoringReport(submissionId: number) {
    try {
      // Get violations
      const violations = await storage.getViolationsBySubmission(submissionId);
      
      // Get submission for context
      const submission = await storage.getSubmission(submissionId);
      if (!submission) return { error: 'Submission not found' };

      // Analyze proctoring videos
      const proctoringDir = path.join(process.cwd(), 'uploads', 'proctoring');
      let videoAnalysis = null;
      
      if (fs.existsSync(proctoringDir)) {
        const files = fs.readdirSync(proctoringDir);
        const cameraFiles = files.filter(file => 
          file.includes(submission.sessionId || submissionId.toString()) && 
          file.includes('camera') && 
          file.endsWith('.webm')
        );

        if (cameraFiles.length > 0) {
          const cameraPath = `/api/videos/proctoring/${cameraFiles[0]}`;
          videoAnalysis = await analyzeVideoRecording(
            cameraPath, 
            `Camera recording analysis for submission ${submissionId}`
          );
        }
      }

      // Calculate risk scores
      const violationSeverity = violations.reduce((sum, v) => {
        const severityScore = v.severity === 'critical' ? 3 : v.severity === 'major' ? 2 : 1;
        return sum + severityScore;
      }, 0);

      const overallSuspicion = videoAnalysis?.overallSuspicion || 
        Math.min(100, violationSeverity * 10); // Scale violation severity

      return {
        overallSuspicion,
        violations: violations.map(v => ({
          type: v.violationType,
          severity: v.severity,
          timestamp: v.timestamp,
          description: v.description
        })),
        videoAnalysis: videoAnalysis ? {
          suspicionLevel: videoAnalysis.overallSuspicion,
          violations: videoAnalysis.violations,
          timeline: videoAnalysis.timeline
        } : null,
        summary: `Proctoring analysis found ${violations.length} violations with ${overallSuspicion}% overall suspicion level`
      };
    } catch (error) {
      console.error('Failed to generate proctoring report:', error);
      return { error: 'Failed to generate proctoring report' };
    }
  }

  // Helper function to generate recommendations
  function generateRecommendations(results: any, riskFactors: string[]) {
    const recommendations = [];

    if (results.overallRisk > 80) {
      recommendations.push("HIGH RISK: Manual review strongly recommended");
      recommendations.push("Consider exam retake under stricter supervision");
    } else if (results.overallRisk > 60) {
      recommendations.push("MODERATE RISK: Manual review recommended");
      recommendations.push("Review video/audio answers for accuracy");
    } else if (results.overallRisk > 30) {
      recommendations.push("LOW RISK: Spot check recommended");
    } else {
      recommendations.push("MINIMAL RISK: Standard processing acceptable");
    }

    // Video/Audio specific recommendations
    const lowConfidenceAnswers = [
      ...results.videoAnswers.filter((v: any) => v.transcription.confidence < 70),
      ...results.audioAnswers.filter((a: any) => a.transcription.confidence < 70)
    ];

    if (lowConfidenceAnswers.length > 0) {
      recommendations.push(`Review ${lowConfidenceAnswers.length} audio/video answers with low transcription confidence`);
    }

    // Screen recording recommendations
    if (results.screenAnalysis && results.screenAnalysis.violations?.length > 0) {
      recommendations.push("Review screen recording for unauthorized activity");
    }

    // Add specific risk factor recommendations
    riskFactors.forEach(factor => {
      recommendations.push(`Action needed: ${factor}`);
    });

    return recommendations;
  }

  // Comprehensive AI Analysis for Exam Results
  app.post("/api/analyze/comprehensive", isAuthenticated, async (req, res) => {
    try {
      const { submissionId } = req.body;
      
      if (!submissionId) {
        return res.status(400).json({ message: "Submission ID is required" });
      }

      console.log(`Starting comprehensive AI analysis for submission ${submissionId}`);

      // Get submission details
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Get exam details
      const exam = await storage.getExam(submission.examId);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      const results: any = {
        submissionId,
        examTitle: exam.title,
        studentName: submission.studentName,
        timestamp: new Date().toISOString(),
        screenAnalysis: null,
        videoAnswers: [],
        audioAnswers: [], 
        proctoringAnalysis: null,
        overallRisk: 0,
        recommendations: []
      };

      // 1. Analyze Screen Recording
      try {
        const proctoringDir = path.join(process.cwd(), 'uploads', 'proctoring');
        if (fs.existsSync(proctoringDir)) {
          const files = fs.readdirSync(proctoringDir);
          const screenFiles = files.filter(file => 
            file.includes(submission.sessionId || submissionId.toString()) && 
            file.includes('screen') && 
            file.endsWith('.webm')
          );

          if (screenFiles.length > 0) {
            const screenPath = path.join(proctoringDir, screenFiles[0]);
            console.log(`Analyzing screen recording: ${screenFiles[0]}`);
            
            const screenAnalysis = await analyzeVideoRecording(
              `/api/videos/proctoring/${screenFiles[0]}`, 
              `Screen recording analysis for ${exam.title} - Student: ${submission.studentName}`
            );
            
            results.screenAnalysis = {
              filename: screenFiles[0],
              suspicionLevel: screenAnalysis.overallSuspicion,
              violations: screenAnalysis.violations,
              timeline: screenAnalysis.timeline,
              summary: screenAnalysis.summary
            };
          }
        }
      } catch (error) {
        console.error('Screen analysis error:', error);
        results.screenAnalysis = { error: 'Failed to analyze screen recording' };
      }

      // 2. Analyze Video Answers with Transcription
      try {
        const videoAnswers = await storage.getVideoAnswersBySubmission(submissionId);
        console.log(`Found ${videoAnswers.length} video answers for analysis`);

        for (const videoAnswer of videoAnswers) {
          if (videoAnswer.videoUrl && fs.existsSync(path.join(process.cwd(), 'uploads', 'videos', path.basename(videoAnswer.videoUrl)))) {
            const videoPath = path.join(process.cwd(), 'uploads', 'videos', path.basename(videoAnswer.videoUrl));
            console.log(`Processing video answer: ${videoAnswer.id}`);

            // Get question details
            const question = await storage.getQuestion(videoAnswer.questionId);
            
            // Transcribe video audio
            const transcription = await transcriptionService.transcribeVideoAudio(videoPath, 'ar');
            
            // Analyze for grading
            const gradingAnalysis = await transcriptionService.analyzeTranscriptionForGrading(
              transcription.text,
              question?.question || "Unknown question",
              [], // TODO: Extract keywords from question
              question?.points || 10
            );

            results.videoAnswers.push({
              questionId: videoAnswer.questionId,
              questionText: question?.question || "Unknown question",
              videoUrl: videoAnswer.videoUrl,
              transcription: {
                text: transcription.text,
                confidence: transcription.confidence,
                language: transcription.language,
                duration: transcription.duration,
                wordCount: transcription.wordCount,
                quality: transcription.quality
              },
              grading: gradingAnalysis,
              aiScore: gradingAnalysis.score,
              maxScore: question?.points || 10
            });
          }
        }
      } catch (error) {
        console.error('Video answer analysis error:', error);
      }

      // 3. Analyze Audio Answers with Transcription  
      try {
        // Get audio answers (if stored separately or as part of submissions)
        const submissionAnswers = JSON.parse(submission.answers || '[]');
        const audioQuestions = submissionAnswers.filter((answer: any) => 
          answer.type === 'audio_response' && answer.audioUrl
        );

        for (const audioAnswer of audioQuestions) {
          if (audioAnswer.audioUrl) {
            const audioPath = path.join(process.cwd(), 'uploads', 'audio', path.basename(audioAnswer.audioUrl));
            
            if (fs.existsSync(audioPath)) {
              console.log(`Processing audio answer for question ${audioAnswer.questionId}`);

              // Get question details
              const question = await storage.getQuestion(audioAnswer.questionId);
              
              // Transcribe audio
              const transcription = await transcriptionService.transcribeAudio(audioPath, 'ar');
              
              // Analyze for grading
              const gradingAnalysis = await transcriptionService.analyzeTranscriptionForGrading(
                transcription.text,
                question?.question || "Unknown question",
                [], // TODO: Extract keywords from question  
                question?.points || 10
              );

              results.audioAnswers.push({
                questionId: audioAnswer.questionId,
                questionText: question?.question || "Unknown question",
                audioUrl: audioAnswer.audioUrl,
                transcription: {
                  text: transcription.text,
                  confidence: transcription.confidence,
                  language: transcription.language,
                  duration: transcription.duration,
                  wordCount: transcription.wordCount,
                  sentiment: transcription.sentiment,
                  keywords: transcription.keywords,
                  quality: transcription.quality
                },
                grading: gradingAnalysis,
                aiScore: gradingAnalysis.score,
                maxScore: question?.points || 10
              });
            }
          }
        }
      } catch (error) {
        console.error('Audio answer analysis error:', error);
      }

      // 4. Overall Proctoring Analysis
      try {
        const proctoringAnalysis = await generateComprehensiveProctoringReport(submissionId);
        results.proctoringAnalysis = proctoringAnalysis;
      } catch (error) {
        console.error('Proctoring analysis error:', error);
        results.proctoringAnalysis = { error: 'Failed to generate proctoring analysis' };
      }

      // 5. Calculate Overall Risk Score
      let riskFactors = [];
      let totalRisk = 0;
      let riskCount = 0;

      if (results.screenAnalysis && results.screenAnalysis.suspicionLevel) {
        totalRisk += results.screenAnalysis.suspicionLevel;
        riskCount++;
        if (results.screenAnalysis.suspicionLevel > 70) {
          riskFactors.push("High suspicion in screen recording");
        }
      }

      if (results.proctoringAnalysis && results.proctoringAnalysis.overallSuspicion) {
        totalRisk += results.proctoringAnalysis.overallSuspicion;
        riskCount++;
        if (results.proctoringAnalysis.overallSuspicion > 70) {
          riskFactors.push("Multiple proctoring violations detected");
        }
      }

      // Check audio/video quality issues
      const lowQualityAnswers = [
        ...results.videoAnswers.filter((v: any) => v.transcription.confidence < 70),
        ...results.audioAnswers.filter((a: any) => a.transcription.confidence < 70)
      ];

      if (lowQualityAnswers.length > 0) {
        riskFactors.push(`${lowQualityAnswers.length} answers have low audio quality or transcription confidence`);
      }

      results.overallRisk = riskCount > 0 ? Math.round(totalRisk / riskCount) : 0;
      results.recommendations = generateRecommendations(results, riskFactors);

      console.log(`Comprehensive AI analysis completed for submission ${submissionId}`);
      console.log(`- Screen analysis: ${results.screenAnalysis ? 'completed' : 'skipped'}`);
      console.log(`- Video answers: ${results.videoAnswers.length} processed`);
      console.log(`- Audio answers: ${results.audioAnswers.length} processed`);
      console.log(`- Overall risk: ${results.overallRisk}%`);

      // Store comprehensive analysis results
      try {
        const analysisResult = await storage.createAiAnalysisResult({
          submissionId: parseInt(submissionId),
          videoPath: `Comprehensive analysis: ${results.videoAnswers.length} video + ${results.audioAnswers.length} audio answers`,
          overallSuspicion: results.overallRisk,
          summary: `Comprehensive AI analysis completed with ${results.overallRisk}% risk score. ${riskFactors.join('. ')}`
        });

        console.log(`Stored comprehensive analysis result with ID: ${analysisResult.id}`);
      } catch (dbError) {
        console.error('Failed to store comprehensive analysis:', dbError);
      }

      res.json(results);
    } catch (error) {
      console.error('Comprehensive analysis error:', error);
      res.status(500).json({ 
        message: "Failed to perform comprehensive analysis", 
        error: (error as Error).message 
      });
    }
  });

  // Get comprehensive analysis results
  app.get("/api/analyze/comprehensive/:submissionId", isAuthenticated, async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      
      // Get stored analysis results
      const analysisResults = await storage.getAnalysisResultsBySubmission(submissionId);
      
      // Get video answers with transcriptions
      const videoAnswers = await storage.getVideoAnswersBySubmission(submissionId);
      
      // Get submission for context
      const submission = await storage.getSubmission(submissionId);
      
      res.json({
        submissionId,
        submission,
        analysisResults,
        videoAnswers: videoAnswers.map(va => ({
          ...va,
          hasTranscription: !!va.transcription
        }))
      });
    } catch (error) {
      console.error('Failed to get comprehensive analysis:', error);
      res.status(500).json({ message: "Failed to fetch analysis results" });
    }
  });

  // Individual Question-Answer Analysis
  app.post("/api/analyze/question-answer", isAuthenticated, async (req, res) => {
    try {
      const { submissionId, questionId, questionText, answer, examTitle, studentName } = req.body;

      if (!submissionId || !questionId || !questionText || !answer) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      console.log(`Starting question-answer analysis for submission ${submissionId}, question ${questionId}`);

      const result: any = {
        submissionId,
        questionId,
        questionText,
        answerType: answer.type,
        timestamp: new Date().toISOString(),
        transcription: null,
        grading: null,
        violations: [],
        confidence: null,
        recommendations: []
      };

      // Handle video responses
      if (answer.type === 'video_response' && answer.videoUrl) {
        try {
          const videoPath = path.join(process.cwd(), 'uploads', 'videos', path.basename(answer.videoUrl));
          
          if (fs.existsSync(videoPath)) {
            console.log(`Transcribing video answer: ${path.basename(answer.videoUrl)}`);
            
            // Transcribe video audio
            const transcription = await transcriptionService.transcribeVideoAudio(videoPath, 'ar');
            result.transcription = transcription;
            
            // Analyze for grading
            const gradingAnalysis = await transcriptionService.analyzeTranscriptionForGrading(
              transcription.text,
              questionText,
              [], // TODO: Extract keywords from question
              10 // Default points, should come from question data
            );
            result.grading = gradingAnalysis;
            result.confidence = transcription.confidence;

            console.log(`Video analysis completed: ${transcription.wordCount} words, ${transcription.confidence}% confidence`);
          } else {
            result.error = "Video file not found";
          }
        } catch (error) {
          console.error('Video analysis error:', error);
          result.error = "Failed to analyze video";
        }
      }

      // Handle audio responses
      if (answer.type === 'audio_response' && answer.audioUrl) {
        try {
          const audioPath = path.join(process.cwd(), 'uploads', 'audio', path.basename(answer.audioUrl));
          
          if (fs.existsSync(audioPath)) {
            console.log(`Transcribing audio answer: ${path.basename(answer.audioUrl)}`);
            
            // Transcribe audio
            const transcription = await transcriptionService.transcribeAudio(audioPath, 'ar');
            result.transcription = transcription;
            
            // Analyze for grading
            const gradingAnalysis = await transcriptionService.analyzeTranscriptionForGrading(
              transcription.text,
              questionText,
              [], // TODO: Extract keywords from question
              10 // Default points
            );
            result.grading = gradingAnalysis;
            result.confidence = transcription.confidence;

            console.log(`Audio analysis completed: ${transcription.wordCount} words, ${transcription.confidence}% confidence`);
          } else {
            result.error = "Audio file not found";
          }
        } catch (error) {
          console.error('Audio analysis error:', error);
          result.error = "Failed to analyze audio";
        }
      }

      // Handle text-based answers (multiple choice, short answer, etc.)
      if (['multiple_choice', 'true_false', 'short_answer', 'long_answer', 'essay'].includes(answer.type)) {
        try {
          const answerText = answer.answer || answer.text || '';
          
          if (answerText) {
            console.log(`Analyzing text answer for question ${questionId}`);
            
            // Use AI to analyze text answer
            const gradingAnalysis = await transcriptionService.analyzeTranscriptionForGrading(
              answerText,
              questionText,
              [], // TODO: Extract keywords from question
              10 // Default points
            );
            result.grading = gradingAnalysis;
            result.confidence = 100; // Text answers have full confidence
            
            console.log(`Text analysis completed: ${answerText.length} characters`);
          }
        } catch (error) {
          console.error('Text analysis error:', error);
          result.error = "Failed to analyze text answer";
        }
      }

      // Generate recommendations based on analysis
      if (result.grading) {
        const score = result.grading.score;
        const confidence = result.confidence || 0;
        
        if (confidence < 70) {
          result.recommendations.push("Low transcription confidence - manual review recommended");
        }
        
        if (score < 3) {
          result.recommendations.push("Very low score - consider providing additional feedback");
        } else if (score < 6) {
          result.recommendations.push("Below average score - review answer for partial credit");
        } else if (score >= 8) {
          result.recommendations.push("Strong answer - consider full marks");
        }
        
        if (result.grading.relevance < 50) {
          result.recommendations.push("Answer may be off-topic - manual review needed");
        }
        
        if (result.grading.completeness < 50) {
          result.recommendations.push("Incomplete answer - student may need clarification");
        }
      }

      console.log(`Question-answer analysis completed for question ${questionId}`);
      
      // Store individual analysis results if needed
      try {
        const analysisResult = await storage.createAiAnalysisResult({
          submissionId: parseInt(submissionId),
          videoPath: `Question ${questionId} analysis: ${answer.type}`,
          overallSuspicion: Math.max(0, 100 - (result.grading?.score || 0) * 10), // Convert score to suspicion
          summary: `Individual analysis of question ${questionId}: ${result.grading?.feedback || 'Analysis completed'}`
        });

        console.log(`Stored question analysis result with ID: ${analysisResult.id}`);
      } catch (dbError) {
        console.error('Failed to store question analysis:', dbError);
      }

      res.json(result);
    } catch (error) {
      console.error('Question-answer analysis error:', error);
      res.status(500).json({ 
        message: "Failed to analyze question-answer", 
        error: (error as Error).message 
      });
    }
  });

  // Get questions for an exam
  app.get("/api/exams/:examId/questions", isAuthenticated, async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);
      const questions = await storage.getQuestionsByExam(examId);
      res.json(questions);
    } catch (error) {
      console.error('Failed to get exam questions:', error);
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  // Get submission details with answers
  app.get("/api/submissions/:submissionId/details", isAuthenticated, async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      const submission = await storage.getSubmission(submissionId);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      res.json(submission);
    } catch (error) {
      console.error('Failed to get submission details:', error);
      res.status(500).json({ message: "Failed to fetch submission details" });
    }
  });

  // Get video answers for a submission
  app.get("/api/submissions/:submissionId/video-answers", isAuthenticated, async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      const videoAnswers = await storage.getVideoAnswersBySubmission(submissionId);
      res.json(videoAnswers);
    } catch (error) {
      console.error('Failed to get video answers:', error);
      res.status(500).json({ message: "Failed to fetch video answers" });
    }
  });

  // Clear transcript for audio/video response
  app.post("/api/submissions/:submissionId/clear-transcript", async (req, res) => {
    try {
      const { submissionId } = req.params;
      const { questionId } = req.body;

      if (!submissionId || !questionId) {
        return res.status(400).json({ message: "Missing submissionId or questionId" });
      }

      // Get the submission
      const submission = await storage.getSubmissionById(parseInt(submissionId));
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Parse answers
      let answers = typeof submission.answers === 'string' 
        ? JSON.parse(submission.answers) 
        : submission.answers || {};

      // Clear transcript for the specific question
      if (answers[questionId]) {
        if (answers[questionId].type === 'audio_response' || answers[questionId].type === 'video_response') {
          answers[questionId].transcription = '';
          console.log(`Cleared transcript for question ${questionId} in submission ${submissionId}`);
        }
      }

      // Update the submission with cleared transcript
      await storage.updateSubmissionAnswers(parseInt(submissionId), answers);

      res.json({ 
        message: "Transcript cleared successfully",
        questionId,
        submissionId
      });
    } catch (error) {
      console.error("Error clearing transcript:", error);
      res.status(500).json({ message: "Failed to clear transcript" });
    }
  });

  // Server is started in server/index.ts
  const httpServer = new Server(app);
  return httpServer;
}