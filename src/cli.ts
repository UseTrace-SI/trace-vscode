import { execFile } from 'child_process';
import * as vscode from 'vscode';

export class TraceCLI {
  private cliPath(): string {
    return vscode.workspace.getConfiguration('trace').get('cliPath', 'trace');
  }

  async exec(args: string[]): Promise<string> {
    const cli = this.cliPath();
    return new Promise((resolve, reject) => {
      execFile(cli, args, { maxBuffer: 1024 * 1024, timeout: 10000 }, (err, stdout, stderr) => {
        if (err) {
          if (err.code === 'ENOENT') {
            reject(new Error(`trace CLI not found at "${cli}". Install it or set trace.cliPath in settings.`));
          } else {
            reject(new Error(stderr || err.message));
          }
          return;
        }
        resolve(stdout);
      });
    });
  }

  async why(file: string, line: number): Promise<any> {
    const output = await this.exec(['why', '--json', `${file}:${line}`]);
    return JSON.parse(output);
  }

  async sessions(limit = 20): Promise<any[]> {
    const output = await this.exec(['sessions', '--json', '--limit', String(limit)]);
    const parsed = JSON.parse(output);
    return parsed.sessions || [];
  }

  async turns(sessionId: string, limit = 50): Promise<any[]> {
    const output = await this.exec(['turns', '--json', '--session', sessionId, '--limit', String(limit)]);
    const parsed = JSON.parse(output);
    return parsed.turns || [];
  }

  async reviewFindings(): Promise<any[]> {
    const output = await this.exec(['review', '--json', '--findings-only']);
    const parsed = JSON.parse(output);
    return parsed.findings || [];
  }
}
