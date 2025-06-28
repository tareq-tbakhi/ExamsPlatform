/**
 * Direct Email Test using tsx
 */

import { MailService } from '@sendgrid/mail';

const apiKey = process.env.SENDGRID_API_KEY;

if (!apiKey) {
  console.error("❌ SENDGRID_API_KEY not found");
  process.exit(1);
}

const mailService = new MailService();
mailService.setApiKey(apiKey);

const PLATFORM_URL = process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : "https://examcraft.replit.app";

async function testEmail() {
  console.log('🧪 Testing SendGrid Email Service...');
  console.log('=====================================');

  try {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ExamCraft Test Email</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 40px 30px; }
        .test-info { background-color: #f8f9ff; padding: 30px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #667eea; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 30px; text-align: center; color: #6c757d; border-top: 1px solid #e9ecef; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📧 ExamCraft Email Test</h1>
        </div>
        
        <div class="content">
            <h2>Hello Adham!</h2>
            
            <div class="test-info">
                <h3>📋 Email System Test Results</h3>
                <p><strong>✅ SendGrid Integration:</strong> Working properly</p>
                <p><strong>✅ Template Rendering:</strong> HTML emails displaying correctly</p>
                <p><strong>✅ Authentication:</strong> API key validation successful</p>
                <p><strong>✅ Delivery System:</strong> Email successfully sent</p>
            </div>
            
            <p>This test email confirms that the ExamCraft email invitation system is working correctly. You should be able to:</p>
            
            <ul>
                <li>Send user platform invitations</li>
                <li>Send student exam invitations</li>
                <li>Send exam reminder notifications</li>
                <li>Receive professional branded emails</li>
            </ul>

            <a href="${PLATFORM_URL}" class="cta-button">Visit ExamCraft Platform</a>
            
            <p><strong>Test Details:</strong></p>
            <ul>
                <li>Sent: ${new Date().toLocaleString()}</li>
                <li>From: ExamCraft Email System</li>
                <li>To: mehdawiadham@gmail.com</li>
                <li>Platform: ${PLATFORM_URL}</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>This is a test email from ExamCraft Platform</p>
            <p>Email system verification completed successfully ✅</p>
        </div>
    </div>
</body>
</html>`;

    const result = await mailService.send({
      to: 'mehdawiadham@gmail.com',
      from: 'support@withyoumna.com', // Use your verified email
      subject: '✅ ExamCraft Email System Test - Working!',
      text: 'This is a simple test email from ExamCraft. If you receive this, the email system is working!',
      html: htmlContent,
    });

    console.log('✅ Test email sent successfully!');
    console.log('📧 Email sent to: mehdawiadham@gmail.com');
    console.log('📋 Subject: ExamCraft Email System Test - Working!');
    console.log('🔗 Platform URL:', PLATFORM_URL);
    console.log('\n🎉 Email system is fully operational!');
    
    return true;
  } catch (error) {
    console.error('❌ Email test failed:', error);
    return false;
  }
}

testEmail().then(success => {
  if (success) {
    console.log('\n✅ Email test completed successfully');
    console.log('📬 Check mehdawiadham@gmail.com for the test email');
  } else {
    console.log('\n❌ Email test failed');
  }
}).catch(console.error);