import { describe, it, expect, vi } from 'vitest';
import { TraceProvider } from '../src/provider';
import type { TraceCLI } from '../src/cli';

function mockCLI(overrides: Partial<TraceCLI> = {}): TraceCLI {
  return {
    exec: vi.fn().mockResolvedValue('{}'),
    why: vi.fn().mockResolvedValue({ found: false }),
    sessions: vi.fn().mockResolvedValue([]),
    turns: vi.fn().mockResolvedValue([]),
    reviewFindings: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as TraceCLI;
}

describe('TraceProvider', () => {
  describe('why', () => {
    it('returns found result when CLI finds provenance', async () => {
      const cli = mockCLI({
        why: vi.fn().mockResolvedValue({
          found: true,
          session_id: 'sess-123',
          turn_id: 'turn-456',
          agent: 'claude',
          timestamp: 1700000000,
          prompt: 'fix the bug',
        }),
      });
      const provider = new TraceProvider(cli);
      const result = await provider.why('src/main.ts', 42);
      expect(result.found).toBe(true);
      expect(result.sessionId).toBe('sess-123');
      expect(result.agent).toBe('claude');
      expect(result.prompt).toBe('fix the bug');
    });

    it('returns not found on CLI error', async () => {
      const cli = mockCLI({
        why: vi.fn().mockRejectedValue(new Error('CLI not found')),
      });
      const provider = new TraceProvider(cli);
      const result = await provider.why('src/main.ts', 42);
      expect(result.found).toBe(false);
    });
  });

  describe('sessions', () => {
    it('maps snake_case to camelCase', async () => {
      const cli = mockCLI({
        sessions: vi.fn().mockResolvedValue([
          { id: 's1', agent: 'copilot', started_at: 1700000000 },
        ]),
      });
      const provider = new TraceProvider(cli);
      const sessions = await provider.sessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].startedAt).toBe(1700000000);
      expect(sessions[0].agent).toBe('copilot');
    });

    it('returns empty on error', async () => {
      const cli = mockCLI({
        sessions: vi.fn().mockRejectedValue(new Error('fail')),
      });
      const provider = new TraceProvider(cli);
      expect(await provider.sessions()).toEqual([]);
    });
  });

  describe('turns', () => {
    it('parses turn data', async () => {
      const cli = mockCLI({
        turns: vi.fn().mockResolvedValue([
          { id: 't1', prompt: 'do thing', tool_calls: 3, started_at: 100 },
        ]),
      });
      const provider = new TraceProvider(cli);
      const turns = await provider.turns('sess-1');
      expect(turns[0].toolCalls).toBe(3);
      expect(turns[0].prompt).toBe('do thing');
    });
  });

  describe('reviewFindings', () => {
    it('maps finding fields', async () => {
      const cli = mockCLI({
        reviewFindings: vi.fn().mockResolvedValue([
          { file: 'a.ts', start_line: 10, end_line: 15, severity: 'high', title: 'Bug', detail: 'details' },
        ]),
      });
      const provider = new TraceProvider(cli);
      const findings = await provider.reviewFindings();
      expect(findings[0].startLine).toBe(10);
      expect(findings[0].severity).toBe('high');
    });
  });

  describe('fileProvenance', () => {
    it('caches results for 30s', async () => {
      const execFn = vi.fn().mockResolvedValue(JSON.stringify({
        lines: [{ line: 1, agent: 'claude', session_id: 's1', timestamp: 100 }],
      }));
      const cli = mockCLI({ exec: execFn });
      const provider = new TraceProvider(cli);

      const first = await provider.fileProvenance('a.ts');
      expect(first).toHaveLength(1);
      expect(first[0].agent).toBe('claude');

      const second = await provider.fileProvenance('a.ts');
      expect(second).toHaveLength(1);
      expect(execFn).toHaveBeenCalledTimes(1);
    });

    it('returns empty on error', async () => {
      const cli = mockCLI({
        exec: vi.fn().mockRejectedValue(new Error('fail')),
      });
      const provider = new TraceProvider(cli);
      expect(await provider.fileProvenance('a.ts')).toEqual([]);
    });
  });
});
