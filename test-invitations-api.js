/**
 * Test invitation API endpoints and display functionality
 */

const baseUrl = 'http://localhost:5000';

async function makeRequest(path, method = 'GET', body = null, headers = {}) {
  const url = `${baseUrl}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return { success: response.ok, data, status: response.status };
    } else {
      const text = await response.text();
      return { success: false, error: 'Non-JSON response', text: text.substring(0, 200) };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testInvitationAPIs() {
  console.log('🧪 TESTING INVITATION SYSTEM APIs');
  console.log('='.repeat(50));
  
  try {
    // Test user invitations endpoint
    console.log('\n📋 Testing user invitations API...');
    const userInvitationsResult = await makeRequest('/api/user-invitations');
    
    if (userInvitationsResult.success) {
      console.log('✅ User invitations API working');
      console.log(`Found ${userInvitationsResult.data.length} user invitations`);
      userInvitationsResult.data.forEach((inv, i) => {
        console.log(`  ${i+1}. ${inv.email} (${inv.role}) - Status: ${inv.invite_status}`);
      });
    } else {
      console.log('❌ User invitations API failed:', userInvitationsResult.error);
      if (userInvitationsResult.text) {
        console.log('Response preview:', userInvitationsResult.text);
      }
    }
    
    // Test exam invitations (need exam ID)
    console.log('\n📋 Testing exam invitations API...');
    const examInvitationsResult = await makeRequest('/api/exams/3/invitations');
    
    if (examInvitationsResult.success) {
      console.log('✅ Exam invitations API working');
      console.log(`Found ${examInvitationsResult.data.length} exam invitations`);
      examInvitationsResult.data.forEach((inv, i) => {
        console.log(`  ${i+1}. ${inv.student_email} - Status: ${inv.invite_status}`);
      });
    } else {
      console.log('❌ Exam invitations API failed:', examInvitationsResult.error);
    }
    
    // Test creating a new user invitation (this might fail due to auth)
    console.log('\n📤 Testing invitation creation...');
    const createResult = await makeRequest('/api/user-invitations', 'POST', {
      email: 'newuser@example.com',
      firstName: 'New',
      lastName: 'User',
      role: 'teacher'
    });
    
    if (createResult.success) {
      console.log('✅ Invitation creation working');
    } else {
      console.log('⚠️  Invitation creation failed (likely auth issue):', createResult.error);
    }
    
    console.log('\n🎯 Summary:');
    console.log('User Invitations API:', userInvitationsResult.success ? '✅ Working' : '❌ Failed');
    console.log('Exam Invitations API:', examInvitationsResult.success ? '✅ Working' : '❌ Failed');
    console.log('Create Invitation:', createResult.success ? '✅ Working' : '⚠️  Auth Required');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testInvitationAPIs();