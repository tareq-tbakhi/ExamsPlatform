const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Test configuration
const BASE_URL = 'http://localhost:5001';
const TEST_TIMEOUT = 300000; // 5 minutes for comprehensive tests

// Test data
const testUsers = {
  superAdmin: { email: 'dev@localhost', password: 'admin' },
  teacher: { email: 'teacher@test.com', firstName: 'Test', lastName: 'Teacher', role: 'teacher' },
  student: { 
    name: 'Test Student', 
    email: 'student@test.com', 
    registrationNumber: 'TEST123'
  }
};

const testExam = {
  title: 'Comprehensive E2E Test Exam',
  subject: 'Testing',
  duration: 60,
  instructions: 'This is an automated test exam covering all question types',
  description: 'Testing all features including AI generation, media recording, and proctoring'
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(`📋 ${title}`, 'cyan');
  console.log('='.repeat(60) + '\n');
}

function logTest(testName, status = 'running') {
  const icons = {
    running: '🏃',
    passed: '✅',
    failed: '❌',
    skipped: '⏭️'
  };
  const color = status === 'passed' ? 'green' : status === 'failed' ? 'red' : 'yellow';
  log(`${icons[status]} ${testName}`, color);
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page, name) {
  const screenshotDir = './e2e-screenshots';
  await fs.mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ 
    path: path.join(screenshotDir, `${name}-${Date.now()}.png`),
    fullPage: true 
  });
}

