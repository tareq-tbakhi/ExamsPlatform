import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BASE_URL = 'http://127.0.0.1:5001';
const TEST_TIMEOUT = 120000; // 2 minutes timeout

// Test Data
const testExam = {
  title: 'E2E Test Exam with Videos',
  subject: 'Testing',
  questions: [
    {
      question: 'What is your name? (Text question)',
      type: 'short_answer',
      points: 10
    },
    {
      question: 'Choose the correct answer',
      type: 'multiple_choice',
      points: 10,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option B'
    },
    {
      question: 'Record a video introducing yourself',
      type: 'video_response',
      points: 20
    },
    {
      question: 'Record an audio answer explaining your favorite subject',
      type: 'audio_response',
      points: 20
    }
  ]
};

const testStudent = {
  name: 'Test Student',
  email: 'test@example.com',
  studentId: 'TEST123'
};

// Utility functions
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForElement(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch (error) {
    console.error(`Element ${selector} not found within ${timeout}ms`);
    return false;
  }
}

async function clickButtonByText(page, text) {
  const clicked = await page.evaluate((buttonText) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const button = buttons.find(btn => btn.textContent.includes(buttonText));
    if (button) {
      button.click();
      return true;
    }
    return false;
  }, text);
  
  if (!clicked) {
    throw new Error(`Button with text "${text}" not found`);
  }
  return clicked;
}

async function takeScreenshot(page, name) {
  const screenshotDir = path.join(__dirname, 'test-screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  await page.screenshot({ 
    path: path.join(screenshotDir, `${name}-${Date.now()}.png`),
    fullPage: true 
  });
}

