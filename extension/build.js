const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create dist directory if it doesn't exist
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Compile TypeScript
console.log('Compiling TypeScript...');
execSync('tsc', { stdio: 'inherit' });

// Copy popup.html to dist
console.log('Copying popup.html...');
fs.copyFileSync('src/popup.html', 'dist/popup.html');

// Copy icons directory if it exists
if (fs.existsSync('icons')) {
  console.log('Copying icons...');
  if (!fs.existsSync('dist/icons')) {
    fs.mkdirSync('dist/icons');
  }
  fs.readdirSync('icons').forEach(file => {
    fs.copyFileSync(
      path.join('icons', file),
      path.join('dist/icons', file)
    );
  });
}

console.log('Build completed successfully!'); 