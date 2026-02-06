import { execSync, spawn } from 'child_process';
import { readFileSync, unlinkSync } from 'fs';

export class KakouneSession {
  session: string;
  resultFifo: string;
  currentBuffer: string | null = null;

  constructor() {
    this.session = `test-${process.pid}-${Date.now()}`;
    this.resultFifo = `/tmp/kak-result-${this.session}.fifo`;
  }

  start(): void {
    execSync(`mkfifo ${this.resultFifo}`);
    spawn('kak', ['-d', '-s', this.session], { detached: true, stdio: 'ignore' });
    execSync('sleep 0.3');
  }

  send(commands: string): void {
    execSync(`kak -p ${this.session}`, { input: commands });
  }

  edit(filePath: string): void {
    this.send(`edit ${filePath}`);
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
    const writeCmd = `nop %sh{ printf '%s' "${kakExpr}" > ${this.resultFifo} }`;
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
    try {
      unlinkSync(this.resultFifo);
    } catch {
      // FIFO may not exist
    }
  }
}
