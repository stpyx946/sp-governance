// audit-log.mjs — rotation-aware audit log writer

import { existsSync, statSync, renameSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const MAX_AUDIT_SIZE = 5 * 1024 * 1024;  // 5 MB
const MAX_AUDIT_HISTORY = 3;

export function writeAuditLog(workspaceRoot, entry) {
  try {
    const logDir = join(workspaceRoot, '.omc', 'logs');
    mkdirSync(logDir, { recursive: true });
    const logPath = join(logDir, 'pm-audit.jsonl');

    if (existsSync(logPath)) {
      try {
        const st = statSync(logPath);
        if (st.size > MAX_AUDIT_SIZE) {
          for (let i = MAX_AUDIT_HISTORY; i >= 1; i--) {
            const older = `${logPath}.${i}`;
            const newer = i === 1 ? logPath : `${logPath}.${i - 1}`;
            if (existsSync(newer)) {
              try { renameSync(newer, older); } catch { /* ignore */ }
            }
          }
        }
      } catch { /* ignore */ }
    }

    const enriched = { ts: new Date().toISOString(), ...entry };
    appendFileSync(logPath, JSON.stringify(enriched) + '\n');
  } catch { /* never fail on audit */ }
}
