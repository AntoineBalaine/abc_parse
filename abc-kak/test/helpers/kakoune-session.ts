import { execSync, spawn, ChildProcess } from 'child_process';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { createConnection } from 'net';

function computeSocketPath(): string {
  const xdgRuntimeDir = process.env.XDG_RUNTIME_DIR;
  if (xdgRuntimeDir) {
    return join(xdgRuntimeDir, 'abc-lsp.sock');
  }
  // Get user from multiple sources to handle Docker/container environments
  const user = process.env.USER || process.env.USERNAME || process.env.LOGNAME ||
               require('os').userInfo().username || 'unknown';
  return join('/tmp', `abc-lsp-${user}`, 'lsp.sock');
}

async function waitForSocket(socketPath: string, timeout: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (existsSync(socketPath)) {
      const ready = await checkSocketReady(socketPath);
      if (ready) return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Socket not ready after ${timeout}ms: ${socketPath}`);
}

function checkSocketReady(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const client = createConnection(socketPath, () => {
      client.destroy();
      resolve(true);
    });
    client.on('error', () => resolve(false));
    client.setTimeout(500, () => {
      client.destroy();
      resolve(false);
    });
  });
}

function randomId(): string {
  return Math.random().toString(36).substring(2, 8);
}

export class KakouneSession {
  session: string;
  tmuxSocket: string;
  resultFifo: string;
  currentBuffer: string | null = null;
  kakLspProcess: ChildProcess | null = null;
  socketPath: string;

  constructor() {
    // Include random component to prevent session name collisions in parallel test runs
    this.session = `test-${process.pid}-${Date.now()}-${randomId()}`;
    this.tmuxSocket = `/tmp/tmux-${this.session}.sock`;
    this.resultFifo = `/tmp/kak-result-${this.session}.fifo`;
    this.socketPath = computeSocketPath();
  }

  start(): void {
    // Remove stale FIFO if it exists from a previous crashed run
    if (existsSync(this.resultFifo)) {
      unlinkSync(this.resultFifo);
    }

    execSync(`mkfifo ${this.resultFifo}`);
    execSync(`tmux -S ${this.tmuxSocket} new-session -d -x 80 -y 24 -s ${this.session}`);
    execSync(`tmux -S ${this.tmuxSocket} send-keys -t ${this.session} 'kak -s ${this.session}' Enter`);

    // Wait for kakoune to be ready with retries
    const maxAttempts = 10;
    const delayMs = 200;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      execSync(`sleep ${delayMs / 1000}`);
      try {
        const sessionName = this.query('$kak_session');
        if (sessionName.trim() === this.session) {
          return; // Success
        }
      } catch (e) {
        lastError = e as Error;
      }
    }

    this.cleanup();
    throw new Error(`Kakoune failed to start after ${maxAttempts} attempts: ${lastError}`);
  }

  loadKakLsp(): void {
    // Pre-flight check: verify kak-lsp is available
    try {
      execSync('which kak-lsp', { encoding: 'utf-8' });
    } catch {
      throw new Error('kak-lsp is not installed or not in PATH');
    }

    const kakLspScript = execSync('kak-lsp', { encoding: 'utf-8' });
    this.send(kakLspScript);
    this.send('lsp-enable');
    this.kakLspProcess = spawn('kak-lsp', ['--session', this.session], {
      detached: true,
      stdio: 'ignore',
    });
    execSync('sleep 0.3');
  }

  loadAbcPlugin(): void {
    const rcDir = join(dirname(dirname(__dirname)), 'rc');
    const filesToSource = ['abc.kak', 'abc-selectors.kak', 'abc-transforms.kak', 'abc-modes.kak'];

    for (const file of filesToSource) {
      const filePath = join(rcDir, file);
      if (existsSync(filePath)) {
        this.send(`source ${filePath}`);
      }
    }

    const clientPath = join(dirname(dirname(__dirname)), 'dist', 'abc-kak-client.js');
    const serverPath = join(dirname(dirname(__dirname)), 'dist', 'server.js');

    this.send(`set-option global abc_client_path ${clientPath}`);
    this.send(`set-option global abc_server_path ${serverPath}`);
    this.send(`set-option global abc_socket_path ${this.socketPath}`);
  }

  send(commands: string): void {
    execSync(`kak -p ${this.session}`, { input: commands });
  }

  edit(filePath: string): void {
    this.send(`edit ${filePath}`);
    this.currentBuffer = filePath;
  }

  async editAndWaitForLsp(filePath: string, timeout = 5000): Promise<void> {
    this.send(`edit ${filePath}`);
    this.currentBuffer = filePath;
    await waitForSocket(this.socketPath, timeout);
  }

  executeKeys(keys: string): void {
    if (this.currentBuffer) {
      this.send(`evaluate-commands -buffer ${this.currentBuffer} %{ execute-keys '${keys}' }`);
    } else {
      this.send(`execute-keys '${keys}'`);
    }
  }

  query(kakExpr: string, buffer?: string): string {
    // For shell variables like $kak_selection, we pass them directly
    // For kakoune expansions like %opt{...} or %val{...}, we need to expand first
    const needsExpansion = kakExpr.startsWith('%');
    const writeCmd = needsExpansion
      ? `echo -to-file ${this.resultFifo} ${kakExpr}`
      : `nop %sh{ printf '%s' "${kakExpr}" > ${this.resultFifo} }`;
    if (buffer) {
      this.send(`evaluate-commands -buffer ${buffer} %{ ${writeCmd} }`);
    } else {
      this.send(writeCmd);
    }
    return readFileSync(this.resultFifo, 'utf-8');
  }

  executeAndQuery(keys: string, kakExpr: string): string {
    if (!this.currentBuffer) {
      throw new Error('No buffer set. Call edit() first.');
    }
    const cmd = `evaluate-commands -buffer ${this.currentBuffer} %{
      execute-keys '${keys}'
      nop %sh{ printf '%s' "${kakExpr}" > ${this.resultFifo} }
    }`;
    this.send(cmd);
    return readFileSync(this.resultFifo, 'utf-8');
  }

  commandAndQuery(command: string, kakExpr: string): string {
    if (!this.currentBuffer) {
      throw new Error('No buffer set. Call edit() first.');
    }
    const cmd = `evaluate-commands -buffer ${this.currentBuffer} %{
      try %{
        ${command}
      } catch %{
        echo -debug "Command error: %val{error}"
      }
      nop %sh{ printf '%s' "${kakExpr}" > ${this.resultFifo} }
    }`;
    this.send(cmd);
    try {
      const result = execSync(`timeout 5 cat ${this.resultFifo}`, { encoding: 'utf-8' });
      return result;
    } catch (e) {
      throw new Error(`FIFO read timed out after command: ${command}`);
    }
  }

  getSelection(): string {
    return this.query('$kak_selection', this.currentBuffer ?? undefined);
  }

  getSelections(): string[] {
    const raw = this.query('$kak_selections', this.currentBuffer ?? undefined);
    return raw.split(':');
  }

  getSelectionsDesc(): string {
    return this.query('$kak_selections_desc', this.currentBuffer ?? undefined);
  }

  cleanup(): void {
    try {
      this.send('quit!');
    } catch {
      // Session may already be closed
    }
    if (this.kakLspProcess) {
      this.kakLspProcess.kill();
      this.kakLspProcess = null;
    }
    try {
      execSync(`tmux -S ${this.tmuxSocket} kill-server`);
    } catch {
      // tmux may already be gone
    }
    try {
      unlinkSync(this.resultFifo);
    } catch {
      // FIFO may not exist
    }
    try {
      unlinkSync(this.tmuxSocket);
    } catch {
      // tmux socket may not exist
    }
    // Clean up LSP socket to prevent interference with subsequent test runs
    try {
      unlinkSync(this.socketPath);
    } catch {
      // LSP socket may not exist or may be owned by another process
    }
  }
}
