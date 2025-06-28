/**
 * Direct SendGrid Email Test Script
 * Tests email functionality bypassing authentication
 */

import { EmailService } from './server/services/emailService.js';

async function testEmailSending() {
  console.log('🧪 Testing SendGrid Email Service...');
  console.log('=====================================');

  try {
    // Test 1: User invitation email
    console.log('\nTest 1: Sending user invitation email...');
    const userEmailSent = await EmailService.sendUserInvitation({
      recipientEmail: 'mehdawiadham@gmail.com',
      recipientName: 'Adham Mehda',
      inviterName: 'ExamCraft Admin',
      role: 'teacher',
      invitationToken: 'test-token-123'
    });

    if (userEmailSent) {
      console.log('✅ User invitation email sent successfully to mehdawiadham@gmail.com');
    } else {
      console.log('❌ Failed to send user invitation email');
    }

    // Test 2: Exam invitation email
    console.log('\nTest 2: Sending exam invitation email...');
    const examEmailSent = await EmailService.sendExamInvitation({
      recipientEmail: 'mehdawiadham@gmail.com',
      studentName: 'Test Student',
      examTitle: 'Sample Exam Test',
      examSubject: 'Email System Testing',
      teacherName: 'ExamCraft Admin',
      examDateTime: '2025-06-28T10:00:00Z',
      duration: 60,
      invitationToken: 'test-exam-token-123',
      examId: 999
    });

    if (examEmailSent) {
      console.log('✅ Exam invitation email sent successfully to mehdawiadham@gmail.com');
    } else {
      console.log('❌ Failed to send exam invitation email');
    }

    // Summary
    console.log('\n📊 Email Test Results:');
    console.log(`User Invitation: ${userEmailSent ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Exam Invitation: ${examEmailSent ? 'SUCCESS' : 'FAILED'}`);
    
    if (userEmailSent || examEmailSent) {
      console.log('\n🎉 Email system is working! Check mehdawiadham@gmail.com for test emails.');
    } else {
      console.log('\n⚠️ Email system appears to have issues. Check SendGrid API key and configuration.');
    }

  } catch (error) {
    console.error('❌ Email test failed with error:', error.message);
    console.error('Full error details:', error);
  }
}

// Run the test
testEmailSending().catch(console.error);