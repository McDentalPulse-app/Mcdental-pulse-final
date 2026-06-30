const fs = require('fs');

try {
  fs.copyFileSync('/home/helminth/Downloads/Mcdental-pulse-final-main/src/index.css', '/home/helminth/Proyects/Mcdental-pulse-final-main/src/index.css');
  console.log("Successfully copied index.css");
  
  fs.copyFileSync('/home/helminth/Downloads/Mcdental-pulse-final-main/src/App.css', '/home/helminth/Proyects/Mcdental-pulse-final-main/src/App.css');
  console.log("Successfully copied App.css");
} catch (err) {
  console.error("Error copying CSS files:", err);
}
