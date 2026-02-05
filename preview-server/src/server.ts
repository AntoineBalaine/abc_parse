import express from "express";
import fs from "fs";
import http from "http";
import path from "path";
import WebSocket from "ws";
import { ClientMessage, CleanupMessage, ContentMessage, ServerMessage } from "./types";
import { ABCContext, convertAbcxToAbc } from "abc-parser";

// ABCx file detection and conversion
function isAbcxFile(filePath: string): boolean {
  return filePath.endsWith(".abcx");
}

function processContent(filePath: string, content: string): string {
  if (isAbcxFile(filePath)) {
    try {
      const ctx = new ABCContext();
      return convertAbcxToAbc(content, ctx);
    } catch (error) {
      console.error("ABCx conversion error:", error);
      return content; // Return original on error
    }
  }
  return content;
}

// Parse command line arguments
const args = process.argv.slice(2);
const portArg = args.find((arg) => arg.startsWith("--port="));
const startPort = portArg ? parseInt(portArg.split("=")[1], 10) : 8088;

// Try to find an available port
async function findAvailablePort(start: number, maxTries: number = 10): Promise<number> {
  for (let port = start; port < start + maxTries; port++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const testServer = http.createServer();
        testServer.once("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "EADDRINUSE") {
            reject(err);
          }
        });
        testServer.once("listening", () => {
          testServer.close(() => resolve());
        });
        testServer.listen(port);
      });
      return port;
    } catch (err) {
      continue;
    }
  }
  throw new Error(`No available port found between ${start} and ${start + maxTries - 1}`);
}

// Generate URL-safe slug from file path
function generateSlug(filePath: string, existingSlugs: Set<string>): string {
  // Get filename and remove .abcx or .abc extension
  let basename = path.basename(filePath);
  if (basename.endsWith(".abcx")) {
    basename = basename.slice(0, -5);
  } else if (basename.endsWith(".abc")) {
    basename = basename.slice(0, -4);
  }

  // Handle untitled files
  if (!basename || basename === "untitled" || basename === "") {
    basename = "untitled";
  }

  // Replace spaces with dashes and encode special characters
  let slug = basename.replace(/\s+/g, "-");
  slug = encodeURIComponent(slug);

  // Handle collisions
  if (existingSlugs.has(slug)) {
    let counter = 1;
    while (existingSlugs.has(`${slug}-${counter}`)) {
      counter++;
    }
    slug = `${slug}-${counter}`;
  }

  return slug;
}

// Score data structure
interface ScoreData {
  content: string;
  slug: string;
  clients: Set<WebSocket>;
}

// Store scores by absolute path
const scoresByPath = new Map<string, ScoreData>();
// Reverse mapping: slug -> path
const slugToPath = new Map<string, string>();

