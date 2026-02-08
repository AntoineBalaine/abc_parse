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
    const kakrc = `# Debug marker to verify kakrc was loaded
declare-option str test_kakrc_loaded "yes"

# Load kak-lsp commands
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

    // Write kakoune init commands to a .kak file (no shell expansion needed).
    // $kak_runtime stays literal until kakoune's %sh{} block executes it.
    const initKak = `evaluate-commands %sh{
    find -L "$kak_runtime/autoload" -type f -name "*.kak" |
    sed 's/.*/try %{ source & } catch %{ echo -debug Autoload: could not load & }/'
}
source "%val{config}/kakrc"
`;
    const initKakPath = join(this.testHome, 'init.kak');
    writeFileSync(initKakPath, initKak);

    // Build the -e argument: source init.kak, then run initial command if any
    const eArg = initialCommand
      ? `source ${initKakPath}; ${initialCommand}`
      : `source ${initKakPath}`;

    // Run kak via tmux. The -e argument is simple (just paths), no special chars.
    execSync(
      `tmux -S .tmux-socket send-keys 'kak -s ${this.session} -n -e "${eArg}"' Enter`,
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

    // Track buffer if initial command was an edit
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
    // Use tmux to type keys directly into kakoune (client context required)
    execSync(
      `tmux -S .tmux-socket send-keys '${keys}'`,
      { cwd: this.testHome, env: this.testEnv }
    );
    execSync('sleep 0.1', { cwd: this.testHome, env: this.testEnv });
  }

  query(kakExpr: string, buffer?: string): string {
    // Run query in client context via tmux (kak -p doesn't have client state)
    // For shell variables like $kak_selection, we use %sh{} to expand them
    // For kakoune expansions like %opt{...}, we use echo directly
    const needsExpansion = kakExpr.startsWith('%');
    const writeCmd = needsExpansion
      ? `echo -to-file ${this.resultFifo} ${kakExpr}`
      : `nop %sh{ printf '%s' "${kakExpr}" > "${this.resultFifo}" }`;

    // Send command via tmux to run in client context
    // Escape the command for shell
    const escaped = writeCmd.replace(/'/g, "'\\''");
    execSync(
      `tmux -S .tmux-socket send-keys ': ${escaped}' Enter`,
      { cwd: this.testHome, env: this.testEnv }
    );
    execSync('sleep 0.1', { cwd: this.testHome, env: this.testEnv });

    // Read result from FIFO
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
    // Execute keys via tmux (needs client context)
    this.executeKeys(keys);
    // Query result via kak -p (can read values without client context)
    return this.query(kakExpr, this.currentBuffer);
  }

  commandAndQuery(command: string, kakExpr: string): string {
    if (!this.currentBuffer) {
      throw new Error('No buffer set. Call edit() first.');
    }
    // Run command via tmux (needs client context for some commands)
    this.sendKeys(`: ${command}`);
    // Query result via kak -p
    return this.query(kakExpr, this.currentBuffer);
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

  verifyKakrcLoaded(): void {
    const loaded = this.query('%opt{test_kakrc_loaded}');
    if (loaded.trim() !== 'yes') {
      throw new Error(`kakrc not loaded. test_kakrc_loaded = '${loaded.trim()}'`);
    }
  }

  verifyFiletype(expected: string): void {
    const actual = this.query('$kak_opt_filetype', this.currentBuffer);
    if (actual.trim() !== expected) {
      throw new Error(`Filetype verification failed: expected '${expected}', got '${actual.trim()}'`);
    }
  }

  verifyLspServersConfigured(): void {
    const servers = this.query('$kak_opt_lsp_servers', this.currentBuffer);
    if (!servers.includes('abc-lsp')) {
      throw new Error(`lsp_servers not configured for abc-lsp. Got: ${servers}`);
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
    // Verify kakrc loaded and abc plugin hooks fired correctly
    this.verifyKakrcLoaded();

    if (this.currentBuffer?.endsWith('.abc')) {
      this.verifyFiletype('abc');
      this.verifyLspServersConfigured();
    } else if (this.currentBuffer?.endsWith('.abcx')) {
      this.verifyFiletype('abcx');
      this.verifyLspServersConfigured();
    }
  }

  editAndVerify(filePath: string): void {
    this.sendKeys(`: edit ${filePath}`);
    this.currentBuffer = filePath;

    // Allow hooks to fire
    execSync('sleep 0.3', { cwd: this.testHome, env: this.testEnv });

    if (filePath.endsWith('.abc')) {
      this.verifyFiletype('abc');
      this.verifyLspServersConfigured();
    } else if (filePath.endsWith('.abcx')) {
      this.verifyFiletype('abcx');
      this.verifyLspServersConfigured();
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
