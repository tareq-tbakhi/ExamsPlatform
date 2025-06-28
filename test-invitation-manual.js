/**
 * Manual User Invitation Test
 * Tests email system and invitation functionality
 */

const BASE_URL = 'http://localhost:5000';

async function testInvitationSystem() {
  console.log('🧪 Testing User Invitation System');
  console.log('=' .repeat(40));
  
  try {
    // Test 1: Test SendGrid email system directly
    console.log('\n1. Testing SendGrid email system...');
    const emailTest = {
      to: 'mehdawiadham@gmail.com',
      subject: 'ExamCraft User Invitation Test - Manual',
      text: 'This is a manual test of the ExamCraft user invitation email system.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3b82f6;">ExamCraft Manual Test</h1>
          <p>This is a manual test email from the ExamCraft user invitation system.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Test Details:</h3>
            <ul>
              <li>Test Type: Manual User Invitation</li>
              <li>Email System: SendGrid</li>
              <li>Timestamp: ${new Date().toISOString()}</li>
              <li>Status: Testing email delivery</li>
            </ul>
          </div>
          <p>If you receive this email, the invitation system is working correctly!</p>
        </div>
      `
    };
    
    const response = await fetch(`${BASE_URL}/api/test-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailTest)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Email test successful');
      console.log(`   - Status: ${result.success ? 'Sent' : 'Failed'}`);
      console.log(`   - Recipient: ${emailTest.to}`);
      console.log('   - Check your email inbox for the test message');
    } else {
      const error = await response.text();
      console.log(`❌ Email test failed: ${error}`);
    }

    // Test 2: Check if invitation endpoint exists
    console.log('\n2. Testing invitation endpoint availability...');
    const healthCheck = await fetch(`${BASE_URL}/api/user-invitations`, {
      method: 'OPTIONS'
    });
    
    if (healthCheck.status === 200 || healthCheck.status === 405) {
      console.log('✅ User invitation endpoint is available');
    } else {
      console.log('❌ User invitation endpoint not accessible');
    }

    console.log('\n' + '=' .repeat(40));
    console.log('📋 Manual Test Instructions:');
    console.log('1. Open the User Management page at /super-admin');
    console.log('2. Click "Invite New User" button');
    console.log('3. Fill in the invitation form:');
    console.log('   - Email: test@example.com');
    console.log('   - First Name: Test');
    console.log('   - Last Name: User');
    console.log('   - Role: Teacher');
    console.log('4. Submit the form');
    console.log('5. Check if invitation appears in "Pending Invitations" tab');
    console.log('6. Check email inbox for invitation email');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testInvitationSystem();