const fs = require('fs');
const path = require('path');

const configFiles = [
  'firestore.rules',
  '.gitignore',
  'package.json',
  'package-lock.json'
];

const srcDir = '/home/helminth/Downloads/Mcdental-pulse-final-main';
const destDir = '/home/helminth/Proyects/Mcdental-pulse-final-main';

configFiles.forEach(file => {
  const srcPath = path.join(srcDir, file);
  const destPath = path.join(destDir, file);
  
  try {
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Reverted config: ${file}`);
    }
  } catch (err) {
    console.error(`Failed to revert config ${file}:`, err);
  }
});
