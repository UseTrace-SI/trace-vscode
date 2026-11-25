import * as vscode from 'vscode';
import { TraceProvider } from './provider';

const agentColors: Record<string, string> = {
  claude: 'rgba(100, 149, 237, 0.15)',
  copilot: 'rgba(144, 238, 144, 0.15)',
  codex: 'rgba(255, 165, 0, 0.15)',
  cursor: 'rgba(186, 85, 211, 0.15)',
  default: 'rgba(128, 128, 128, 0.1)',
};

export class ProvenanceDecorator {
  private provider: TraceProvider;
  private decorationTypes = new Map<string, vscode.TextEditorDecorationType>();
  private pending = new Map<string, boolean>();

  constructor(provider: TraceProvider) {
    this.provider = provider;
  }

  private getDecorationType(agent: string): vscode.TextEditorDecorationType {
    const key = agent.toLowerCase();
    let type = this.decorationTypes.get(key);
    if (type) return type;

    const color = agentColors[key] || agentColors.default;
    type = vscode.window.createTextEditorDecorationType({
      backgroundColor: color,
      after: {
        margin: '0 0 0 2em',
        color: 'rgba(128, 128, 128, 0.6)',
        fontStyle: 'italic',
      },
      isWholeLine: true,
    });
    this.decorationTypes.set(key, type);
    return type;
  }

  async decorate(editor: vscode.TextEditor): Promise<void> {
    const config = vscode.workspace.getConfiguration('trace');
    if (!config.get('autoDecorate', true)) return;

    const file = vscode.workspace.asRelativePath(editor.document.uri);
    if (this.pending.get(file)) return;
    this.pending.set(file, true);

    try {
      const lines = await this.provider.fileProvenance(file);
      if (!lines.length) return;

      const byAgent = new Map<string, { ranges: vscode.DecorationOptions[] }>();

      for (const line of lines) {
        const agent = line.agent.toLowerCase();
        if (!byAgent.has(agent)) byAgent.set(agent, { ranges: [] });
        const lineIdx = line.line - 1;
        if (lineIdx < 0 || lineIdx >= editor.document.lineCount) continue;

        const range = editor.document.lineAt(lineIdx).range;
        const when = line.timestamp
          ? new Date(line.timestamp).toLocaleDateString()
          : '';
        byAgent.get(agent)!.ranges.push({
          range,
          renderOptions: {
            after: {
              contentText: `  ${line.agent}${when ? ` · ${when}` : ''}`,
            },
          },
        });
      }

      for (const [agent, { ranges }] of byAgent) {
        editor.setDecorations(this.getDecorationType(agent), ranges);
      }
    } finally {
      this.pending.delete(file);
    }
  }
}
