#!/usr/bin/env node
/**
 * ExamCraft Platform - Deployment Health Check Script
 * Verifies all systems are ready for production deployment
 */

console.log('🚀 ExamCraft Deployment Health Check\n');

const checks = [
  {
    name: 'Environment Variables',
    check: () => {
      const required = ['DATABASE_URL', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'SESSION_SECRET'];
      const missing = required.filter(key => !process.env[key]);
      if (missing.length > 0) {
        throw new Error(`Missing: ${missing.join(', ')}`);
      }
      return `All ${required.length} required variables present`;
    }
  },
  {
    name: 'Package Configuration',
    check: () => {
      try {
        const packageJson = require('./package.json');
        const scripts = packageJson.scripts || {};
        if (!scripts.build || !scripts.start) {
          throw new Error('Missing build or start scripts');
        }
        return 'Package scripts configured correctly';
      } catch (error) {
        throw new Error('Package.json validation failed');
      }
    }
  },
  {
    name: 'Node.js Version',
    check: () => {
      const version = process.version;
      const major = parseInt(version.split('.')[0].slice(1));
      if (major < 18) {
        throw new Error(`Node.js ${version} too old, requires 18+`);
      }
      return `Node.js ${version} compatible`;
    }
  },
  {
    name: 'Required Files',
    check: () => {
      const fs = require('fs');
      const required = ['.replit', 'package.json', 'vite.config.ts', 'drizzle.config.ts'];
      const missing = required.filter(file => !fs.existsSync(file));
      if (missing.length > 0) {
        throw new Error(`Missing files: ${missing.join(', ')}`);
      }
      return 'All required files present';
    }
  }
];

function runChecks() {
  let passed = 0;
  let failed = 0;

  for (const { name, check } of checks) {
    try {
      const result = check();
      console.log(`✅ ${name}: ${result}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All checks passed! Ready for deployment.');
    console.log('\n🚀 Next steps:');
    console.log('1. Click the "Deploy" button in Replit');
    console.log('2. Select "Autoscale" deployment target');
    console.log('3. Wait for build and deployment to complete');
    console.log('4. Verify your app is accessible at the provided URL');
  } else {
    console.log('⚠️  Some checks failed. Please fix issues before deployment.');
  }
}

runChecks();