const extract = require("extract-zip");
const path = require("path");
const fs = require("fs");

(async () => {
  const zip = path.join(
    process.env.LOCALAPPDATA,
    "electron",
    "Cache",
    "f71d58b9535ad2f1d90f09dd91a30fea648c4fe7e710e38a47d6983edd09e53f",
    "electron-v35.7.5-win32-x64.zip"
  );
  const dest = path.resolve(__dirname, "..", "node_modules", "electron", "dist");
  fs.mkdirSync(dest, { recursive: true });
  console.log("extracting", zip, "->", dest);
  await extract(zip, { dir: dest });
  fs.writeFileSync(
    path.resolve(__dirname, "..", "node_modules", "electron", "path.txt"),
    "electron.exe"
  );
  console.log("done", fs.existsSync(path.join(dest, "electron.exe")));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
