const fs = require('fs');

try {
  fs.copyFileSync('/home/helminth/Downloads/Mcdental-pulse-final-main/src/config/theme.js', '/home/helminth/Proyects/Mcdental-pulse-final-main/src/config/theme.js');
  console.log("Successfully restored src/config/theme.js");
} catch (err) {
  console.error("Failed to restore theme.js:", err);
}
