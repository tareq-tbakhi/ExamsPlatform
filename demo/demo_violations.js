// Demo script to showcase AI analysis features
const fs = require('fs');
const path = require('path');

// Create a simple base64 image for testing
const createDemoImage = () => {
  // 1x1 pixel red JPEG in base64
  const redPixel = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
  
  const buffer = Buffer.from(redPixel, 'base64');
  fs.writeFileSync(path.join(__dirname, 'violation_screenshot.jpg'), buffer);
  console.log('Demo image created successfully');
};

createDemoImage();