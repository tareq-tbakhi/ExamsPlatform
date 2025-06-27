// Quick test script to check API response
const submissionId = 25; // This submission should have video answers

console.log(`Testing submission ${submissionId}...`);

fetch(`/api/submissions/${submissionId}`)
  .then(response => response.json())
  .then(data => {
    console.log('Full API response:', data);
    console.log('Video answers count:', data.videoAnswers?.length || 0);
    console.log('Video answers:', data.videoAnswers);
    if (data.videoAnswers && data.videoAnswers.length > 0) {
      console.log('First video answer fields:', Object.keys(data.videoAnswers[0]));
    }
  })
  .catch(error => {
    console.error('API Error:', error);
  });