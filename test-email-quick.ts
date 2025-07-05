import { EmailService } from './server/services/emailService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function quickEmailTest() {
  console.log('🧪 Quick Email Test');
  console.log('📧 SendGrid API Key present:', !!process.env.SENDGRID_API_KEY);
  console.log('📧 From Email:', process.env.FROM_EMAIL);
  console.log('📧 Email notifications enabled:', process.env.ENABLE_EMAIL_NOTIFICATIONS);
  
  try {
    // Test sending a simple user invitation
    const result = await EmailService.sendUserInvitation({
      recipientEmail: 'test@example.com',
      recipientName: 'Test User',
      inviterName: 'Admin User',
      invitationToken: 'test-token-123',
      role: 'student'
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Result:', result);
  } catch (error: any) {
    console.error('❌ Email failed:', error.message);
    if (error.response) {
      console.error('SendGrid Error Details:', error.response.body);
    }
  }
}

quickEmailTest(); 