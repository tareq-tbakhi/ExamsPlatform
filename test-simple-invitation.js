/**
 * Simple Invitation Test - Test creating invitation via API
 */

async function testInvitationCreation() {
  console.log('🧪 Testing invitation creation system...\n');

  try {
    // Create a new invitation
    const invitationData = {
      email: `test-${Date.now()}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      role: 'teacher'
    };

    const response = await fetch('http://localhost:5000/api/user-invitations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(invitationData)
    });

    console.log(`Status: ${response.status}`);
    
    if (response.status === 200 || response.status === 201) {
      const result = await response.json();
      console.log('✅ Invitation created successfully!');
      console.log(`Email: ${result.invitation.email}`);
      console.log(`Token: ${result.invitation.inviteToken}`);
      console.log(`Email sent: ${result.emailSent ? 'Yes' : 'No (using simulator)'}`);
      
      // Try to fetch all invitations to verify it's there
      const fetchResponse = await fetch('http://localhost:5000/api/user-invitations', {
        credentials: 'include'
      });
      
      if (fetchResponse.status === 200) {
        const invitations = await fetchResponse.json();
        console.log(`\n📋 Total invitations in database: ${invitations.length}`);
        const newInvitation = invitations.find(inv => inv.email === invitationData.email);
        if (newInvitation) {
          console.log('✅ New invitation found in database');
        } else {
          console.log('❌ New invitation NOT found in database');
        }
      } else {
        console.log(`❌ Failed to fetch invitations: ${fetchResponse.status}`);
      }
      
    } else {
      const errorText = await response.text();
      console.log('❌ Failed to create invitation');
      console.log(`Error: ${errorText}`);
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testInvitationCreation();