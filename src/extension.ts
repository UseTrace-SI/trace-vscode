import * as vscode from 'vscode';
import { TraceProvider } from './provider';
import { TraceCLI } from './cli';
import { ProvenanceDecorator } from './decorator';

let decorator: ProvenanceDecorator | undefined;
let diagnosticCollection: vscode.DiagnosticCollection | undefined;
let decorateTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleDecorate(editor: vscode.TextEditor) {
  if (decorateTimer) clearTimeout(decorateTimer);
  decorateTimer = setTimeout(() => {
    if (decorator) decorator.decorate(editor);
  }, 500);
}

export function activate(context: vscode.ExtensionContext) {
  const cli = new TraceCLI();
  const provider = new TraceProvider(cli);
  decorator = new ProvenanceDecorator(provider);
  diagnosticCollection = vscode.languages.createDiagnosticCollection('trace-review');
  context.subscriptions.push(diagnosticCollection);

  context.subscriptions.push(
    vscode.commands.registerCommand('trace.why', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const line = editor.selection.active.line + 1;
      const file = vscode.workspace.asRelativePath(editor.document.uri);
      try {
        const result = await provider.why(file, line);
        if (result.found) {
          vscode.window.showInformationMessage(
            `Line ${line}: written by ${result.agent} in session ${result.sessionId?.slice(0, 8)} (${result.prompt?.slice(0, 100)})`
          );
        } else {
          vscode.window.showInformationMessage(`Line ${line}: no trace provenance found`);
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Trace: ${err.message}`);
      }
    }),

    vscode.commands.registerCommand('trace.sessionHistory', async () => {
      try {
        const sessions = await provider.sessions();
        if (!sessions.length) {
          vscode.window.showInformationMessage('No trace sessions found');
          return;
        }
        const items = sessions.map(s => ({
          label: `${s.agent} — ${s.id.slice(0, 8)}`,
          description: new Date(s.startedAt).toLocaleString(),
          detail: `Session ${s.id}`,
          session: s,
        }));
        const picked = await vscode.window.showQuickPick(items, { title: 'Trace Sessions' });
        if (picked) {
          const turns = await provider.turns(picked.session.id);
          const doc = await vscode.workspace.openTextDocument({
            content: turns.map((t, i) =>
              `Turn ${i + 1}: ${t.prompt.slice(0, 200)}${t.toolCalls ? ` (${t.toolCalls} tool calls)` : ''}`
            ).join('\n\n'),
            language: 'markdown',
          });
          await vscode.window.showTextDocument(doc, { preview: true });
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Trace: ${err.message}`);
      }
    }),

    vscode.commands.registerCommand('trace.reviewFindings', async () => {
      try {
        const findings = await provider.reviewFindings();
        if (!findings.length) {
          vscode.window.showInformationMessage('No review findings');
          return;
        }
        diagnosticCollection!.clear();
        const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
        const byFile = new Map<string, vscode.Diagnostic[]>();
        for (const f of findings) {
          const uri = wsFolder
            ? vscode.Uri.joinPath(wsFolder, f.file)
            : vscode.Uri.file(f.file);
          const range = new vscode.Range(
            Math.max(0, f.startLine - 1), 0,
            Math.max(0, (f.endLine || f.startLine) - 1), 999
          );
          const severity = f.severity === 'critical' || f.severity === 'high'
            ? vscode.DiagnosticSeverity.Error
            : f.severity === 'medium'
            ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Information;
          const diag = new vscode.Diagnostic(range, `[Trace] ${f.title}`, severity);
          diag.source = 'trace-review';
          const key = uri.toString();
          const existing = byFile.get(key) || [];
          existing.push(diag);
          byFile.set(key, existing);
        }
        for (const [uriStr, diags] of byFile) {
          diagnosticCollection!.set(vscode.Uri.parse(uriStr), diags);
        }
        vscode.window.showInformationMessage(`${findings.length} review findings loaded as diagnostics`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Trace: ${err.message}`);
      }
    }),

    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && decorator) decorator.decorate(editor);
    }),

    vscode.workspace.onDidChangeTextDocument(event => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === event.document) {
        scheduleDecorate(editor);
      }
    })
  );

  if (vscode.window.activeTextEditor && decorator) {
    decorator.decorate(vscode.window.activeTextEditor);
  }
}

export function deactivate() {
  if (decorateTimer) clearTimeout(decorateTimer);
  decorator = undefined;
}
