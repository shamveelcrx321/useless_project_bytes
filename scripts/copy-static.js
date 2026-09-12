const fs = require("fs");
const path = require("path");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else if (entry.isFile()) {
      // Prefer compiled .js from tsc for .ts sources; copy html/css always.
      if (entry.name.endsWith(".ts")) continue;
      fs.copyFileSync(from, to);
    }
  }
}

const root = path.join(__dirname, "..");
const rendererSrc = path.join(root, "renderer");
const rendererDest = path.join(root, "dist", "renderer");
const preloadSrcJs = path.join(root, "dist", "preload");

copyDir(rendererSrc, rendererDest);

// Ensure compiled renderer JS from tsc lands beside html (tsc already emits to dist/renderer)
// Re-copy html/css over in case, and verify renderer.js exists.
function assertExists(file) {
  if (!fs.existsSync(file)) {
    console.warn("Missing:", file);
  }
}

assertExists(path.join(rendererDest, "condition-dialog", "index.html"));
assertExists(path.join(rendererDest, "condition-dialog", "renderer.js"));
assertExists(path.join(rendererDest, "setup", "index.html"));
assertExists(path.join(preloadSrcJs, "preload.js"));

console.log("Static renderer assets copied.");
