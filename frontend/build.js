import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Building ImoTech Frontend bundle...");

const srcDir = path.join(__dirname, "src");
const distDir = path.join(__dirname, "dist");

const requiredFiles = [
  path.join(__dirname, "package.json"),
  path.join(__dirname, "index.html"),
  path.join(srcDir, "App.jsx"),
  path.join(srcDir, "main.jsx"),
  path.join(srcDir, "index.css"),
  path.join(srcDir, "services", "api.js"),
  path.join(srcDir, "data", "mockData.js")
];

for (const f of requiredFiles) {
  if (!fs.existsSync(f)) {
    console.error(`Missing required source file: ${f}`);
    process.exit(1);
  }
}

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const cssContent = fs.readFileSync(path.join(srcDir, "index.css"), "utf-8");
const appJsx = fs.readFileSync(path.join(srcDir, "App.jsx"), "utf-8");
const mockDataJs = fs.readFileSync(path.join(srcDir, "data", "mockData.js"), "utf-8");
const apiJs = fs.readFileSync(path.join(srcDir, "services", "api.js"), "utf-8");

function stripModules(code) {
  return code
    .replace(/import\s+[\s\S]*?from\s+["'].*?["'];?/g, "")
    .replace(/export\s+default\s+function\s+/g, "function ")
    .replace(/export\s+(async\s+)?function\s+/g, "$1function ")
    .replace(/export\s+const\s+/g, "const ");
}

const htmlOutput = `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ImoTech (ЫмТили) — Распознавание языка жестов в буквы и цифры, обработка видео и YouTube</title>
    <style>
${cssContent}
    </style>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js" crossorigin="anonymous"></script>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  </head>
  <body>
    <div id="root"></div>

    <script type="text/babel">
      const { useState, useEffect, useMemo, useRef, useCallback } = React;

      ${stripModules(mockDataJs)}

      ${stripModules(apiJs)}

      ${stripModules(appJsx)}

      const root = ReactDOM.createRoot(document.getElementById("root"));
      root.render(<App />);
    </script>
  </body>
</html>`;

fs.writeFileSync(path.join(distDir, "index.html"), htmlOutput, "utf-8");
fs.writeFileSync(path.join(distDir, "style.css"), cssContent, "utf-8");
fs.writeFileSync(path.join(distDir, "app.js"), `${mockDataJs}\n${apiJs}\n${appJsx}`, "utf-8");

console.log("ImoTech frontend build SUCCESS: dist/index.html created successfully.");
