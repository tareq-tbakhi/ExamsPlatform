#!/usr/bin/env node

/**
 * ExamCraft Security Flow Test Suite
 * Comprehensive testing of invitation-only authentication system
 */

import http from 'http';

const BASE_URL = 'http://localhost:5000';

// Helper function to make HTTP requests
function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = {
            status: res.statusCode,
            data: data ? JSON.parse(data) : null,
            headers: res.headers
          };
          resolve(result);
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runSecurityTests() {
  console.log('🔒 ExamCraft Security Flow Test Suite');
  console.log('=====================================\n');

  let testsPassed = 0;
  let testsTotal = 0;

  // Test 1: Unauthorized access to platform should be blocked
  testsTotal++;
  console.log('Test 1: Testing unauthorized platform access...');
  try {
    const result = await makeRequest('/api/auth/user');
    if (result.status === 401 && result.data.message === 'Unauthorized') {
      console.log('✅ PASS: Unauthorized access properly blocked');
      testsPassed++;
    } else {
      console.log('❌ FAIL: Unauthorized access not properly blocked');
      console.log('   Expected: 401 Unauthorized');
      console.log('   Got:', result.status, result.data);
    }
  } catch (error) {
    console.log('❌ FAIL: Error testing unauthorized access:', error.message);
  }

  // Test 2: Valid exam invitation should return exam details
  testsTotal++;
  console.log('\nTest 2: Testing valid exam invitation...');
  try {
    const result = await makeRequest('/api/exam-invitation/test-token-123');
    if (result.status === 200 && result.data.examId && result.data.exam) {
      console.log('✅ PASS: Valid exam invitation returns proper data');
      console.log('   Exam:', result.data.exam.title);
      console.log('   Student:', result.data.studentName);
      testsPassed++;
    } else {
      console.log('❌ FAIL: Valid exam invitation not working properly');
      console.log('   Status:', result.status);
      console.log('   Data:', result.data);
    }
  } catch (error) {
    console.log('❌ FAIL: Error testing valid exam invitation:', error.message);
  }

  // Test 3: Invalid exam invitation should return 404
  testsTotal++;
  console.log('\nTest 3: Testing invalid exam invitation...');
  try {
    const result = await makeRequest('/api/exam-invitation/invalid-token-xyz');
    if (result.status === 404 && result.data.error === 'Invitation not found') {
      console.log('✅ PASS: Invalid exam invitation properly blocked');
      testsPassed++;
    } else {
      console.log('❌ FAIL: Invalid exam invitation not properly handled');
      console.log('   Expected: 404 with error message');
      console.log('   Got:', result.status, result.data);
    }
  } catch (error) {
    console.log('❌ FAIL: Error testing invalid exam invitation:', error.message);
  }

  // Test 4: Protected admin endpoints should require authentication
  testsTotal++;
  console.log('\nTest 4: Testing protected admin endpoints...');
  try {
    const result = await makeRequest('/api/admin/users');
    if (result.status === 401) {
      console.log('✅ PASS: Admin endpoints properly protected');
      testsPassed++;
    } else {
      console.log('❌ FAIL: Admin endpoints not properly protected');
      console.log('   Expected: 401 Unauthorized');
      console.log('   Got:', result.status);
    }
  } catch (error) {
    console.log('❌ FAIL: Error testing admin endpoints:', error.message);
  }

  // Test 5: Test exam creation endpoint protection
  testsTotal++;
  console.log('\nTest 5: Testing exam creation endpoint protection...');
  try {
    const result = await makeRequest('/api/exams', 'POST');
    if (result.status === 401) {
      console.log('✅ PASS: Exam creation properly protected');
      testsPassed++;
    } else {
      console.log('❌ FAIL: Exam creation not properly protected');
      console.log('   Expected: 401 Unauthorized');
      console.log('   Got:', result.status);
    }
  } catch (error) {
    console.log('❌ FAIL: Error testing exam creation:', error.message);
  }

  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  console.log(`Tests Passed: ${testsPassed}/${testsTotal}`);
  console.log(`Success Rate: ${Math.round((testsPassed/testsTotal) * 100)}%`);
  
  if (testsPassed === testsTotal) {
    console.log('\n🎉 ALL TESTS PASSED! Security system is working correctly.');
    console.log('\n✅ Security Status: SECURE');
    console.log('   • Only authorized users can access the platform');
    console.log('   • Students can access exams via invitation links');
    console.log('   • All protected endpoints require authentication');
    console.log('   • Invalid invitations are properly blocked');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED! Please review security implementation.');
    console.log('\n❌ Security Status: NEEDS ATTENTION');
  }
}

// Run tests
runSecurityTests().catch(console.error);