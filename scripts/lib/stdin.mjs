/**
 * Shared stdin utilities for SP governance hook scripts.
 * Provides timeout-protected stdin reading to prevent hangs on Linux and Windows.
 *
 * Adapted from oh-my-claudecode's lib/stdin.mjs pattern.
 * The blocking `fs.readFileSync(0)` pattern hangs indefinitely when the parent
 * process doesn't properly close stdin. This function uses event-based reading
 * with a timeout as a safety net.
 */

/**
 * Read all stdin with timeout to prevent indefinite hang.
 *
 * @param {number} timeoutMs - Maximum time to wait for stdin (default: 5000ms)
 * @returns {Promise<string>} - The stdin content, or empty string on error/timeout
 */
export async function readStdin(timeoutMs = 5000) {
  return new Promise((resolve) => {
    const chunks = [];
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        process.stdin.removeAllListeners();
        process.stdin.destroy();
        resolve(Buffer.concat(chunks).toString('utf-8'));
      }
    }, timeoutMs);

    process.stdin.on('data', (chunk) => {
      chunks.push(chunk);
    });

    process.stdin.on('end', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        resolve(Buffer.concat(chunks).toString('utf-8'));
      }
    });

    process.stdin.on('error', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        resolve('');
      }
    });

    // If stdin is already ended (e.g. empty pipe), 'end' fires immediately.
    // But if stdin is a TTY or never piped, we need the timeout as safety net.
    if (process.stdin.readableEnded) {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        resolve(Buffer.concat(chunks).toString('utf-8'));
      }
    }
  });
}
