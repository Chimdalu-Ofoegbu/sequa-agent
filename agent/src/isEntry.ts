// isEntry.ts
// ESM "is this module the directly-invoked entry point?" check. Used to guard main() in the runnable
// scripts (index.ts / reconcile.ts / noiseBot.ts) so that IMPORTING them in a test does NOT execute
// their loop / CLI side-effects. The correct check compares THIS module's file path against the path
// node was actually invoked with (process.argv[1]) — never a loose substring of the module's name
// (that wrongly fires when a test imports the module).

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/**
 * isEntry(importMetaUrl) → true iff the module identified by importMetaUrl is the script node was
 * invoked with (process.argv[1]). Returns false when the module is merely imported (e.g. by a test).
 */
export function isEntry(importMetaUrl: string): boolean {
  try {
    const argv1 = process.argv[1];
    if (!argv1) return false;
    const modulePath = resolve(fileURLToPath(importMetaUrl));
    const invokedPath = resolve(argv1);
    return modulePath === invokedPath;
  } catch {
    return false;
  }
}
