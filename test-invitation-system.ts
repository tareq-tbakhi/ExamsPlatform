import { EmailService } from './server/services/emailService';

console.log('🧪 TESTING COMPLETE INVITATION SYSTEM');
console.log('='.repeat(50));

async function testInvitationSystem() {
  try {
    console.log('\n📧 Testing Email Service with Simulator...');
    
    // Test user invitation
    const userInvitationData = {
      recipientEmail: 'newteacher@example.com',
      recipientName: 'New Teacher',
      inviterName: 'System Admin',
      role: 'teacher',
      invitationToken: 'test-token-' + Date.now()
    };
    
    console.log('📤 Sending user invitation...');
    const userResult = await EmailService.sendUserInvitation(userInvitationData);
    
    if (userResult) {
      console.log('✅ User invitation sent successfully');
    } else {
      console.log('❌ User invitation failed');
    }
    
    // Test exam invitation
    const examInvitationData = {
      recipientEmail: 'student@example.com',
      studentName: 'Test Student',
      examTitle: 'Mathematics Quiz',
      examSubject: 'Mathematics',
      teacherName: 'Prof. Smith',
      examDateTime: new Date().toLocaleString(),
      duration: 60,
      invitationToken: 'exam-token-' + Date.now(),
      examId: 1
    };
    
    console.log('\n📤 Sending exam invitation...');
    const examResult = await EmailService.sendExamInvitation(examInvitationData);
    
    if (examResult) {
      console.log('✅ Exam invitation sent successfully');
    } else {
      console.log('❌ Exam invitation failed');
    }
    
    console.log('\n🎯 Invitation System Test Results:');
    console.log('='.repeat(30));
    console.log('Email Service:', userResult && examResult ? '✅ Working' : '❌ Issues detected');
    console.log('User Invitations:', userResult ? '✅ Working' : '❌ Failed');
    console.log('Exam Invitations:', examResult ? '✅ Working' : '❌ Failed');
    
    if (userResult && examResult) {
      console.log('\n🎉 INVITATION SYSTEM WORKING CORRECTLY!');
      console.log('Email invitations can be sent using either SendGrid or the simulator fallback.');
    } else {
      console.log('\n⚠️ Some invitation features need attention.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testInvitationSystem();