// A simple script to find placeholder URLs in the build output
const fs = require('fs');
const path = require('path');

// Define the directories to search
const directories = [
  path.join(__dirname, 'dist'),
  path.join(__dirname, 'dist/assets')
];

// Define patterns to search for
const patterns = [
  'your-backend-app-service-name',
  'your-app-name',
  'placeholder',
  'your-frontend-deployment-url'
];

// Function to search for patterns in a file
function searchFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  for (const pattern of patterns) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(content)) {
      console.log(`Found "${pattern}" in ${filePath}`);
      
      // Show the context
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          console.log(`  Line ${i+1}: ${lines[i]}`);
        }
      }
    }
  }
}

// Function to walk through a directory
function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else {
      // Only check certain file types
      if (/\.(js|html|css|json)$/.test(file)) {
        searchFile(filePath);
      }
    }
  }
}

// Search all directories
console.log('Searching for placeholder URLs...');
for (const dir of directories) {
  if (fs.existsSync(dir)) {
    walkDir(dir);
  } else {
    console.log(`Directory ${dir} does not exist.`);
  }
}

console.log('Search complete.'); 