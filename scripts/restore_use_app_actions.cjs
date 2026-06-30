const fs = require('fs');

try {
  fs.copyFileSync('/home/helminth/Downloads/Mcdental-pulse-final-main/src/hooks/useAppActions.jsx', '/home/helminth/Proyects/Mcdental-pulse-final-main/src/hooks/useAppActions.jsx');
  console.log("Successfully restored useAppActions.jsx");
} catch (err) {
  console.error("Failed to restore useAppActions.jsx:", err);
}
