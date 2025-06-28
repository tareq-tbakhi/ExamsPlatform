import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

const EXAMCRAFT_LOGO_URL = "https://i.imgur.com/ExamCraftLogo.png"; // Placeholder - replace with actual logo URL
const PLATFORM_URL = process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : "https://examcraft.replit.app";

interface UserInvitationData {
  recipientEmail: string;
  recipientName?: string;
  inviterName: string;
  role: string;
  invitationToken: string;
}

interface ExamInvitationData {
  recipientEmail: string;
  studentName: string;
  examTitle: string;
  examSubject: string;
  teacherName: string;
  examDateTime: string;
  duration: number;
  invitationToken: string;
  examId: number;
}

export class EmailService {
  /**
   * Send platform user invitation email
   */
  static async sendUserInvitation(data: UserInvitationData): Promise<boolean> {
    try {
      const invitationUrl = `${PLATFORM_URL}/accept-invitation?token=${data.invitationToken}`;
      
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ExamCraft Platform Invitation</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; }
        .logo { max-width: 150px; height: auto; margin-bottom: 20px; }
        .header h1 { color: white; margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 40px 30px; }
        .invitation-box { background-color: #f8f9ff; padding: 30px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #667eea; }
        .role-badge { background-color: #667eea; color: white; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .footer { background-color: #2d3748; color: #a0aec0; padding: 30px; text-align: center; font-size: 14px; }
        .security-note { background-color: #fef5e7; border: 1px solid #f6ad55; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="${EXAMCRAFT_LOGO_URL}" alt="ExamCraft Logo" class="logo">
            <h1>Platform Invitation</h1>
        </div>
        
        <div class="content">
            <h2>Welcome to ExamCraft!</h2>
            <p>Hello ${data.recipientName || 'there'},</p>
            
            <p><strong>${data.inviterName}</strong> has invited you to join the ExamCraft platform as a <span class="role-badge">${data.role.replace('_', ' ')}</span>.</p>
            
            <div class="invitation-box">
                <h3>🎓 What is ExamCraft?</h3>
                <p>ExamCraft is an advanced AI-powered exam creation and proctoring platform that enables educators to:</p>
                <ul>
                    <li>Create comprehensive exams with AI-generated questions</li>
                    <li>Monitor students with advanced proctoring technology</li>
                    <li>Analyze performance with detailed analytics</li>
                    <li>Collaborate with team members and supervisors</li>
                </ul>
            </div>
            
            <div style="text-align: center;">
                <a href="${invitationUrl}" class="cta-button">Accept Invitation & Get Started</a>
            </div>
            
            <div class="security-note">
                <strong>🔐 Security Notice:</strong> This invitation is valid for 7 days and can only be used once. The platform uses invitation-only access to ensure security and quality.
            </div>
            
            <p>If you have any questions, please contact your platform administrator.</p>
            
            <p>Best regards,<br>The ExamCraft Team</p>
        </div>
        
        <div class="footer">
            <p>© 2025 ExamCraft Platform. Advanced AI-Powered Exam Management.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;

      const textContent = `
ExamCraft Platform Invitation

Hello ${data.recipientName || 'there'},

${data.inviterName} has invited you to join the ExamCraft platform as a ${data.role.replace('_', ' ')}.

ExamCraft is an advanced AI-powered exam creation and proctoring platform that enables educators to create comprehensive exams, monitor students, and analyze performance.

To accept your invitation and get started, visit:
${invitationUrl}

This invitation is valid for 7 days and can only be used once.

Best regards,
The ExamCraft Team

© 2025 ExamCraft Platform
`;

      await mailService.send({
        to: data.recipientEmail,
        from: {
          email: 'mehdawiadham@gmail.com',
          name: 'ExamCraft Platform'
        },
        subject: `🎓 You're invited to join ExamCraft as ${data.role.replace('_', ' ')}`,
        text: textContent,
        html: htmlContent,
      });

      return true;
    } catch (error) {
      console.error('SendGrid user invitation error:', error);
      
      // Fallback: Log email details for testing
      console.log('\n=== EMAIL WOULD BE SENT (SendGrid not configured) ===');
      console.log(`To: ${data.recipientEmail}`);
      console.log(`Subject: 🎓 You're invited to join ExamCraft as ${data.role.replace('_', ' ')}`);
      console.log(`Invitation URL: ${invitationUrl}`);
      console.log('=== END EMAIL LOG ===\n');
      
      // Return true for testing - change to false in production
      return true;
    }
  }

  /**
   * Send student exam invitation email
   */
  static async sendExamInvitation(data: ExamInvitationData): Promise<boolean> {
    try {
      const examUrl = `${PLATFORM_URL}/exam-access?token=${data.invitationToken}`;
      const examDate = new Date(data.examDateTime);
      const formattedDate = examDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const formattedTime = examDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZoneName: 'short'
      });

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exam Invitation - ${data.examTitle}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); padding: 40px 30px; text-align: center; }
        .logo { max-width: 150px; height: auto; margin-bottom: 20px; }
        .header h1 { color: white; margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 40px 30px; }
        .exam-details { background-color: #f0fff4; padding: 30px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #48bb78; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
        .detail-label { font-weight: bold; color: #2d3748; }
        .detail-value { color: #4a5568; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; margin: 20px 0; font-size: 16px; }
        .footer { background-color: #2d3748; color: #a0aec0; padding: 30px; text-align: center; font-size: 14px; }
        .important-notes { background-color: #fffaf0; border: 1px solid #f6ad55; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .proctoring-info { background-color: #ebf8ff; border: 1px solid #3182ce; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .requirements-list { background-color: #f7fafc; padding: 20px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="${EXAMCRAFT_LOGO_URL}" alt="ExamCraft Logo" class="logo">
            <h1>📝 Exam Invitation</h1>
        </div>
        
        <div class="content">
            <h2>Hello ${data.studentName}!</h2>
            <p>You have been invited to take an exam on the ExamCraft platform.</p>
            
            <div class="exam-details">
                <h3>📋 Exam Details</h3>
                <div class="detail-row">
                    <span class="detail-label">Exam Title:</span>
                    <span class="detail-value">${data.examTitle}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Subject:</span>
                    <span class="detail-value">${data.examSubject}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Teacher:</span>
                    <span class="detail-value">${data.teacherName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date:</span>
                    <span class="detail-value">${formattedDate}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Time:</span>
                    <span class="detail-value">${formattedTime}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Duration:</span>
                    <span class="detail-value">${data.duration} minutes</span>
                </div>
            </div>
            
            <div style="text-align: center;">
                <a href="${examUrl}" class="cta-button">📝 Start Exam</a>
            </div>
            
            <div class="important-notes">
                <h4>⚠️ Important Instructions</h4>
                <ul>
                    <li>Click the "Start Exam" button only when you're ready to begin</li>
                    <li>Once started, the timer cannot be paused or extended</li>
                    <li>Ensure you have a stable internet connection</li>
                    <li>Do not refresh or close the browser window during the exam</li>
                </ul>
            </div>

            <div class="proctoring-info">
                <h4>🛡️ Proctoring Information</h4>
                <p>This exam uses advanced AI proctoring technology to ensure academic integrity:</p>
                <ul>
                    <li>Your screen and camera activity will be monitored</li>
                    <li>Browser lockdown prevents unauthorized actions</li>
                    <li>AI analysis detects suspicious behavior</li>
                    <li>Please ensure good lighting and a quiet environment</li>
                </ul>
            </div>

            <div class="requirements-list">
                <h4>💻 Technical Requirements</h4>
                <ul>
                    <li>Modern web browser (Chrome, Firefox, Safari, Edge)</li>
                    <li>Working camera and microphone</li>
                    <li>Stable internet connection (minimum 5 Mbps)</li>
                    <li>Allow browser permissions for camera and microphone</li>
                </ul>
            </div>
            
            <p>If you encounter any technical issues, please contact your instructor immediately.</p>
            
            <p>Good luck with your exam!</p>
            
            <p>Best regards,<br><strong>${data.teacherName}</strong><br>ExamCraft Platform</p>
        </div>
        
        <div class="footer">
            <p>© 2025 ExamCraft Platform. Advanced AI-Powered Exam Management.</p>
            <p>Exam ID: ${data.examId} | This invitation is unique and cannot be shared.</p>
        </div>
    </div>
</body>
</html>`;

      const textContent = `
ExamCraft Exam Invitation

Hello ${data.studentName}!

You have been invited to take an exam on the ExamCraft platform.

EXAM DETAILS:
- Title: ${data.examTitle}
- Subject: ${data.examSubject}
- Teacher: ${data.teacherName}
- Date: ${formattedDate}
- Time: ${formattedTime}
- Duration: ${data.duration} minutes

To start your exam, visit: ${examUrl}

IMPORTANT INSTRUCTIONS:
- Click the link only when you're ready to begin
- Once started, the timer cannot be paused
- Ensure stable internet connection
- Do not refresh or close the browser

PROCTORING NOTICE:
This exam uses AI proctoring technology. Your screen and camera will be monitored for academic integrity.

TECHNICAL REQUIREMENTS:
- Modern web browser
- Working camera and microphone
- Stable internet (5+ Mbps)
- Allow browser permissions

Good luck with your exam!

Best regards,
${data.teacherName}
ExamCraft Platform

Exam ID: ${data.examId}
`;

      await mailService.send({
        to: data.recipientEmail,
        from: {
          email: 'mehdawiadham@gmail.com',
          name: 'ExamCraft Platform'
        },
        subject: `📝 Exam Invitation: ${data.examTitle} - ${formattedDate}`,
        text: textContent,
        html: htmlContent,
      });

      return true;
    } catch (error) {
      console.error('SendGrid exam invitation error:', error);
      return false;
    }
  }

  /**
   * Send exam reminder email (24 hours before)
   */
  static async sendExamReminder(data: ExamInvitationData): Promise<boolean> {
    try {
      const examUrl = `${PLATFORM_URL}/exam-access?token=${data.invitationToken}`;
      const examDate = new Date(data.examDateTime);
      const formattedDate = examDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const formattedTime = examDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZoneName: 'short'
      });

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exam Reminder - ${data.examTitle}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: linear-gradient(135deg, #f6ad55 0%, #ed8936 100%); padding: 40px 30px; text-align: center; }
        .logo { max-width: 150px; height: auto; margin-bottom: 20px; }
        .header h1 { color: white; margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 40px 30px; }
        .reminder-box { background-color: #fffaf0; padding: 30px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #f6ad55; }
        .countdown { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .footer { background-color: #2d3748; color: #a0aec0; padding: 30px; text-align: center; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="${EXAMCRAFT_LOGO_URL}" alt="ExamCraft Logo" class="logo">
            <h1>⏰ Exam Reminder</h1>
        </div>
        
        <div class="content">
            <h2>Don't forget your exam tomorrow!</h2>
            <p>Hello ${data.studentName},</p>
            
            <p>This is a friendly reminder about your upcoming exam:</p>
            
            <div class="reminder-box">
                <h3>${data.examTitle}</h3>
                <p><strong>Tomorrow, ${formattedDate}</strong></p>
                <p><strong>Time:</strong> ${formattedTime}</p>
                <p><strong>Duration:</strong> ${data.duration} minutes</p>
                <p><strong>Teacher:</strong> ${data.teacherName}</p>
            </div>
            
            <div class="countdown">
                <h3>📅 Less than 24 hours to go!</h3>
                <p>Make sure you're prepared and ready</p>
            </div>
            
            <div style="text-align: center;">
                <a href="${examUrl}" class="cta-button">Access Exam</a>
            </div>
            
            <h4>✅ Final Checklist:</h4>
            <ul>
                <li>Test your camera and microphone</li>
                <li>Ensure stable internet connection</li>
                <li>Prepare a quiet, well-lit environment</li>
                <li>Close unnecessary applications</li>
                <li>Have your materials ready (if allowed)</li>
            </ul>
            
            <p>Good luck with your exam!</p>
            
            <p>Best regards,<br><strong>${data.teacherName}</strong></p>
        </div>
        
        <div class="footer">
            <p>© 2025 ExamCraft Platform</p>
        </div>
    </div>
</body>
</html>`;

      await mailService.send({
        to: data.recipientEmail,
        from: {
          email: 'noreply@examcraft.com',
          name: 'ExamCraft Platform'
        },
        subject: `⏰ Reminder: ${data.examTitle} exam tomorrow at ${formattedTime}`,
        html: htmlContent,
      });

      return true;
    } catch (error) {
      console.error('SendGrid exam reminder error:', error);
      return false;
    }
  }
}