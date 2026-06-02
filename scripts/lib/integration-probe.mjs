// integration-probe.mjs — lightweight runtime mode detection
//
// v10 simplification: SP no longer hardcodes OMC/ECC names.
// It just reports "do we see any installed plugins?" → with-plugins vs sp-only.
//
// The v9 concept of "sp-omc / sp-ecc / full" tri-state is gone.
// Anyone needing finer-grained info should call discoverCapabilities() directly.

import { readInstalledPlugins, defaultInstalledPluginsPath } from './plugin-index.mjs';

export function probeIntegration(workspaceRoot, opts = {}) {
  const { installedPath = defaultInstalledPluginsPath() } = opts;
  let installed = [];
  try { installed = readInstalledPlugins(installedPath); }
  catch { installed = []; }
  return {
    mode: installed.length > 0 ? 'with-plugins' : 'sp-only',
    plugin_count: installed.length,
  };
}
