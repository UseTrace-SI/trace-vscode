import { TraceCLI } from './cli';

export interface WhyResult {
  found: boolean;
  sessionId?: string;
  turnId?: string;
  agent?: string;
  timestamp?: number;
  prompt?: string;
}

export interface Session {
  id: string;
  agent: string;
  startedAt: number;
}

export interface Turn {
  id: string;
  prompt: string;
  toolCalls: number;
  startedAt: number;
}

export interface ReviewFinding {
  file: string;
  startLine: number;
  endLine: number;
  severity: string;
  title: string;
  detail: string;
}

export interface LineProvenance {
  line: number;
  agent: string;
  sessionId: string;
  timestamp: number;
}

export class TraceProvider {
  private cli: TraceCLI;
  private cache = new Map<string, { expires: number; data: LineProvenance[] }>();

  constructor(cli: TraceCLI) {
    this.cli = cli;
  }

  async why(file: string, line: number): Promise<WhyResult> {
    try {
      const result = await this.cli.why(file, line);
      return {
        found: Boolean(result.found),
        sessionId: result.session_id,
        turnId: result.turn_id,
        agent: result.agent,
        timestamp: result.timestamp,
        prompt: result.prompt,
      };
    } catch {
      return { found: false };
    }
  }

  async sessions(): Promise<Session[]> {
    try {
      const raw = await this.cli.sessions();
      return raw.map((s: any) => ({
        id: s.id,
        agent: s.agent || 'unknown',
        startedAt: s.started_at || 0,
      }));
    } catch {
      return [];
    }
  }

  async turns(sessionId: string): Promise<Turn[]> {
    try {
      const raw = await this.cli.turns(sessionId);
      return raw.map((t: any) => ({
        id: t.id,
        prompt: t.prompt || '',
        toolCalls: t.tool_calls || 0,
        startedAt: t.started_at || 0,
      }));
    } catch {
      return [];
    }
  }

  async reviewFindings(): Promise<ReviewFinding[]> {
    try {
      const raw = await this.cli.reviewFindings();
      return raw.map((f: any) => ({
        file: f.file || '',
        startLine: f.start_line || 0,
        endLine: f.end_line || 0,
        severity: f.severity || 'info',
        title: f.title || '',
        detail: f.detail || '',
      }));
    } catch {
      return [];
    }
  }

  async fileProvenance(file: string): Promise<LineProvenance[]> {
    const cacheKey = file;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;

    try {
      const output = await this.cli.exec(['why', '--json', '--file', file]);
      const parsed = JSON.parse(output);
      const lines: LineProvenance[] = (parsed.lines || []).map((l: any) => ({
        line: l.line,
        agent: l.agent || 'unknown',
        sessionId: l.session_id || '',
        timestamp: l.timestamp || 0,
      }));
      this.cache.set(cacheKey, { expires: Date.now() + 30000, data: lines });
      return lines;
    } catch {
      return [];
    }
  }
}
