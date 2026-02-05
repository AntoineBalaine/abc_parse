import { ChildProcess, spawn } from "child_process";
import path from "path";
import { ABCContext, AbcErrorReporter, filterVoicesInAbc } from "abc-parser";

// Convert file URI to filesystem path
function uriToPath(uri: string): string {
  if (uri.startsWith("file://")) {
    return decodeURIComponent(uri.slice(7));
  }
  return uri;
}

// Generate URL-safe slug from file path (mirrors preview server logic)
function generateSlug(filePath: string, existingSlugs: Set<string>): string {
  let basename = path.basename(filePath);
  if (basename.endsWith(".abcx")) {
    basename = basename.slice(0, -5);
  } else if (basename.endsWith(".abc")) {
    basename = basename.slice(0, -4);
  }

  if (!basename || basename === "untitled" || basename === "") {
    basename = "untitled";
  }

  let slug = basename.replace(/\s+/g, "-");
  slug = encodeURIComponent(slug);

  if (existingSlugs.has(slug)) {
    let counter = 1;
    while (existingSlugs.has(`${slug}-${counter}`)) {
      counter++;
    }
    slug = `${slug}-${counter}`;
  }

  return slug;
}

type PreviewContentGetter = (uri: string) => string;

export class PreviewManager {
  previewEnabledUris: Set<string> = new Set();
  serverProcess: ChildProcess | null = null;
  port: number = 8088;
  slugsByUri: Map<string, string> = new Map();
  getPreviewContent: PreviewContentGetter;
  serverReady: Promise<void> | null = null;
  serverReadyResolve: (() => void) | null = null;

  constructor(getPreviewContent: PreviewContentGetter) {
    this.getPreviewContent = getPreviewContent;
  }

  // Resolve preview server path using require.resolve
  getServerPath(): string {
    const packagePath = require.resolve("abc-preview-server/package.json");
    return path.join(path.dirname(packagePath), "dist", "server.js");
  }

  // Start preview for a URI, spawn server if not running
  // Returns a promise that resolves when the server is ready
  async startPreview(uri: string): Promise<{ port: number; slug: string; url: string }> {
    // Generate slug for this URI if not already assigned
    if (!this.slugsByUri.has(uri)) {
      const existingSlugs = new Set(this.slugsByUri.values());
      const slug = generateSlug(uriToPath(uri), existingSlugs);
      this.slugsByUri.set(uri, slug);
    }
    const slug = this.slugsByUri.get(uri)!;

    // Track this URI as preview-enabled
    this.previewEnabledUris.add(uri);

    // Spawn server if not running
    if (!this.serverProcess) {
      // Create a promise that resolves when server is ready
      this.serverReady = new Promise((resolve) => {
        this.serverReadyResolve = resolve;
      });

      const serverPath = this.getServerPath();
      this.serverProcess = spawn("node", [serverPath, `--port=${this.port}`], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.serverProcess.on("error", (err) => {
        console.error(`[preview-server] spawn error: ${err.message}`);
        this.serverProcess = null;
        // Resolve the promise to prevent hanging, but the server failed
        if (this.serverReadyResolve) {
          this.serverReadyResolve();
          this.serverReadyResolve = null;
        }
      });

      this.serverProcess.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        // Parse serverInfo message to capture actual port
        try {
          const lines = output.trim().split("\n");
          for (const line of lines) {
            if (line.startsWith("{")) {
              const msg = JSON.parse(line);
              if (msg.type === "serverInfo" && typeof msg.port === "number") {
                this.port = msg.port;
                // Server is ready, resolve the promise
                if (this.serverReadyResolve) {
                  this.serverReadyResolve();
                  this.serverReadyResolve = null;
                }
              }
            }
          }
        } catch {
          // Ignore parse errors for non-JSON output
        }
        console.error(`[preview-server] ${output}`);
      });

      this.serverProcess.stderr?.on("data", (data: Buffer) => {
        console.error(`[preview-server] ${data.toString()}`);
      });

      this.serverProcess.on("exit", (code) => {
        console.error(`[preview-server] exited with code ${code}`);
        this.serverProcess = null;
      });
    }

    // Wait for server to be ready before continuing
    if (this.serverReady) {
      await this.serverReady;
    }

    // Push initial content
    this.pushContentUpdate(uri);

    const url = `http://localhost:${this.port}/${slug}`;
    return { port: this.port, slug, url };
  }

  // Stop preview for a URI, kill server if no more previews
  stopPreview(uri: string): void {
    this.previewEnabledUris.delete(uri);

    // Send cleanup message to server
    const filePath = uriToPath(uri);
    this.sendToServer({ type: "cleanup", path: filePath });

    // Remove slug mapping
    this.slugsByUri.delete(uri);

    // Kill server if no more previews
    if (this.previewEnabledUris.size === 0 && this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
  }

  // Push content update for a URI (called from onDidChangeContent)
  pushContentUpdate(uri: string): void {
    if (!this.previewEnabledUris.has(uri)) {
      return;
    }

    let content = this.getPreviewContent(uri);

    // Apply voice filter if %%abcls show/hide directive present
    if (/%%abcls\s+(show|hide)/.test(content)) {
      try {
        const errorReporter = new AbcErrorReporter();
        const ctx = new ABCContext(errorReporter);
        content = filterVoicesInAbc(content, ctx);
      } catch (error: unknown) {
        // If voice filtering fails, log the error and use the original content
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[preview-server] voice filter error: ${message}`);
      }
    }

    const filePath = uriToPath(uri);
    this.sendToServer({ type: "content", path: filePath, content });
  }

  // Forward cursor positions to preview server
  pushCursorUpdate(uri: string, positions: number[]): void {
    if (!this.previewEnabledUris.has(uri)) {
      return;
    }

    // Send cursor position (use first position for single cursor highlight)
    if (positions.length > 0) {
      this.sendToServer({ type: "cursorMove", position: positions[0] });
    }
  }

  // Check if URI has preview enabled
  isPreviewEnabled(uri: string): boolean {
    return this.previewEnabledUris.has(uri);
  }

  // Shutdown: kill server process
  shutdown(): void {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
    this.previewEnabledUris.clear();
    this.slugsByUri.clear();
  }

  // Send message to preview server via stdin
  sendToServer(message: object): void {
    if (this.serverProcess?.stdin) {
      this.serverProcess.stdin.write(JSON.stringify(message) + "\n");
    }
  }
}
