import { solve, type SolverInput } from './solver';

/**
 * The automatic seating off the page's thread (a phone's screen stays responsive while it works):
 * { input } in; { type: 'progress', … } after each restart, then { type: 'done', result } or
 * { type: 'error' } out.
 */
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<{ input: SolverInput }>) => void) | null;
  postMessage(message: unknown): void;
};

scope.onmessage = (e) => {
  try {
    const result = solve(e.data.input, (progress) => scope.postMessage({ type: 'progress', ...progress }));
    scope.postMessage({ type: 'done', result });
  } catch (err) {
    scope.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
