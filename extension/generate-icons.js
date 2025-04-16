const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const svgPath = path.join(__dirname, 'icons', 'icon.svg');

// Check if sharp is installed
try {
  require.resolve('sharp');
} catch (e) {
  console.error('Sharp is not installed. Please run: npm install sharp');
  process.exit(1);
}

// Generate PNG files for each size
async function generateIcons() {
  for (const size of sizes) {
    const outputPath = path.join(__dirname, 'icons', `icon${size}.png`);
    
    try {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`Generated ${outputPath}`);
    } catch (error) {
      console.error(`Error generating ${size}x${size} icon:`, error);
    }
  }
}

generateIcons().then(() => {
  console.log('Icon generation complete!');
}).catch(err => {
  console.error('Error generating icons:', err);
}); 