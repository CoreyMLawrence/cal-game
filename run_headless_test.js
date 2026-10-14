import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const PORT = 8999;
const ROOT = process.cwd();

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".json": "application/json",
};

let server;
let chromeProc;
let timeoutTimer;

server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/results") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));

      try {
        const results = JSON.parse(body);
        console.log("\n================ TEST RESULTS ================");
        console.log(results.logs.join("\n"));
        console.log("==============================================");

        if (results.passed) {
          console.log("\nSUCCESS: All levels and scenes passed in headless Chrome!\n");
          cleanExit(0);
        } else {
          console.error("\nFAILURE: Errors detected during headless test run:");
          for (const err of results.errors) {
            console.error("- ", err);
          }
          cleanExit(1);
        }
      } catch (err) {
        console.error("Failed to parse test results JSON", err);
        cleanExit(1);
      }
    });
    return;
  }

  // Serve static files
  let safePath = path.normalize(decodeURIComponent(req.url.split("?")[0]));
  if (safePath === "/" || safePath === "\\") safePath = "/test_runner.html";
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end("Not Found: " + safePath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

function cleanExit(code) {
  clearTimeout(timeoutTimer);
  if (chromeProc) {
    try {
      chromeProc.kill();
    } catch (_) {}
  }
  if (server) {
    server.close(() => process.exit(code));
  } else {
    process.exit(code);
  }
}

server.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}/test_runner.html`);
  console.log("Launching Headless Chrome...");

  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  chromeProc = spawn(chromePath, [
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--autoplay-policy=no-user-gesture-required",
    `http://localhost:${PORT}/test_runner.html`,
  ]);

  chromeProc.on("error", (err) => {
    console.error("Failed to launch Chrome:", err);
    cleanExit(1);
  });

  timeoutTimer = setTimeout(() => {
    console.error("TIMEOUT: Test runner did not complete within 30 seconds.");
    cleanExit(1);
  }, 30000);
});