// Start server with port detection
findAvailablePort(startPort).then((port) => {
  // Create Express app
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });

  // Serve static files from templates directory
  app.use(express.static(path.join(__dirname, "../templates")));

  // Serve the main viewer page at root and any slug path
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../templates/viewer.html"));
  });

  app.get("/:slug", (req, res) => {
    res.sendFile(path.join(__dirname, "../templates/viewer.html"));
  });

  // Serve export page
  app.get("/export", (req, res) => {
    res.sendFile(path.join(__dirname, "../templates/export.html"));
  });

  // Serve print page
  app.get("/print", (req, res) => {
    res.sendFile(path.join(__dirname, "../templates/print.html"));
  });

  // Handle WebSocket connections
  wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
    // Extract slug from URL path
    const urlPath = req.url || "/";
    const slug = urlPath.substring(1) || "untitled"; // Remove leading slash

    console.log(`Client connected for slug: ${slug}`);

    // Find the path for this slug
    const scorePath = slugToPath.get(slug);

    if (scorePath && scoresByPath.has(scorePath)) {
      const scoreData = scoresByPath.get(scorePath)!;
      scoreData.clients.add(ws);

      // Send existing content if available
      if (scoreData.content) {
        ws.send(JSON.stringify({
          type: "content",
          content: scoreData.content
        }));
      }
    } else {
      // No score data yet, we'll wait for content
      console.log(`No score data yet for slug: ${slug}`);
    }

    // Handle messages from client
    ws.on("message", (message: WebSocket.Data) => {
      try {
        // Check if the message is not empty
        const messageStr = message.toString().trim();
        if (!messageStr) {
          console.log("Received empty message, ignoring");
          return;
        }

        const data = JSON.parse(messageStr) as ClientMessage;
        console.log("Received message:", data.type, "for slug:", slug);

        // Handle click events from the browser
        if (data.type === "click") {
          // Forward to Neovim via stdout
          console.log(
            JSON.stringify({
              type: "click",
              startChar: data.startChar,
              endChar: data.endChar,
            })
          );
        } else if (data.type === "svgExport") {
          // Handle SVG export request
          console.log(
            JSON.stringify({
              type: "svgExport",
              content: data.content,
            })
          );
        } else if (data.type === "requestExport") {
          // Handle export request
          const scorePath = slugToPath.get(slug);
          if (!scorePath || !scoresByPath.has(scorePath)) {
            console.error("No score found for export");
            return;
          }

          const scoreData = scoresByPath.get(scorePath)!;

          if (data.format === "svg" || data.format === "html") {
            // Request SVG from browser
            scoreData.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: "requestSvg" }));

                // Store export request for when SVG is received
                client.once("message", (svgMessage) => {
                  try {
                    const svgData = JSON.parse(svgMessage.toString()) as ClientMessage;
                    if (svgData.type === "svgExport" && svgData.content) {
                      if (data.format === "svg") {
                        handleExport("svg", svgData.content, data.path);
                      } else {
                        // Create HTML with the SVG content
                        const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ABC Export</title>
</head>
<body>
  ${svgData.content}
</body>
</html>`;
                        handleExport("html", htmlContent, data.path);
                      }
                    }
                  } catch (error) {
                    console.error("Error processing SVG response:", error);
                  }
                });
              }
            });
          }
        }
      } catch (error) {
        console.error("Error processing message:", error);
        console.error("Message was:", message.toString());
      }
    });

    // Handle client disconnection
    ws.on("close", () => {
      console.log(`Client disconnected for slug: ${slug}`);
      const scorePath = slugToPath.get(slug);
      if (scorePath && scoresByPath.has(scorePath)) {
        scoresByPath.get(scorePath)!.clients.delete(ws);
      }
    });
  });

  // Buffer for stdin line processing
  let stdinBuffer = '';

  // Listen for input from Neovim (via stdin)
  process.stdin.on("data", (data: Buffer) => {
    // Add incoming data to buffer
    stdinBuffer += data.toString();

    // Split by newlines
    const lines = stdinBuffer.split('\n');

    // Keep last (possibly incomplete) line in buffer
    stdinBuffer = lines.pop() || '';

    // Process each complete line
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue; // Skip empty lines

      try {
        const message = JSON.parse(trimmed) as ServerMessage;

      if (message.type === "content") {
        // Handle content update for a specific score
        const contentMsg = message as ContentMessage;
        const filePath = contentMsg.path;

        if (!filePath) {
          console.error("Content message missing path field");
          continue;
        }

        // Convert ABCx to ABC if needed
        const processedContent = processContent(filePath, contentMsg.content);

        // Get or create score data
        let scoreData = scoresByPath.get(filePath);

        if (!scoreData) {
          // Generate slug for new score
          const existingSlugs = new Set(slugToPath.keys());
          const slug = generateSlug(filePath, existingSlugs);

          scoreData = {
            content: processedContent,
            slug: slug,
            clients: new Set()
          };

          scoresByPath.set(filePath, scoreData);
          slugToPath.set(slug, filePath);

          console.log(`Created new score: ${filePath} -> ${slug}`);
        } else {
          // Update existing score content
          scoreData.content = processedContent;
        }

        // Broadcast to all clients for this score
        scoreData.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: "content",
              content: processedContent
            }));
          }
        });
      } else if (message.type === "cleanup") {
        // Handle cleanup request
        const cleanupMsg = message as CleanupMessage;
        const filePath = cleanupMsg.path;

        if (!filePath) {
          console.error("Cleanup message missing path field");
          continue;
        }

        const scoreData = scoresByPath.get(filePath);
        if (scoreData) {
          // Close all client connections for this score
          scoreData.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.close();
            }
          });

          // Remove from maps
          slugToPath.delete(scoreData.slug);
          scoresByPath.delete(filePath);

          console.log(`Cleaned up score: ${filePath}`);
        }
      } else if (message.type === "config" || message.type === "cursorMove") {
        // Broadcast config and cursor move to all clients (for now)
        // TODO: Could be made per-score if needed
        scoresByPath.forEach((scoreData) => {
          scoreData.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(message));
            }
          });
        });
      }
      } catch (error) {
        console.error("Error parsing JSON line:", error);
        console.error("Line was:", trimmed);
      }
    }
  });

  // Validate export path to prevent path traversal attacks
  function isValidExportPath(filePath: string): boolean {
    // Path must be absolute
    if (!path.isAbsolute(filePath)) {
      return false;
    }
    // Normalize and check for path traversal
    const normalized = path.normalize(filePath);
    if (normalized !== filePath || filePath.includes("..")) {
      return false;
    }
    // Parent directory must exist
    const dir = path.dirname(filePath);
    try {
      const stat = fs.statSync(dir);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  // Handle file export requests
  function handleExport(format: "html" | "svg", content: string, filePath: string): void {
    if (!isValidExportPath(filePath)) {
      console.error("Invalid export path:", filePath);
      console.log(
        JSON.stringify({
          type: "exportError",
          error: "Invalid export path",
        })
      );
      return;
    }

    try {
      fs.writeFileSync(filePath, content);
      console.log(
        JSON.stringify({
          type: "exportComplete",
          format,
          path: filePath,
        })
      );
    } catch (error) {
      console.error("Error exporting file:", error);
      console.log(
        JSON.stringify({
          type: "exportError",
          error: (error as Error).message,
        })
      );
    }
  }

  // Start the server
  server.listen(port, () => {
    // Send server info to Neovim
    console.log(JSON.stringify({ type: "serverInfo", port }));
    console.log(`Server running at http://localhost:${port}`);
  });
}).catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
