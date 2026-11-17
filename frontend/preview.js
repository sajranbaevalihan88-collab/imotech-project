import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const PORT = 3010;

const server = http.createServer((req, res) => {
  let filePath = path.join(distDir, req.url === "/" ? "index.html" : req.url);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(distDir, "index.html");
  }
  const ext = path.extname(filePath);
  let contentType = "text/html";
  if (ext === ".js") contentType = "application/javascript";
  if (ext === ".css") contentType = "text/css";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end(`Server Error: ${err.code}`);
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

server.listen(PORT, () => {
  console.log(`ImoTech frontend running at http://localhost:${PORT}`);
});
