import { EmailService } from './server/services/emailService';

console.log('🧪 TESTING EMAIL INVITATION SYSTEM');
console.log('='.repeat(40));

async function testEmailService() {
  try {
    console.log('📧 Testing SendGrid configuration...');
    console.log('API Key present:', !!process.env.SENDGRID_API_KEY);
    console.log('API Key length:', process.env.SENDGRID_API_KEY?.length || 0);
    
    // Test data
    const testUserInvitation = {
      recipientEmail: 'mehdawiadham@gmail.com', // Use your email for testing
      recipientName: 'Test User',
      inviterName: 'System Admin',
      role: 'teacher',
      invitationToken: 'test-token-' + Date.now()
    };
    
    console.log('📤 Sending test user invitation...');
    console.log('To:', testUserInvitation.recipientEmail);
    
    const result = await EmailService.sendUserInvitation(testUserInvitation);
    
    if (result) {
      console.log('✅ User invitation sent successfully');
    } else {
      console.log('❌ User invitation failed (returned false)');
    }
    
    // Test exam invitation
    console.log('\n📤 Testing exam invitation...');
    const testExamInvitation = {
      recipientEmail: 'mehdawiadham@gmail.com',
      studentName: 'Test Student',
      examTitle: 'Test Exam',
      examSubject: 'Testing',
      teacherName: 'Test Teacher',
      examDateTime: new Date().toLocaleString(),
      duration: 60,
      invitationToken: 'exam-token-' + Date.now(),
      examId: 1
    };
    
    const examResult = await EmailService.sendExamInvitation(testExamInvitation);
    
    if (examResult) {
      console.log('✅ Exam invitation sent successfully');
    } else {
      console.log('❌ Exam invitation failed (returned false)');
    }
    
  } catch (error) {
    console.log('❌ Email service error:', error.message);
    if (error.response) {
      console.log('SendGrid response:', error.response.body);
    }
  }
}

testEmailService();