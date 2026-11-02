# Runtime activity

The canvas subscribes to a small local runtime activity store, separate from object document state. Pending execution shows a fixed, noninteractive banner with spinner, elapsed seconds, current language, code filename (or ID), first-line preview and sequential code count. Step names link to their canvas objects. A scrollable step list distinguishes running, successful and failed cells. Executor nodes also expose aria-busy and a prominent running button. Shift+Enter follows the same store and receives the same banner.

Runtime reset is labeled separately. Completion and errors retain a dismissible terminal banner with a fixed duration, exit status and bounded failure details (last 800 characters). Starting a new run replaces the previous report. Running activity cannot be dismissed. No synthetic percentage is shown; the moving rail indicates waiting only. Reduced motion disables both animations. Elapsed ticks rerender the banner rather than the entire canvas. Activity is local to the client that initiated execution, not broadcast as document mutations.

Checks: blueprint store regression tests; tests/integration/runtime-activity.mjs with the Vite browser fixture covers pending, elapsed, completion, direct code execution, mobile bounds, reduced motion, persistent success/failure reports, failure details and navigation callbacks.
