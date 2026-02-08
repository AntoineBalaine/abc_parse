import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';

export class KakouneSession {
  // Static tracking for exit handler (prevents accumulation of handlers)
  static activeSessions: Set<KakouneSession> = new Set();
  static exitHandlerRegistered: boolean = false;

  testHome: string = '';
  testEnv: NodeJS.ProcessEnv = {};
  // Fixed session name matches kak-lsp pattern. Tests must run sequentially.
  session: string = 'session';
  resultFifo: string = '';
  currentBuffer: string | undefined;

  static checkPrerequisites(): void {
    // Check required commands (matches kak-lsp's # REQUIRES pattern)
    try {
      execSync('command -v tmux', { stdio: 'ignore' });
    } catch {
      throw new Error('tmux is required but not installed');
    }

    try {
      execSync('command -v kak', { stdio: 'ignore' });
    } catch {
      throw new Error('kakoune is required but not installed');
    }

    try {
      execSync('command -v kak-lsp', { stdio: 'ignore' });
    } catch {
      throw new Error('kak-lsp is required but not installed');
    }

    // Check required build artifacts
    const abcKakDir = dirname(dirname(__dirname)); // abc-kak/test/helpers -> abc-kak
    const clientPath = join(abcKakDir, 'dist', 'abc-kak-client.js');
    const serverPath = join(abcKakDir, 'dist', 'server.js');

    if (!existsSync(clientPath)) {
      throw new Error(`abc-kak-client.js not found at ${clientPath}. Run 'npm run build' first.`);
    }
    if (!existsSync(serverPath)) {
      throw new Error(`server.js not found at ${serverPath}. Run 'npm run build' first.`);
    }
  }

  constructor() {
    this.createTestEnvironment();
    this.registerCleanupHandler();
  }

  createTestEnvironment(): void {
    // Create fresh HOME directory
    this.testHome = execSync('mktemp -d', { encoding: 'utf-8' }).trim();

    // Validate that testHome was created and is empty (safety check)
    if (!existsSync(this.testHome)) {
      throw new Error(`Failed to create testHome directory: ${this.testHome}`);
    }
    const contents = readdirSync(this.testHome);
    if (contents.length > 0) {
      throw new Error(`testHome is not empty: ${this.testHome}`);
    }

    // Compute paths
    const abcKakDir = dirname(dirname(__dirname)); // abc-kak/test/helpers -> abc-kak
    const clientPath = join(abcKakDir, 'dist', 'abc-kak-client.js');
    const serverPath = join(abcKakDir, 'dist', 'server.js');
    const socketPath = join(this.testHome, 'abc-lsp.sock');

    // Create directory structure
    const kakConfigDir = join(this.testHome, '.config', 'kak');
    const kakLspConfigDir = join(this.testHome, '.config', 'kak-lsp');
    mkdirSync(kakConfigDir, { recursive: true });
    mkdirSync(kakLspConfigDir, { recursive: true });

    // Generate kakrc content with computed absolute paths
    const kakrc = `# Load kak-lsp commands
evaluate-commands %sh{kak-lsp}

# Debug output for troubleshooting
set-option global lsp_debug true

# Enable LSP when a window is displayed
hook global -once WinDisplay .* lsp-enable

# Source abc plugin files
source "${join(abcKakDir, 'rc', 'abc.kak')}"
source "${join(abcKakDir, 'rc', 'abc-selectors.kak')}"
source "${join(abcKakDir, 'rc', 'abc-transforms.kak')}"
source "${join(abcKakDir, 'rc', 'abc-modes.kak')}"

# Override abc plugin options with test-specific paths
set-option global abc_client_path "${clientPath}"
set-option global abc_server_path "${serverPath}"
set-option global abc_socket_path "${socketPath}"
`;

    writeFileSync(join(kakConfigDir, 'kakrc'), kakrc);

    // Create .tmux.conf
    writeFileSync(join(this.testHome, '.tmux.conf'), 'set -sg escape-time 25\n');

    // Build environment variables conditionally (matches kak-lsp pattern)
    this.testEnv = {
      ...process.env,
      HOME: this.testHome,
      TMPDIR: this.testHome,
    };

    // Only override XDG variables if they're already set in the environment
    if (process.env.XDG_CONFIG_HOME !== undefined) {
      this.testEnv.XDG_CONFIG_HOME = join(this.testHome, '.config');
    }
    if (process.env.XDG_RUNTIME_DIR !== undefined) {
      const xdgRuntime = join(this.testHome, 'xdg_runtime_dir');
      mkdirSync(xdgRuntime, { mode: 0o700 });
      this.testEnv.XDG_RUNTIME_DIR = xdgRuntime;
    }

    // Create FIFO for query results (done here so it's ready before start())
    this.resultFifo = join(this.testHome, 'kak-result.fifo');
    execSync(`mkfifo "${this.resultFifo}"`, { cwd: this.testHome, env: this.testEnv });
  }