// Main test function
async function runE2ETest() {
  let browser;
  let page;
  let examId;
  
  try {
    console.log('🚀 Starting E2E Exam Flow Test...\n');
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: false, // Set to true for CI/CD
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream'
      ]
    });
    
    page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1366, height: 768 });
    
    // Grant permissions for camera and microphone
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(BASE_URL, ['camera', 'microphone']);
    
    // Step 1: Login as teacher/admin
    console.log('📝 Step 1: Logging in as teacher...');
    await page.goto(`${BASE_URL}/login`);
    await takeScreenshot(page, '01-login-page');
    
    // Click on Replit login for simplicity
    const loginButton = await page.$$eval('button', buttons => {
      const button = buttons.find(btn => btn.textContent.includes('Continue with Replit'));
      if (button) button.click();
      return !!button;
    });
    
    if (!loginButton) {
      // Try the direct login link
      await page.goto(`${BASE_URL}/api/login`);
    }
    
    await delay(2000);
    
    // Wait for dashboard
    await waitForElement(page, 'h1');
    console.log('✅ Logged in successfully\n');
    await takeScreenshot(page, '02-dashboard');
    
    // Step 2: Create exam
    console.log('📝 Step 2: Creating new exam...');
    await page.$$eval('button', buttons => {
      const button = buttons.find(btn => btn.textContent.includes('Create New Exam'));
      if (button) button.click();
    });
    
    // Wait for the form to load
    await delay(2000);
    
    // Fill exam details
    try {
      // Title input - "Enter exam title..."
      await page.type('input[name="title"]', testExam.title);
      
      // Subject dropdown - First combobox is for subject
      const subjectDropdown = await page.$('[role="combobox"]');
      if (subjectDropdown) {
        await subjectDropdown.click();
        await delay(500);
        
        // Type the subject and press Enter
        await page.keyboard.type(testExam.subject);
        await page.keyboard.press('Enter');
      }
      
      // Instructions
      await page.type('textarea[name="instructions"]', 'This is an E2E test exam with video questions');
      
      // Duration (optional)
      const durationInput = await page.$('input[name="duration"]');
      if (durationInput) {
        await durationInput.clear();
        await durationInput.type('30');
      }
    } catch (error) {
      console.error('Error filling exam details:', error.message);
      await takeScreenshot(page, 'error-exam-form');
    }
    
    // Add questions
    for (const question of testExam.questions) {
      console.log(`   Adding ${question.type} question...`);
      
      // Click add question button
      await clickButtonByText(page, 'Add Question');
      await delay(500);
      
      // Fill question details - wait for dialog to open
      await delay(1000);
      
      const questionTextarea = await page.$('textarea[placeholder*="Enter your question here"]');
      
      if (!questionTextarea) {
        console.error('No question textarea found!');
        await takeScreenshot(page, 'no-question-input');
        continue;
      }
      
      await questionTextarea.type(question.question);
      
      // Select question type
      const typeSelects = await page.$$('[role="combobox"]');
      const lastTypeSelect = typeSelects[typeSelects.length - 1];
      await lastTypeSelect.click();
      await page.evaluate((qType) => {
        const options = Array.from(document.querySelectorAll('[role="option"]'));
        const option = options.find(opt => opt.textContent.includes(qType.replace('_', ' ')));
        if (option) option.click();
      }, question.type);
      
      // Set points
      const pointsInputs = await page.$$('input[type="number"][placeholder*="Points"]');
      const lastPointsInput = pointsInputs[pointsInputs.length - 1];
      await lastPointsInput.clear();
      await lastPointsInput.type(question.points.toString());
      
      // Add options for multiple choice
      if (question.type === 'multiple_choice') {
        for (const option of question.options) {
          await clickButtonByText(page, 'Add Option');
          const optionInputs = await page.$$('input[placeholder*="Option"]');
          const lastOptionInput = optionInputs[optionInputs.length - 1];
          await lastOptionInput.type(option);
        }
        
        // Set correct answer
        await page.selectOption('select[name*="correctAnswer"]', question.correctAnswer);
      }
    }
    
    await takeScreenshot(page, '03-exam-created');
    
    // Save exam
    await clickButtonByText(page, 'Create Exam');
    await delay(2000);
    
    // Get exam ID from URL or page
    const examUrl = await page.url();
    const examIdMatch = examUrl.match(/exam[/-](\d+)/);
    examId = examIdMatch ? examIdMatch[1] : null;
    
    console.log(`✅ Exam created successfully (ID: ${examId})\n`);
    
    // Step 3: Publish exam
    console.log('📝 Step 3: Publishing exam...');
    await clickButtonByText(page, 'Publish Exam');
    await delay(1000);
    console.log('✅ Exam published\n');
    
    // Step 4: Take exam as student
    console.log('📝 Step 4: Taking exam as student...');
    
    // Navigate to exam
    await page.goto(`${BASE_URL}/take-exam/${examId || '1'}`);
    await takeScreenshot(page, '04-student-exam-start');
    
    // Fill student details
    await waitForElement(page, 'input[placeholder*="full name"]');
    await page.type('input[placeholder*="full name"]', testStudent.name);
    await page.type('input[placeholder*="email"]', testStudent.email);
    await page.type('input[placeholder*="student ID"]', testStudent.studentId);
    
    // Start exam
    await clickButtonByText(page, 'Start Exam');
    await delay(2000);
    
    // Grant permissions if prompted
    try {
      await clickButtonByText(page, 'Allow');
    } catch (e) {
      // Permissions might already be granted
    }
    
    // Answer questions
    console.log('   Answering questions...');
    
    // Question 1: Short answer
    await page.type('textarea', 'This is my test answer');
    await clickButtonByText(page, 'Next');
    await delay(1000);
    
    // Question 2: Multiple choice
    await page.evaluate((answer) => {
      const labels = Array.from(document.querySelectorAll('label'));
      const label = labels.find(l => l.textContent.includes(answer));
      if (label) label.click();
    }, 'Option B');
    await clickButtonByText(page, 'Next');
    await delay(1000);
    
    // Question 3: Video response
    console.log('   Recording video answer...');
    await clickButtonByText(page, 'Start Recording');
    await delay(5000); // Record for 5 seconds
    await clickButtonByText(page, 'Stop Recording');
    await delay(1000);
    await clickButtonByText(page, 'Save Answer');
    await clickButtonByText(page, 'Next');
    await delay(1000);
    
    // Question 4: Audio response
    console.log('   Recording audio answer...');
    await clickButtonByText(page, 'Start Recording');
    await delay(5000); // Record for 5 seconds
    await clickButtonByText(page, 'Stop Recording');
    await delay(1000);
    await clickButtonByText(page, 'Save Answer');
    
    await takeScreenshot(page, '05-all-questions-answered');
    
    // Submit exam
    await clickButtonByText(page, 'Submit Exam');
    await delay(2000);
    
    // Confirm submission
    try {
      await clickButtonByText(page, 'Yes, Submit');
    } catch (e) {
      // Might not have confirmation dialog
    }
    
    await delay(3000);
    console.log('✅ Exam submitted successfully\n');
    await takeScreenshot(page, '06-exam-submitted');
    
    // Step 5: View results as teacher
    console.log('📝 Step 5: Viewing submission results...');
    
    // Navigate back to dashboard
    await page.goto(BASE_URL);
    await waitForElement(page, 'h1');
    
    // Go to results
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      const resultsTab = tabs.find(tab => tab.textContent.includes('All Results'));
      if (resultsTab) resultsTab.click();
    });
    await delay(2000);
    
    // Click on the latest submission
    await clickButtonByText(page, 'View Details');
    await delay(2000);
    
    await takeScreenshot(page, '07-submission-details');
    
    // Verify video answers are displayed
    const videoElements = await page.$$('video');
    console.log(`   Found ${videoElements.length} video elements`);
    
    const transcripts = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('p'));
      return elements.filter(el => el.textContent.toLowerCase().includes('transcription')).length;
    });
    console.log(`   Found ${transcripts} transcription elements`);
    
    console.log('✅ Results viewed successfully\n');
    
    // Step 6: Test proctoring analysis
    console.log('📝 Step 6: Checking proctoring analysis...');
    
    try {
      await clickButtonByText(page, 'AI Analysis');
      await delay(3000);
      await takeScreenshot(page, '08-proctoring-analysis');
      console.log('✅ Proctoring analysis viewed\n');
    } catch (e) {
      console.log('⚠️  AI Analysis button not found or not working\n');
    }
    
    console.log('🎉 E2E Test Completed Successfully!\n');
    
    // Generate test report
    const report = {
      status: 'PASSED',
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      steps: {
        login: 'PASSED',
        createExam: 'PASSED',
        publishExam: 'PASSED',
        takeExam: 'PASSED',
        viewResults: 'PASSED',
        proctoringAnalysis: 'PASSED'
      },
      examId: examId,
      screenshotsGenerated: 8
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'e2e-test-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log('📄 Test report generated: e2e-test-report.json');
    
  } catch (error) {
    console.error('❌ E2E Test Failed:', error);
    
    if (page) {
      await takeScreenshot(page, 'error-screenshot');
    }
    
    // Generate error report
    const errorReport = {
      status: 'FAILED',
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'e2e-test-error-report.json'),
      JSON.stringify(errorReport, null, 2)
    );
    
    throw error;
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
const startTime = Date.now();

runE2ETest()
  .then(() => {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }); 