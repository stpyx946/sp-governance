#!/usr/bin/env node
/**
 * sp-learning-status/check.mjs
 * Reads ECC continuous learning data and outputs a summary.
 * Usage: node check.mjs
 */
import { detectECC } from '../../scripts/lib/integration.mjs';

try {
  const ecc = detectECC();

  if (!ecc.found) {
    console.log(JSON.stringify({
      ecc_installed: false,
      learning_available: false,
      message: 'ECC is not installed. Learning data unavailable.',
    }, null, 2));
    process.exit(0);
  }

  // Dynamic import to fail-safe if bridge has issues
  let bridge;
  try {
    bridge = await import('../../scripts/adapters/ecc-learning-bridge.mjs');
  } catch (e) {
    console.log(JSON.stringify({
      ecc_installed: true,
      ecc_version: ecc.version,
      learning_available: false,
      error: `Failed to load learning bridge: ${e.message}`,
    }, null, 2));
    process.exit(0);
  }

  const learningInfo = bridge.isLearningAvailable(ecc.path);
  const learningPath = bridge.getECCLearningPath(ecc.path);

  const result = {
    ecc_installed: true,
    ecc_version: ecc.version,
    learning_available: learningInfo.available,
    learning_version: learningPath.version,
    learning_path: learningPath.path,
    instincts_count: learningInfo.instincts_count,
  };

  // Include top instincts if available
  if (learningInfo.available && learningPath.path) {
    const { instincts, total_available } = bridge.readInstincts(learningPath.path, {
      maxItems: 10,
      minConfidence: 0.5,
    });
    result.total_available = total_available;
    result.top_instincts = instincts;
  }

  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
