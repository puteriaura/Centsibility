// Polyfill stub for node:async_hooks — required by some SSR-oriented
// dependencies (e.g. @tanstack/react-start) that import this Node module.
// Vite aliases `node:async_hooks` and `async_hooks` to this empty file
// so the browser build doesn't crash.
export default {};
export class AsyncLocalStorage {
  getStore() {
    return undefined;
  }
  run(_store: unknown, fn: () => unknown) {
    return fn();
  }
}
