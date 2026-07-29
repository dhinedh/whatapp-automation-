const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, 'public', 'logo.png');
const stats = fs.statSync(logoPath);
console.log('File size (bytes):', stats.size);

// Read header to check dimensions (PNG width/height are at byte offsets 16 and 20)
const buffer = fs.readFileSync(logoPath);
if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    console.log(`PNG Dimensions: ${width}x${height}`);
} else {
    console.log('Not a standard PNG file header');
}
