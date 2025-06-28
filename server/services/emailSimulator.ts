/**
 * Email Simulator Service
 * Simulates email sending when SendGrid is not available
 * Logs emails to console and stores them for testing
 */

interface EmailLog {
  to: string;
  subject: string;
  content: string;
  sentAt: Date;
  type: 'user_invitation' | 'exam_invitation' | 'reminder';
}

class EmailSimulator {
  private static emailLog: EmailLog[] = [];

  static logEmail(to: string, subject: string, content: string, type: EmailLog['type']) {
    const email: EmailLog = {
      to,
      subject,
      content,
      sentAt: new Date(),
      type
    };
    
    this.emailLog.push(email);
    
    console.log('\n📧 EMAIL SIMULATOR - Email Sent');
    console.log('='.repeat(40));
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Type: ${type}`);
    console.log(`Sent At: ${email.sentAt.toISOString()}`);
    console.log('Content Preview:');
    console.log(content.substring(0, 200) + '...');
    console.log('='.repeat(40));
    
    return true;
  }

  static getEmailLog(): EmailLog[] {
    return this.emailLog;
  }

  static clearLog(): void {
    this.emailLog = [];
  }

  static getLogForRecipient(email: string): EmailLog[] {
    return this.emailLog.filter(log => log.to === email);
  }

  // Simulate user invitation email
  static sendUserInvitation(recipientEmail: string, recipientName: string, inviterName: string, role: string, invitationToken: string): boolean {
    const subject = `Welcome to ExamCraft - ${role.charAt(0).toUpperCase() + role.slice(1)} Invitation`;
    const content = `
Hi ${recipientName || recipientEmail},

You've been invited to join ExamCraft as a ${role} by ${inviterName}.

ExamCraft is an advanced AI-powered examination platform with comprehensive proctoring capabilities.

To accept your invitation and set up your account, click the link below:
[Accept Invitation - Token: ${invitationToken}]

What you can do as a ${role}:
${role === 'teacher' ? '• Create and manage exams\n• Generate questions with AI\n• Monitor student submissions\n• Review proctoring data' : 
  role === 'admin' ? '• Manage all platform users\n• Oversee all exams and results\n• Configure system settings\n• Generate reports' :
  '• Take assigned exams\n• Submit video responses\n• View your results'}

If you have any questions, please contact your administrator.

Welcome to ExamCraft!

Best regards,
ExamCraft Team
    `;

    return this.logEmail(recipientEmail, subject, content, 'user_invitation');
  }

  // Simulate exam invitation email
  static sendExamInvitation(recipientEmail: string, studentName: string, examTitle: string, examSubject: string, teacherName: string, examDateTime: string, duration: number, invitationToken: string): boolean {
    const subject = `Exam Invitation: ${examTitle}`;
    const content = `
Hi ${studentName},

You have been invited to take an exam on ExamCraft.

Exam Details:
• Title: ${examTitle}
• Subject: ${examSubject}
• Teacher: ${teacherName}
• Date & Time: ${examDateTime}
• Duration: ${duration} minutes

To access your exam, click the link below:
[Take Exam - Token: ${invitationToken}]

Important Notes:
• Make sure you have a stable internet connection
• Ensure your camera and microphone are working
• Use a quiet environment free from distractions
• Have a valid ID ready for verification
• The exam includes proctoring features for security

Technical Requirements:
• Modern web browser (Chrome, Firefox, Safari, Edge)
• Camera and microphone access
• Stable internet connection

If you encounter any technical issues, contact your instructor immediately.

Good luck!

Best regards,
${teacherName}
ExamCraft Platform
    `;

    return this.logEmail(recipientEmail, subject, content, 'exam_invitation');
  }
}

export { EmailSimulator, EmailLog };