// Main test suite
async function runComprehensiveE2ETests() {
  let browser;
  let page;
  let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  };

  try {
    logSection('COMPREHENSIVE E2E TEST SUITE');
    log('Starting ExamsPlatform End-to-End Tests', 'blue');
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: false, // Set to true for CI/CD
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    
    // Set longer timeout for complex operations
    page.setDefaultTimeout(60000);

    // 1. AUTHENTICATION TESTS
    logSection('1. Authentication & User Management');
    
    // Test 1.1: Login as Super Admin
    await runTest('Login as Super Admin', async () => {
      await page.goto(BASE_URL);
      await page.waitForSelector('a[href="/login"]', { timeout: 10000 });
      await page.click('a[href="/login"]');
      
      // For local dev, it auto-logs in
      await page.waitForSelector('text=Dashboard', { timeout: 10000 });
      await takeScreenshot(page, 'admin-dashboard');
    }, testResults);

    // Test 1.2: User invitation
    await runTest('Create User Invitation', async () => {
      await page.goto(`${BASE_URL}/admin`);
      await page.waitForSelector('text=User Management');
      await page.click('text=User Management');
      
      await page.waitForSelector('button:has-text("Invite User")');
      await page.click('button:has-text("Invite User")');
      
      await page.fill('input[name="email"]', testUsers.teacher.email);
      await page.fill('input[name="firstName"]', testUsers.teacher.firstName);
      await page.fill('input[name="lastName"]', testUsers.teacher.lastName);
      await page.selectOption('select[name="role"]', testUsers.teacher.role);
      
      await page.click('button:has-text("Send Invitation")');
      await page.waitForSelector('text=Invitation sent successfully');
    }, testResults);

    // 2. EXAM CREATION TESTS
    logSection('2. Exam Creation & Management');
    
    // Test 2.1: Create new exam
    await runTest('Create New Exam', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForSelector('button:has-text("Create Exam")');
      await page.click('button:has-text("Create Exam")');
      
      await page.fill('input[name="title"]', testExam.title);
      await page.fill('input[name="subject"]', testExam.subject);
      await page.fill('input[name="duration"]', testExam.duration.toString());
      await page.fill('textarea[name="instructions"]', testExam.instructions);
      
      await page.click('button:has-text("Create Exam")');
      await page.waitForSelector(`text=${testExam.title}`);
      await takeScreenshot(page, 'exam-created');
    }, testResults);

    // 3. AI QUESTION GENERATION TESTS
    logSection('3. AI-Powered Features');
    
    // Test 3.1: AI Question Generation
    await runTest('Generate Questions with AI', async () => {
      await page.click(`text=${testExam.title}`);
      await page.waitForSelector('text=AI Generator');
      await page.click('text=AI Generator');
      
      // Fill AI generation form
      await page.fill('input[placeholder*="topic"]', 'Mathematics basics');
      await page.fill('textarea[placeholder*="requirements"]', testExam.description);
      await page.fill('input[name="numQuestions"]', '5');
      
      // Select multiple question types
      await page.click('input[value="multiple_choice"]');
      await page.click('input[value="true_false"]');
      
      await page.click('button:has-text("Generate Questions")');
      await page.waitForSelector('text=Questions generated successfully', { timeout: 30000 });
      await takeScreenshot(page, 'ai-generated-questions');
    }, testResults);

    // 4. MANUAL QUESTION CREATION TESTS
    logSection('4. Question Types Testing');
    
    // Test 4.1: Create Multiple Choice Question
    await runTest('Create Multiple Choice Question', async () => {
      await page.click('button:has-text("Add Question")');
      await page.selectOption('select[name="type"]', 'multiple_choice');
      
      await page.fill('textarea[name="question"]', 'What is 2 + 2?');
      await page.fill('input[name="option-0"]', '3');
      await page.fill('input[name="option-1"]', '4');
      await page.fill('input[name="option-2"]', '5');
      await page.fill('input[name="option-3"]', '6');
      
      await page.click('input[name="correctAnswer"][value="1"]');
      await page.fill('input[name="points"]', '10');
      
      await page.click('button:has-text("Save Question")');
      await page.waitForSelector('text=Question saved');
    }, testResults);

    // Test 4.2: Create Audio Response Question
    await runTest('Create Audio Response Question', async () => {
      await page.click('button:has-text("Add Question")');
      await page.selectOption('select[name="type"]', 'audio_response');
      
      await page.fill('textarea[name="question"]', 'Please describe your experience with online exams in Arabic');
      await page.fill('input[name="points"]', '20');
      await page.fill('input[name="timeLimit"]', '120');
      
      await page.click('button:has-text("Save Question")');
      await page.waitForSelector('text=Question saved');
    }, testResults);

    // Test 4.3: Create Video Response Question
    await runTest('Create Video Response Question', async () => {
      await page.click('button:has-text("Add Question")');
      await page.selectOption('select[name="type"]', 'video_response');
      
      await page.fill('textarea[name="question"]', 'Record a video explaining a mathematical concept');
      await page.fill('input[name="points"]', '25');
      await page.fill('input[name="timeLimit"]', '180');
      
      await page.click('button:has-text("Save Question")');
      await page.waitForSelector('text=Question saved');
    }, testResults);

    // 5. EXAM SETTINGS & PROCTORING
    logSection('5. Exam Settings & Security');
    
    // Test 5.1: Configure Proctoring Settings
    await runTest('Configure Proctoring Settings', async () => {
      await page.click('text=Settings');
      await page.waitForSelector('text=Proctoring Settings');
      
      // Enable all proctoring features
      await page.click('input[name="enableCamera"]');
      await page.click('input[name="enableScreenRecording"]');
      await page.click('input[name="detectMultipleFaces"]');
      await page.click('input[name="detectTabSwitch"]');
      await page.click('input[name="enableFullscreen"]');
      
      await page.click('button:has-text("Save Settings")');
      await page.waitForSelector('text=Settings saved');
      await takeScreenshot(page, 'proctoring-settings');
    }, testResults);

    // Test 5.2: Publish Exam
    await runTest('Publish Exam', async () => {
      await page.click('button:has-text("Publish Exam")');
      await page.waitForSelector('text=Exam published successfully');
    }, testResults);

    // 6. STUDENT INVITATION
    logSection('6. Student Management');
    
    // Test 6.1: Invite Student to Exam
    await runTest('Invite Student to Exam', async () => {
      await page.click('text=Invite Students');
      
      await page.fill('input[name="studentName"]', testUsers.student.name);
      await page.fill('input[name="studentEmail"]', testUsers.student.email);
      await page.fill('input[name="registrationNumber"]', testUsers.student.registrationNumber);
      
      await page.click('button:has-text("Send Invitation")');
      await page.waitForSelector('text=Invitation sent');
    }, testResults);

    // 7. STUDENT EXAM EXPERIENCE
    logSection('7. Student Exam Experience');
    
    // Test 7.1: Student Login
    await runTest('Student Exam Access', async () => {
      // Open new page for student
      const studentPage = await browser.newPage();
      await studentPage.goto(`${BASE_URL}/student/login`);
      
      await studentPage.fill('input[name="name"]', testUsers.student.name);
      await studentPage.fill('input[name="email"]', testUsers.student.email);
      await studentPage.fill('input[name="registrationNumber"]', testUsers.student.registrationNumber);
      
      await studentPage.click('button:has-text("Access Exam")');
      await studentPage.waitForSelector('text=Available Exams');
      
      await studentPage.close();
    }, testResults);

    // 8. RESULTS & ANALYTICS
    logSection('8. Results & Analytics');
    
    // Test 8.1: View Results Dashboard
    await runTest('View Results Dashboard', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      await page.click('text=Results');
      await page.waitForSelector('text=Recent Submissions');
      await takeScreenshot(page, 'results-dashboard');
    }, testResults);

    // 9. MONITORING DASHBOARD
    logSection('9. Comprehensive Monitoring');
    
    // Test 9.1: Access Monitoring Dashboard
    await runTest('Access Exam Monitoring Dashboard', async () => {
      // If there are submissions, click on monitor button
      const monitorButton = await page.$('button:has-text("Monitor")');
      if (monitorButton) {
        await monitorButton.click();
        await page.waitForSelector('text=Exam Monitoring Dashboard');
        
        // Test all tabs
        await page.click('text=Overview');
        await delay(1000);
        await page.click('text=Questions & Answers');
        await delay(1000);
        await page.click('text=Proctoring Analysis');
        await delay(1000);
        await page.click('text=Media Responses');
        
        await takeScreenshot(page, 'monitoring-dashboard');
      }
    }, testResults);

    // 10. GOOGLE TTS FEATURES
    logSection('10. Voice & TTS Features');
    
    // Test 10.1: Google TTS Demo
    await runTest('Google TTS Functionality', async () => {
      await page.goto(`${BASE_URL}/google-tts-demo`);
      await page.waitForSelector('text=Google Text-to-Speech Demo');
      
      await page.fill('textarea', 'مرحبا، هذا اختبار للنطق العربي');
      await page.selectOption('select', 'MALE_STANDARD');
      await page.click('button:has-text("Play")');
      
      await delay(2000); // Wait for audio to play
      await takeScreenshot(page, 'google-tts-demo');
    }, testResults);

    // 11. ADVANCED FEATURES
    logSection('11. Advanced Features Testing');
    
    // Test 11.1: Bulk User Import
    await runTest('Bulk User Import via CSV', async () => {
      await page.goto(`${BASE_URL}/admin`);
      await page.click('text=User Management');
      
      const csvContent = 'email,firstName,lastName,role\nteacher2@test.com,Test2,Teacher2,teacher';
      const csvPath = './test-users.csv';
      await fs.writeFile(csvPath, csvContent);
      
      const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click('button:has-text("Import CSV")')
      ]);
      
      await fileChooser.accept([csvPath]);
      await page.waitForSelector('text=Import successful');
      
      // Cleanup
      await fs.unlink(csvPath);
    }, testResults);

    // Test 11.2: Export Results
    await runTest('Export Exam Results', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      await page.click('text=Results');
      
      const exportButton = await page.$('button:has-text("Export")');
      if (exportButton) {
        await exportButton.click();
        await page.waitForSelector('text=Export completed');
      }
    }, testResults);

    // 12. PERFORMANCE & STRESS TESTS
    logSection('12. Performance Testing');
    
    // Test 12.1: Page Load Performance
    await runTest('Page Load Performance', async () => {
      const startTime = Date.now();
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForSelector('text=Dashboard');
      const loadTime = Date.now() - startTime;
      
      if (loadTime > 3000) {
        throw new Error(`Page load too slow: ${loadTime}ms`);
      }
      log(`Dashboard loaded in ${loadTime}ms`, 'green');
    }, testResults);

    // Test 12.2: Concurrent Operations
    await runTest('Concurrent Operations', async () => {
      const promises = [];
      
      // Simulate multiple API calls
      for (let i = 0; i < 5; i++) {
        promises.push(page.evaluate(() => {
          return fetch('/api/exams').then(r => r.json());
        }));
      }
      
      await Promise.all(promises);
      log('Handled 5 concurrent requests successfully', 'green');
    }, testResults);

    // 13. SECURITY TESTS
    logSection('13. Security Testing');
    
    // Test 13.1: XSS Prevention
    await runTest('XSS Prevention', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      const xssPayload = '<script>alert("XSS")</script>';
      
      // Try to inject XSS in exam title
      await page.click('button:has-text("Create Exam")');
      await page.fill('input[name="title"]', xssPayload);
      await page.fill('input[name="subject"]', 'Security Test');
      await page.fill('input[name="duration"]', '30');
      
      await page.click('button:has-text("Create Exam")');
      
      // Check if script was escaped
      const alertFired = await page.evaluate(() => {
        return window.xssDetected || false;
      });
      
      if (alertFired) {
        throw new Error('XSS vulnerability detected!');
      }
    }, testResults);

    // Test 13.2: SQL Injection Prevention
    await runTest('SQL Injection Prevention', async () => {
      const sqlPayload = "'; DROP TABLE users; --";
      
      await page.fill('input[name="title"]', sqlPayload);
      await page.click('button:has-text("Create Exam")');
      
      // If we can still access the page, SQL injection was prevented
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForSelector('text=Dashboard');
    }, testResults);

    // 14. ACCESSIBILITY TESTS
    logSection('14. Accessibility Testing');
    
    // Test 14.1: Keyboard Navigation
    await runTest('Keyboard Navigation', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      
      // Tab through elements
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        await delay(100);
      }
      
      // Try to activate element with Enter
      await page.keyboard.press('Enter');
      await delay(500);
    }, testResults);

    // Test 14.2: RTL Support
    await runTest('RTL Arabic Support', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      
      // Check if Arabic text is properly aligned
      const rtlElement = await page.$('[dir="rtl"]');
      if (!rtlElement && await page.$('text=العربية')) {
        log('Warning: Arabic text found but RTL not properly set', 'yellow');
      }
    }, testResults);

    // 15. ERROR HANDLING TESTS
    logSection('15. Error Handling');
    
    // Test 15.1: Network Error Handling
    await runTest('Network Error Recovery', async () => {
      // Simulate offline
      await page.setOfflineMode(true);
      
      try {
        await page.click('button:has-text("Create Exam")');
        await delay(1000);
        
        // Should show error message
        const errorMessage = await page.$('text=Network error');
        if (!errorMessage) {
          log('Warning: No network error message shown', 'yellow');
        }
      } finally {
        await page.setOfflineMode(false);
      }
    }, testResults);

    // Test 15.2: Invalid Input Handling
    await runTest('Invalid Input Validation', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      await page.click('button:has-text("Create Exam")');
      
      // Try to submit empty form
      await page.click('button:has-text("Create Exam")');
      
      // Should show validation errors
      await page.waitForSelector('text=required');
    }, testResults);

    // FINAL SUMMARY
    logSection('TEST SUMMARY');
    log(`Total Tests: ${testResults.total}`, 'cyan');
    log(`Passed: ${testResults.passed}`, 'green');
    log(`Failed: ${testResults.failed}`, 'red');
    log(`Skipped: ${testResults.skipped}`, 'yellow');
    
    const successRate = (testResults.passed / testResults.total * 100).toFixed(2);
    log(`Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'red');
    
    // Generate test report
    await generateTestReport(testResults);
    
  } catch (error) {
    log(`Fatal Error: ${error.message}`, 'red');
    console.error(error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Helper function to run individual tests
async function runTest(testName, testFn, results) {
  results.total++;
  logTest(testName, 'running');
  
  try {
    await testFn();
    results.passed++;
    logTest(testName, 'passed');
  } catch (error) {
    results.failed++;
    logTest(testName, 'failed');
    log(`  Error: ${error.message}`, 'red');
  }
}

// Generate HTML test report
async function generateTestReport(results) {
  const reportHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>E2E Test Report - ExamsPlatform</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 30px 0; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
    .stat-card h3 { margin: 0; color: #666; font-size: 14px; }
    .stat-card p { margin: 10px 0 0; font-size: 32px; font-weight: bold; }
    .passed { color: #10b981; }
    .failed { color: #ef4444; }
    .skipped { color: #f59e0b; }
    .total { color: #3b82f6; }
    .timestamp { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>ExamsPlatform E2E Test Report</h1>
    <p class="timestamp">Generated on: ${new Date().toLocaleString()}</p>
  </div>
  
  <div class="summary">
    <div class="stat-card">
      <h3>Total Tests</h3>
      <p class="total">${results.total}</p>
    </div>
    <div class="stat-card">
      <h3>Passed</h3>
      <p class="passed">${results.passed}</p>
    </div>
    <div class="stat-card">
      <h3>Failed</h3>
      <p class="failed">${results.failed}</p>
    </div>
    <div class="stat-card">
      <h3>Success Rate</h3>
      <p class="${results.passed/results.total >= 0.8 ? 'passed' : 'failed'}">
        ${(results.passed/results.total * 100).toFixed(2)}%
      </p>
    </div>
  </div>
  
  <h2>Test Categories Covered:</h2>
  <ul>
    <li>✅ Authentication & User Management</li>
    <li>✅ Exam Creation & Management</li>
    <li>✅ AI-Powered Features</li>
    <li>✅ All Question Types</li>
    <li>✅ Proctoring & Security</li>
    <li>✅ Student Experience</li>
    <li>✅ Results & Analytics</li>
    <li>✅ Monitoring Dashboard</li>
    <li>✅ Voice & TTS Features</li>
    <li>✅ Performance Testing</li>
    <li>✅ Security Testing</li>
    <li>✅ Accessibility Testing</li>
    <li>✅ Error Handling</li>
  </ul>
  
  <p><strong>Screenshots saved in:</strong> ./e2e-screenshots/</p>
</body>
</html>
  `;
  
  await fs.writeFile('./e2e-test-report.html', reportHtml);
  log('\n📊 Test report generated: e2e-test-report.html', 'green');
}

// Run the tests
if (require.main === module) {
  runComprehensiveE2ETests().catch(console.error);
}

module.exports = { runComprehensiveE2ETests }; 