  registerCleanupHandler(): void {
    KakouneSession.activeSessions.add(this);

    if (KakouneSession.exitHandlerRegistered) return;
    KakouneSession.exitHandlerRegistered = true;

    // Trap-based cleanup: runs on any exit (matches kak-lsp's trap EXIT)
    process.on('exit', () => {
      for (const session of KakouneSession.activeSessions) {
        session.cleanup();
      }
    });
  }

  start(initialCommand?: string): void {
    // Start tmux session (must run from testHome for relative socket)
    execSync(
      'tmux -S .tmux-socket -f .tmux.conf new-session -d -x 80 -y 24 /bin/sh',
      { cwd: this.testHome, env: this.testEnv }
    );

    // macOS workaround: dimensions may not apply on new-session
    try {
      execSync('tmux -S .tmux-socket resize-window -x 80 -y 24',
        { cwd: this.testHome, env: this.testEnv });
    } catch {
      // Ignore resize errors
    }

    // Build the startup command (matches kak-lsp lib.sh exactly)
    const autoload = `
      find -L "$kak_runtime/autoload" -type f -name "*.kak" |
      sed "s/.*/try %{ source & } catch %{ echo -debug Autoload: could not load & }/"
    `;
    const loadDefaultConfig = `
      evaluate-commands %sh{${autoload}}
      source "$HOME/.config/kak/kakrc"
    `;

    // Append initial command if provided (atomic startup + edit)
    const fullConfig = initialCommand
      ? `${loadDefaultConfig}; ${initialCommand}`
      : loadDefaultConfig;

    // Escape single quotes for shell
    const escapedConfig = fullConfig.replace(/'/g, "'\\''");

    // Start kakoune with -n -e
    execSync(
      `tmux -S .tmux-socket send-keys "kak -s ${this.session} -n -e '${escapedConfig}'" Enter`,
      { cwd: this.testHome, env: this.testEnv }
    );

    // Sleep for synchronization (1s local, 10s CI)
    const sleepDuration = process.env.CI ? 10 : 1;
    execSync(`sleep ${sleepDuration}`, { cwd: this.testHome, env: this.testEnv });

    // Verify kakoune started
    const sessionName = this.query('$kak_session');
    if (sessionName.trim() !== this.session) {
      this.cleanup();
      throw new Error(`Kakoune session mismatch: expected ${this.session}, got ${sessionName.trim()}`);
    }

    // If initial command opened a file, track it
    if (initialCommand && initialCommand.startsWith('edit ')) {
      this.currentBuffer = initialCommand.substring(5).trim();
    }
  }

  send(commands: string): void {
    execSync(`kak -p ${this.session}`, {
      input: commands,
      cwd: this.testHome,
      env: this.testEnv
    });
  }

  sendKeys(keys: string): void {
    execSync(
      `tmux -S .tmux-socket send-keys '${keys}' Enter`,
      { cwd: this.testHome, env: this.testEnv }
    );
    // Small delay for kakoune to process
    execSync('sleep 0.1', { cwd: this.testHome, env: this.testEnv });
  }

  edit(filePath: string): void {
    this.sendKeys(`: edit ${filePath}`);
    this.currentBuffer = filePath;
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
      ? `echo -to-file "${this.resultFifo}" ${kakExpr}`
      : `nop %sh{ printf '%s' "${kakExpr}" > "${this.resultFifo}" }`;
    if (buffer) {
      this.send(`evaluate-commands -buffer ${buffer} %{ ${writeCmd} }`);
    } else {
      this.send(writeCmd);
    }
    // Use timeout to prevent hanging if kakoune fails to write
    return execSync(`timeout 5 cat "${this.resultFifo}"`, {
      encoding: 'utf-8',
      cwd: this.testHome,
      env: this.testEnv
    });
  }

  executeAndQuery(keys: string, kakExpr: string): string {
    if (!this.currentBuffer) {
      throw new Error('No buffer set. Call edit() first.');
    }
    const cmd = `evaluate-commands -buffer ${this.currentBuffer} %{
      execute-keys '${keys}'
      nop %sh{ printf '%s' "${kakExpr}" > "${this.resultFifo}" }
    }`;
    this.send(cmd);
    // Use timeout to prevent hanging if kakoune fails to write
    return execSync(`timeout 5 cat "${this.resultFifo}"`, {
      encoding: 'utf-8',
      cwd: this.testHome,
      env: this.testEnv
    });
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
      nop %sh{ printf '%s' "${kakExpr}" > "${this.resultFifo}" }
    }`;
    this.send(cmd);
    // Use timeout to prevent hanging if kakoune fails to write
    return execSync(`timeout 5 cat "${this.resultFifo}"`, {
      encoding: 'utf-8',
      cwd: this.testHome,
      env: this.testEnv
    });
  }

  getSelection(): string {
    return this.query('$kak_selection', this.currentBuffer);
  }

  getSelections(): string[] {
    const raw = this.query('$kak_selections', this.currentBuffer);
    return raw.split(':');
  }

  getSelectionsDesc(): string {
    return this.query('$kak_selections_desc', this.currentBuffer);
  }

  verifyFiletype(expected: string): void {
    const actual = this.query('$kak_opt_filetype');
    if (actual.trim() !== expected) {
      throw new Error(`Filetype verification failed: expected '${expected}', got '${actual.trim()}'`);
    }
  }

  verifyLspServersConfigured(): void {
    const servers = this.query('$kak_opt_lsp_servers');
    if (!servers.includes('abc-lsp')) {
      throw new Error(`lsp_servers not configured for abc-lsp. Got: ${servers}`);
    }
  }

  verifyLspEnabled(): void {
    // If lsp-enable-window ran, lsp_diagnostic_count option exists
    try {
      this.query('%opt{lsp_diagnostic_count}');
    } catch {
      throw new Error('LSP not enabled: lsp_diagnostic_count option not found');
    }
  }

  getDebugBuffer(): string {
    // Switch to debug buffer, get content, switch back
    const content = this.query('%val{selection}', '*debug*');
    return content;
  }

  verifyAbcLspStarted(): void {
    const debug = this.getDebugBuffer();
    if (!debug.includes('Starting language server abc-lsp') &&
        !debug.includes('abc-lsp')) {
      throw new Error(`abc-lsp not started. Debug buffer: ${debug}`);
    }
  }

  verifyHookFlow(): void {
    // Verify all hooks in the abc file loading flow fired correctly
    // Both .abc and .abcx files use the same hooks (see abc.kak BufSetOption regex)
    if (this.currentBuffer?.endsWith('.abc')) {
      this.verifyFiletype('abc');
      this.verifyLspServersConfigured();
      this.verifyLspEnabled();
    } else if (this.currentBuffer?.endsWith('.abcx')) {
      this.verifyFiletype('abcx');
      this.verifyLspServersConfigured();
      this.verifyLspEnabled();
    }
  }

  editAndVerify(filePath: string): void {
    this.sendKeys(`: edit ${filePath}`);
    this.currentBuffer = filePath;

    // Allow hooks to fire
    execSync('sleep 0.3', { cwd: this.testHome, env: this.testEnv });

    // Verify hook flow for abc-related files
    if (filePath.endsWith('.abc')) {
      this.verifyFiletype('abc');
      this.verifyLspServersConfigured();
      this.verifyLspEnabled();
    } else if (filePath.endsWith('.abcx')) {
      this.verifyFiletype('abcx');
      this.verifyLspServersConfigured();
      this.verifyLspEnabled();
    }
  }

  cleanup(): void {
    // Guard against cleanup being called multiple times
    if (!this.testHome || !existsSync(this.testHome)) {
      return;
    }

    // Remove from active sessions tracking
    KakouneSession.activeSessions.delete(this);

    // 1. Send kill! to kakoune
    try {
      execSync(`echo 'kill!' | kak -p ${this.session}`, {
        cwd: this.testHome,
        env: this.testEnv
      });
    } catch {
      // Kakoune may already be gone
    }

    // 2. Wait for kakoune to exit (poll with timeout, matches test_sleep_until)
    const start = Date.now();
    let kakouneExited = false;
    while (Date.now() - start < 10000) {  // 10 second timeout
      try {
        execSync(`kak -c ${this.session} -ui dummy -e quit`, {
          cwd: this.testHome,
          env: this.testEnv,
          stdio: 'ignore'
        });
        // If we get here, kakoune is still running
        execSync('sleep 0.1');
      } catch {
        // Connection failed = kakoune is stopped
        kakouneExited = true;
        break;
      }
    }

    // 3. Force-kill if polling timed out (kakoune is hung)
    if (!kakouneExited) {
      try {
        // Find and kill the kakoune process by session name
        execSync(`pkill -f "kak -s ${this.session}"`, { stdio: 'ignore' });
      } catch {
        // Process may not exist
      }
    }

    // 4. Small delay
    execSync('sleep 0.1');

    // 5. Kill tmux server
    try {
      execSync('tmux -S .tmux-socket kill-server', {
        cwd: this.testHome,
        env: this.testEnv,
        stdio: 'ignore'
      });
    } catch {
      // tmux may already be gone
    }

    // 6. Small delay
    execSync('sleep 0.1');

    // 7. Remove entire testHome directory
    const testHomeToRemove = this.testHome;
    this.testHome = ''; // Clear to prevent re-entry
    try {
      execSync(`rm -rf "${testHomeToRemove}"`);
    } catch {
      // Best effort removal
    }
  }
}
