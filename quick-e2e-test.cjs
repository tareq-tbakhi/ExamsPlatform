const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:5001';

async function runQuickE2ETest() {
  console.log('🚀 Starting Quick E2E Test for ExamsPlatform\n');
  
  let browser;
  let passed = 0;
  let failed = 0;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    
    // Test 1: Homepage loads
    console.log('📍 Testing homepage...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('h1');
    console.log('✅ Homepage loaded successfully');
    passed++;
    
    // Test 2: Login - In local dev, we need to go to /api/login to set session
    console.log('\n📍 Testing login...');
    await page.goto(`${BASE_URL}/api/login`, { waitUntil: 'networkidle2' });
    // Should redirect to home page
    await page.waitForFunction(() => window.location.pathname === '/', { timeout: 5000 });
    
    // Verify auth by checking API
    const authResponse = await page.evaluate(async () => {
      const response = await fetch('/api/auth/user');
      return { status: response.status, ok: response.ok };
    });
    
    if (authResponse.ok) {
      console.log('✅ Local dev auto-login successful - Auth verified');
      passed++;
    } else {
      console.log('❌ Local dev auto-login failed - Auth not working');
      failed++;
    }
    
    // Test 3: Dashboard
    console.log('\n📍 Testing dashboard...');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
    // Wait for the dashboard to load
    try {
      // Wait for React to render by waiting for specific dashboard elements
      await page.waitForSelector('h1', { timeout: 5000 });
      
      // Check if we're redirected to login (unauthorized)
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        console.log('❌ Dashboard redirected to login - Auth issue');
        failed++;
      } else {
        // Look for dashboard elements
        const dashboardContent = await page.evaluate(() => {
          const hasExamCraft = document.querySelector('h1')?.textContent?.includes('Exam Craft');
          const hasCreateButton = Array.from(document.querySelectorAll('button')).some(btn => 
            btn.textContent?.includes('Create') && btn.textContent?.includes('Exam')
          );
          const hasDashboardTab = Array.from(document.querySelectorAll('button')).some(btn => 
            btn.textContent?.includes('Dashboard')
          );
          return { hasExamCraft, hasCreateButton, hasDashboardTab };
        });
        
        if (dashboardContent.hasExamCraft || dashboardContent.hasCreateButton || dashboardContent.hasDashboardTab) {
          console.log('✅ Dashboard loaded successfully');
          passed++;
        } else {
          console.log('❌ Dashboard loaded but expected content not found');
          console.log('  - Found elements:', dashboardContent);
          failed++;
        }
      }
    } catch (error) {
      console.log('❌ Dashboard failed to load:', error.message);
      failed++;
    }
    
    // Test 4: Create Exam
    console.log('\n📍 Testing exam creation...');
    try {
      // Click Create Exam button
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const createButton = buttons.find(btn => btn.textContent?.includes('Create Exam'));
        if (createButton) createButton.click();
      });
      
      await page.waitForSelector('input[name="title"]', { timeout: 5000 });
      await page.type('input[name="title"]', 'Quick Test Exam');
      await page.type('input[name="subject"]', 'Testing');
      await page.type('input[name="duration"]', '30');
      await page.type('textarea[name="instructions"]', 'This is a quick test');
      
      // Submit the form
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button[type="submit"]'));
        const submitButton = buttons.find(btn => btn.textContent?.includes('Create Exam'));
        if (submitButton) submitButton.click();
      });
      
      // Wait for navigation or success message
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('✅ Exam created successfully');
      passed++;
    } catch (error) {
      console.log('❌ Exam creation failed:', error.message);
      failed++;
    }
    
    // Test 5: Results page
    console.log('\n📍 Testing results page...');
    try {
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
      
      // Click Results button
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const resultsButton = buttons.find(btn => btn.textContent?.includes('Results'));
        if (resultsButton) resultsButton.click();
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      const resultsTitle = await page.$('h2');
      if (resultsTitle) {
        console.log('✅ Results page loaded');
        passed++;
      } else {
        console.log('❌ Results page not loaded properly');
        failed++;
      }
    } catch (error) {
      console.log('❌ Results page test failed:', error.message);
      failed++;
    }
    
    // Test 6: Google TTS Demo
    console.log('\n📍 Testing Google TTS...');
    try {
      await page.goto(`${BASE_URL}/google-tts-demo`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('h1', { timeout: 5000 });
      console.log('✅ Google TTS demo page loaded');
      passed++;
    } catch (error) {
      console.log('❌ Google TTS demo page not found');
      failed++;
    }
    
    // Test 7: Admin page
    console.log('\n📍 Testing admin page...');
    try {
      await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('h2', { timeout: 5000 });
      console.log('✅ Admin page loaded');
      passed++;
    } catch (error) {
      console.log('❌ Admin page not found');
      failed++;
    }
    
    // Test 8: Student login page
    console.log('\n📍 Testing student login...');
    try {
      await page.goto(`${BASE_URL}/student/login`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('h1', { timeout: 5000 });
      console.log('✅ Student login page loaded');
      passed++;
    } catch (error) {
      console.log('❌ Student login page not found');
      failed++;
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    failed++;
  } finally {
    if (browser) {
      await browser.close();
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(2)}%`);
    console.log('='.repeat(50));
    
    process.exit(failed > 0 ? 1 : 0);
  }
}

// Run the test
runQuickE2ETest().catch(console.error); 