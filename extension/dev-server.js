const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Create dist directory if it doesn't exist
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
  fs.mkdirSync(path.join(__dirname, 'dist'));
}

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Serve icons directory
app.use('/icons', express.static(path.join(__dirname, 'icons')));

// Serve manifest.json
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'manifest.json'));
});

// Serve popup.html directly
app.get('/popup.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'popup.html'));
});

// Serve content.js directly
app.get('/content.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'content.js'));
});

// Serve background.js directly
app.get('/background.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'background.js'));
});

// Serve popup.js directly
app.get('/popup.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'popup.js'));
});

// Default route redirects to popup.html
app.get('/', (req, res) => {
  res.redirect('/popup.html');
});

// Catch-all route for debugging
app.get('*', (req, res) => {
  console.log(`Requested path: ${req.path}`);
  res.status(404).send(`
    <h1>404 - Not Found</h1>
    <p>The requested path "${req.path}" was not found.</p>
    <p>Available routes:</p>
    <ul>
      <li><a href="/manifest.json">manifest.json</a></li>
      <li><a href="/popup.html">popup.html</a></li>
      <li><a href="/content.js">content.js</a></li>
      <li><a href="/background.js">background.js</a></li>
      <li><a href="/popup.js">popup.js</a></li>
      <li><a href="/icons/icon16.png">icon16.png</a></li>
      <li><a href="/icons/icon48.png">icon48.png</a></li>
      <li><a href="/icons/icon128.png">icon128.png</a></li>
    </ul>
  `);
});

// Start the TypeScript compiler in watch mode
const tscProcess = exec('npm run watch', (error, stdout, stderr) => {
  if (error) {
    console.error(`TypeScript compiler error: ${error}`);
    return;
  }
  console.log(`TypeScript compiler output: ${stdout}`);
  if (stderr) {
    console.error(`TypeScript compiler stderr: ${stderr}`);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Development server running at http://localhost:${PORT}`);
  console.log('To load the extension in Chrome:');
  console.log('1. Go to chrome://extensions/');
  console.log('2. Enable "Developer mode"');
  console.log('3. Click "Load unpacked" and select the extension folder');
  console.log('4. For live reloading, use the "Reload" button in chrome://extensions/');
  console.log('\nAvailable routes:');
  console.log('- /manifest.json');
  console.log('- /popup.html');
  console.log('- /content.js');
  console.log('- /background.js');
  console.log('- /popup.js');
  console.log('- /icons/icon16.png');
  console.log('- /icons/icon48.png');
  console.log('- /icons/icon128.png');
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down development server...');
  tscProcess.kill();
  process.exit(0);
}); 