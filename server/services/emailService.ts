import { MailService } from '@sendgrid/mail';
import { EmailSimulator } from './emailSimulator';

let mailService: MailService | null = null;
let useSimulator = false;

if (process.env.SENDGRID_API_KEY) {
  try {
    mailService = new MailService();
    mailService.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('📧 SendGrid configured successfully');
  } catch (error) {
    console.log('⚠️ SendGrid configuration failed, using email simulator');
    useSimulator = true;
  }
} else {
  console.log('⚠️ SENDGRID_API_KEY not found, using email simulator');
  useSimulator = true;
}

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
    console.log('📧 sendUserInvitation called with:', {
      recipientEmail: data.recipientEmail,
      recipientName: data.recipientName,
      role: data.role,
      useSimulator,
      hasMailService: !!mailService
    });
    
    // If SendGrid is not available or fails, use simulator
    if (useSimulator || !mailService) {
      console.log('⚠️ Using email simulator (useSimulator:', useSimulator, ', mailService:', !!mailService, ')');
      return EmailSimulator.sendUserInvitation(
        data.recipientEmail,
        data.recipientName || 'User',
        data.inviterName,
        data.role,
        data.invitationToken
      );
    }

    try {
      const invitationUrl = `${PLATFORM_URL}/accept-invitation?token=${data.invitationToken}`;
      
      // Simplified HTML for better deliverability
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
        <h2 style="color: #333; margin-bottom: 20px;">ExamCraft Platform Invitation</h2>
        
        <p>Hello ${data.recipientName || 'there'},</p>
        
        <p><strong>${data.inviterName}</strong> has invited you to join the ExamCraft platform as a <strong>${data.role.replace('_', ' ')}</strong>.</p>
        
        <p>To accept this invitation and create your account, please click the link below:</p>
        
        <p style="margin: 30px 0;">
            <a href="${invitationUrl}" style="background-color: #5e72e4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a>
        </p>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #5e72e4;">${invitationUrl}</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="color: #666; font-size: 14px;">This invitation is valid for 7 days. If you have any questions, please contact your administrator.</p>
        
        <p style="color: #666; font-size: 14px;">Best regards,<br>The ExamCraft Team</p>
    </div>
</body>
</html>`;

      const textContent = `
ExamCraft Platform Invitation

Hello ${data.recipientName || 'there'},

${data.inviterName} has invited you to join the ExamCraft platform as a ${data.role.replace('_', ' ')}.

To accept your invitation and get started, visit:
${invitationUrl}

This invitation is valid for 7 days.

Best regards,
The ExamCraft Team
`;

      console.log('🚀 Attempting to send email via SendGrid...');
      if (!mailService) {
        throw new Error('MailService is unexpectedly null');
      }
      const result = await mailService.send({
        to: data.recipientEmail,
        from: {
          email: 'support@withyoumna.com',
          name: 'ExamCraft Platform'
        },
        subject: `Invitation to join ExamCraft as ${data.role.replace('_', ' ')}`, // Removed emoji
        text: textContent,
        html: htmlContent,
      });
      
      console.log('✅ SendGrid response:', result);
      return true;
    } catch (error) {
      console.error('SendGrid user invitation error:', error);
      // Fallback to simulator when SendGrid fails
      console.log("Falling back to email simulator...");
      return EmailSimulator.sendUserInvitation(
        data.recipientEmail,
        data.recipientName || 'User',
        data.inviterName,
        data.role,
        data.invitationToken
      );
    }
  }

  /**
   * Send student exam invitation email
   */
  static async sendExamInvitation(data: ExamInvitationData): Promise<boolean> {
    // If SendGrid is not available or fails, use simulator
    if (useSimulator || !mailService) {
      return EmailSimulator.sendExamInvitation(
        data.recipientEmail,
        data.studentName,
        data.examTitle,
        data.examSubject,
        data.teacherName,
        data.examDateTime,
        data.duration,
        data.invitationToken
      );
    }

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
          email: 'support@withyoumna.com',
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