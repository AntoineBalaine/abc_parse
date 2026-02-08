# Kakoune Plugin Integration Testing Design

## Background Research

### kak-spec approach

kak-spec runs tests in "a separate temporary kakoune session" using the daemon pattern. Communication uses FIFOs for synchronization. Tests use shell scripts with assertions.

Key pattern:
```sh
kak -d -s session        # start daemon
kak -p session << CMDS   # send commands
  ...
CMDS
cat $result_fifo         # read result (blocks until written)
```

Limitation: kak-spec tests basic kakoune functionality, not LSP integration.


### kak-lsp approach

kak-lsp uses tmux to provide a pseudo-TTY, which gives kakoune a window context. This is necessary because LSP integration relies on window hooks.

Their test infrastructure (in `test/lib.sh`):
- Creates tmux session with `tmux new-session -d -x 80 -y 24`
- Starts kakoune inside tmux with `kak -s $session`
- Uses hook: `hook global -once WinDisplay .* lsp-enable`
- Sends commands via `kak -p $session`
- Captures tmux pane content for assertions

Source: https://github.com/kakoune-lsp/kakoune-lsp/tree/master/test


## The Problem

Our current approach uses `kak -d` (daemon mode) which has no TTY and no window context.

The abc.kak plugin relies on this hook chain:
```
BufSetOption filetype=abc  ->  sets lsp_servers config
WinSetOption filetype=abc  ->  calls lsp-enable-window  ->  calls lsp-did-open
```

In daemon mode, `WinSetOption` never fires because there is no window. Without `lsp-enable-window`, the LSP server is never started and selectors cannot work.


## Solution

Use tmux to run kakoune, same as kak-lsp does. This provides a pseudo-TTY and window context, allowing all standard hooks to fire.

Dependency: tmux must be installed (same as kak and kak-lsp are required).


## Execution Flow

```
TypeScript Test
     |
     v
+------------------+
| tmux new-session |  <-- creates pseudo-TTY
+------------------+
     |
     v
+------------------+
| kak -s session   |  <-- kakoune with window context
+------------------+
     |
     +--- kak-lsp commands loaded via `kak -p`
     |
     v
+------------------+
| kak-lsp daemon   |  <-- connects to kakoune session
+------------------+
     |
     +--- abc.kak sourced, sets lsp_servers config
     |
     v
+------------------+
| edit file.abc    |  <-- triggers BufCreate, then WinDisplay
+------------------+
     |
     +--- WinSetOption filetype=abc fires
     |
     +--- lsp-enable-window called
     |
     +--- lsp-did-open sent to kak-lsp
     |
     v
+------------------+
| kak-lsp spawns   |  <-- kak-lsp starts abc-lsp server
| abc-lsp server   |
+------------------+
     |
     +--- server creates /tmp/abc-lsp-$USER/lsp.sock
     |
     v
+------------------+
| abc-select-*     |  <-- selector command runs
+------------------+
     |
     +--- abc-kak-client.js talks to server via socket
     |
     +--- server returns ranges
     |
     +--- kakoune applies selection
     |
     v
+------------------+
| FIFO returns     |  <-- $kak_selections_desc written to FIFO
| result to test   |
+------------------+
     |
     v
TypeScript assertion
```


## Implementation: KakouneSession Class

```typescript
class KakouneSession {
  session: string;
  tmuxSocket: string;
  resultFifo: string;
  kakLspProcess: ChildProcess;
  socketPath: string;

  constructor() {
    this.session = `test-${pid}-${timestamp}`;
    this.tmuxSocket = `/tmp/tmux-${this.session}.sock`;
    this.resultFifo = `/tmp/fifo-${this.session}`;
    this.socketPath = computeSocketPath();  // /tmp/abc-lsp-$USER/lsp.sock
  }

  start() {
    // Create FIFO for result communication
    exec(`mkfifo ${this.resultFifo}`);

    // Start tmux session (provides pseudo-TTY)
    exec(`tmux -S ${this.tmuxSocket} new-session -d -x 80 -y 24 -s ${this.session}`);

    // Start kakoune inside tmux
    exec(`tmux -S ${this.tmuxSocket} send-keys -t ${this.session} 'kak -s ${this.session}' Enter`);

    sleep(300ms);
  }

  loadKakLsp() {
    // Get kak-lsp initialization script
    kakLspScript = exec('kak-lsp');

    // Send script to kakoune
    this.send(kakLspScript);

    // Start kak-lsp daemon for this session
    this.kakLspProcess = spawn('kak-lsp', ['--session', this.session]);

    sleep(300ms);
  }

  loadAbcPlugin() {
    // Source plugin files
    this.send('source /path/to/abc.kak');
    this.send('source /path/to/abc-selectors.kak');
    this.send('source /path/to/abc-transforms.kak');

    // Set paths
    this.send('set-option global abc_client_path /path/to/abc-kak-client.js');
    this.send('set-option global abc_server_path /path/to/server.js');
    this.send(`set-option global abc_socket_path ${this.socketPath}`);
  }

  send(commands: string) {
    exec(`kak -p ${this.session}`, { input: commands });
  }

  async editAndWaitForLsp(filePath: string) {
    this.send(`edit ${filePath}`);
    this.currentBuffer = filePath;
    await waitForSocket(this.socketPath, 5000);
  }

  executeKeys(keys: string) {
    this.send(`evaluate-commands -buffer ${this.currentBuffer} %{ execute-keys '${keys}' }`);
  }

  commandAndQuery(command: string, kakExpr: string): string {
    this.send(`
      evaluate-commands -buffer ${this.currentBuffer} %{
        ${command}
        nop %sh{ printf '%s' "${kakExpr}" > ${this.resultFifo} }
      }
    `);
    return readFileSync(this.resultFifo);
  }

  cleanup() {
    this.send('quit!');
    this.kakLspProcess.kill();
    exec(`tmux -S ${this.tmuxSocket} kill-server`);
    unlink(this.resultFifo);
  }
}
```


## Test Structure

```typescript
describe('abc-kak selectors') {
  let kak: KakouneSession;
  let testFile: string;

  beforeEach(async () => {
    kak = new KakouneSession();
    testFile = `/tmp/test-${kak.session}.abc`;
    kak.start();
    kak.loadKakLsp();
    kak.loadAbcPlugin();
  });

  afterEach(() => {
    kak.cleanup();
    unlinkSync(testFile);
  });

  it('selects voice 1 content', async () => {
    writeFileSync(testFile, `X:1\nK:C\n[V:1] CDE\n[V:2] FGA\n`);
    await kak.editAndWaitForLsp(testFile);
    kak.executeKeys('%');
    const result = kak.commandAndQuery('abc-select-voices 1', '$kak_selections_desc');
    expect(result).to.include('3.');
  });
}
```


## Dependencies

- tmux
- kak (kakoune)
- kak-lsp
- node (for abc-kak-client.js and abc-lsp server)
