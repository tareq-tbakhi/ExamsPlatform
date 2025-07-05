# 🧪 ExamsPlatform E2E Testing Guide

This guide provides comprehensive instructions for running end-to-end tests on the ExamsPlatform.

## 📋 Prerequisites

1. **Node.js** (v18+ recommended)
2. **Running Application**: Ensure the app is running on `http://localhost:5001`
3. **Puppeteer**: Already installed as dev dependency

## 🚀 Quick Start

### Running Tests

```bash
# Quick test (basic features)
npm run test:quick

# Comprehensive test (all features)
npm run test:comprehensive

# Default e2e test
npm run test:e2e
```

## 📊 Test Coverage

### Quick Test (`quick-e2e-test.cjs`)
Tests core functionality in ~30 seconds:
- ✅ Homepage loading
- ✅ Authentication flow
- ✅ Dashboard access
- ✅ Basic exam creation
- ✅ Results page
- ✅ Google TTS demo
- ✅ Admin interface
- ✅ Student login page

### Comprehensive Test (`comprehensive-e2e-test.cjs`)
Full feature testing (~5 minutes):

#### 1. **Authentication & User Management**
- Super Admin login
- User invitation system
- Role-based access control
- Session management

#### 2. **Exam Creation & Management**
- Create new exam
- Set exam parameters
- Configure instructions
- Publish/draft status

#### 3. **AI-Powered Features**
- AI question generation (GPT-4)
- Multi-type question selection
- Bilingual support
- Voice input testing

#### 4. **Question Types**
- Multiple Choice
- True/False
- Short Answer
- Essay
- Audio Response
- Video Response
- Coding (infrastructure ready)

#### 5. **Proctoring & Security**
- Camera settings
- Screen recording
- Face detection
- Tab switch detection
- Full-screen enforcement
- Multi-monitor detection

#### 6. **Student Management**
- Individual invitations
- Bulk CSV import
- Registration numbers
- Email notifications

#### 7. **Student Experience**
- Login flow
- Exam access
- Question navigation
- Media recording
- Submission process

#### 8. **Results & Analytics**
- Results dashboard
- Submission tracking
- Score calculation
- Pass/fail status

#### 9. **Monitoring Dashboard**
- Overview tab
- Questions & Answers
- Proctoring Analysis
- Media Responses

#### 10. **Voice & TTS**
- Google TTS integration
- Arabic voice synthesis
- Multiple voice options
- Audio playback

#### 11. **Advanced Features**
- Bulk user import
- Export functionality
- Report generation

#### 12. **Performance Testing**
- Page load times
- Concurrent operations
- API response times

#### 13. **Security Testing**
- XSS prevention
- SQL injection prevention
- CSRF protection
- Input validation

#### 14. **Accessibility**
- Keyboard navigation
- RTL support
- Screen reader compatibility

#### 15. **Error Handling**
- Network errors
- Invalid inputs
- Timeout handling
- Recovery mechanisms

## 📁 Test Output

### Screenshots
All test screenshots are saved in:
```
./e2e-screenshots/
```

### Test Report
HTML report generated at:
```
./e2e-test-report.html
```

## 🛠️ Customization

### Modify Test Configuration

Edit test files to change:
```javascript
const BASE_URL = 'http://localhost:5001'; // Change URL
const TEST_TIMEOUT = 300000; // Change timeout
```

### Run in Headless Mode

For CI/CD, change in test files:
```javascript
browser = await puppeteer.launch({
  headless: true, // Set to true for CI
  // ...
});
```

## 🔍 Debugging Tests

### Run with Visual Browser
```javascript
headless: false // Shows browser window
```

### Add Delays
```javascript
await delay(2000); // Wait 2 seconds
```

### Take Screenshots
```javascript
await takeScreenshot(page, 'debug-point');
```

## 📈 Test Results Interpretation

### Success Indicators
- ✅ **80%+ Pass Rate**: System is stable
- ✅ **All Core Features Pass**: Ready for production
- ✅ **Performance Tests Pass**: Good user experience

### Failure Analysis
- ❌ **Auth Failures**: Check login system
- ❌ **AI Failures**: Verify API keys
- ❌ **Media Failures**: Check permissions
- ❌ **Performance Failures**: Optimize code

## 🚨 Common Issues

### 1. Puppeteer Installation
```bash
npm install --save-dev puppeteer
```

### 2. Timeout Errors
Increase timeout in test configuration:
```javascript
page.setDefaultTimeout(60000); // 60 seconds
```

### 3. Selector Not Found
Update selectors to match current UI:
```javascript
await page.waitForSelector('button:has-text("Create Exam")');
```

### 4. Permission Errors
Run with proper permissions:
```bash
sudo npm run test:e2e
```

## 🔄 Continuous Integration

### GitHub Actions Example
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run build
      - run: npm start &
      - run: npm run test:e2e
```

## 📊 Test Metrics

### Coverage Goals
- **Authentication**: 100%
- **Core Features**: 95%+
- **AI Features**: 90%+
- **Security**: 100%
- **Performance**: 85%+

### Performance Benchmarks
- Homepage Load: < 2s
- Dashboard Load: < 3s
- API Responses: < 500ms
- Media Upload: < 10s

## 🎯 Best Practices

1. **Run tests regularly** - After each major change
2. **Keep tests updated** - Match UI changes
3. **Monitor performance** - Track load times
4. **Test all browsers** - Chrome, Firefox, Safari
5. **Test mobile views** - Responsive design
6. **Clean test data** - Reset between runs

## 📞 Support

For test-related issues:
1. Check console errors
2. Review screenshots
3. Verify selectors
4. Check network tab
5. Review test logs

## 🔗 Related Documentation

- [Feature Summary](./FEATURE_SUMMARY.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [API Documentation](./API_DOCS.md)
- [Security Guide](./SECURITY_GUIDE.md) 