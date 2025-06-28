/**
 * ExamCraft User Invitation System Test
 * Tests the complete user invitation flow including email delivery
 */

const BASE_URL = 'http://localhost:5000';

function makeRequest(path, method = 'GET', body = null, headers = {}) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  
  return fetch(url, options);
}

async function testUserInvitationSystem() {
  console.log('🧪 ExamCraft User Invitation System Test');
  console.log('=' .repeat(50));
  
  let testsPassed = 0;
  let testsTotal = 0;
  
  try {
    // Test 1: Check authentication status
    testsTotal++;
    console.log('\n1. Testing authentication status...');
    const authResponse = await makeRequest('/api/auth/user');
    if (authResponse.status === 200) {
      const user = await authResponse.json();
      console.log(`✅ Authenticated as: ${user.email} (${user.role})`);
      testsPassed++;
    } else {
      console.log('❌ Not authenticated - login required for invitation testing');
      return;
    }

    // Test 2: Get current user invitations
    testsTotal++;
    console.log('\n2. Getting current user invitations...');
    const invitationsResponse = await makeRequest('/api/user-invitations');
    if (invitationsResponse.status === 200) {
      const invitations = await invitationsResponse.json();
      console.log(`✅ Found ${invitations.length} existing invitations`);
      invitations.forEach(inv => {
        console.log(`   - ${inv.email} (${inv.role}) - Status: ${inv.status}`);
      });
      testsPassed++;
    } else {
      console.log('❌ Failed to fetch invitations');
    }

    // Test 3: Create new user invitation
    testsTotal++;
    console.log('\n3. Creating new user invitation...');
    const newInvitation = {
      email: 'testuser@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'teacher'
    };
    
    const createResponse = await makeRequest('/api/user-invitations', 'POST', newInvitation);
    if (createResponse.status === 201 || createResponse.status === 200) {
      const result = await createResponse.json();
      console.log('✅ User invitation created successfully');
      console.log(`   - Email: ${newInvitation.email}`);
      console.log(`   - Role: ${newInvitation.role}`);
      console.log(`   - Token: ${result.token ? 'Generated' : 'Missing'}`);
      testsPassed++;
    } else {
      const error = await createResponse.text();
      console.log(`❌ Failed to create invitation: ${error}`);
    }

    // Test 4: Verify invitation was created
    testsTotal++;
    console.log('\n4. Verifying invitation was created...');
    const verifyResponse = await makeRequest('/api/user-invitations');
    if (verifyResponse.status === 200) {
      const updatedInvitations = await verifyResponse.json();
      const testInvitation = updatedInvitations.find(inv => inv.email === 'testuser@example.com');
      if (testInvitation) {
        console.log('✅ Invitation found in database');
        console.log(`   - ID: ${testInvitation.id}`);
        console.log(`   - Status: ${testInvitation.status}`);
        console.log(`   - Created: ${new Date(testInvitation.createdAt).toLocaleString()}`);
        testsPassed++;
      } else {
        console.log('❌ Invitation not found in database');
      }
    } else {
      console.log('❌ Failed to verify invitation');
    }

    // Test 5: Test email system directly
    testsTotal++;
    console.log('\n5. Testing email system...');
    const emailTest = {
      to: 'mehdawiadham@gmail.com',
      subject: 'ExamCraft User Invitation Test',
      text: 'This is a test email from the ExamCraft user invitation system.',
      html: '<h1>Test Email</h1><p>This is a test email from the ExamCraft user invitation system.</p>'
    };
    
    const emailResponse = await makeRequest('/api/test-email', 'POST', emailTest);
    if (emailResponse.status === 200) {
      console.log('✅ Email system test successful');
      console.log('   - Test email sent to mehdawiadham@gmail.com');
      testsPassed++;
    } else {
      const error = await emailResponse.text();
      console.log(`❌ Email system test failed: ${error}`);
    }

    // Test 6: Get all platform users
    testsTotal++;
    console.log('\n6. Getting all platform users...');
    const usersResponse = await makeRequest('/api/users');
    if (usersResponse.status === 200) {
      const users = await usersResponse.json();
      console.log(`✅ Found ${users.length} platform users`);
      users.forEach(user => {
        console.log(`   - ${user.email} (${user.role}) - Active: ${user.isActive}`);
      });
      testsPassed++;
    } else {
      console.log('❌ Failed to fetch platform users');
    }

    // Test Summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 Test Summary');
    console.log(`✅ Tests Passed: ${testsPassed}/${testsTotal}`);
    console.log(`📈 Success Rate: ${Math.round((testsPassed/testsTotal) * 100)}%`);
    
    if (testsPassed === testsTotal) {
      console.log('🎉 All tests passed! User invitation system is fully operational.');
    } else {
      console.log('⚠️  Some tests failed. Review the issues above.');
    }

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
}

// Run the test
testUserInvitationSystem();