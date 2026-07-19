// @ts-nocheck
// Per-project release settings, persisted in localStorage. These are real
// preferences that other parts of the workspace actually read — nothing here
// is cosmetic. Keyed by the GitHub owner/repo so a project keeps its settings
// across reloads and sessions.
import { parseGitUrl } from './repoCache';

const VERSION = 'v1';
export const DEFAULT_SETTINGS = {
  watchChanges: true,        // show the continuous-validation change window
  deployGateReadiness: 0,    // 0 = off; otherwise block deploy below this %
  blockOnHigh: false,        // treat "high" findings as deployment blockers too
  requireApproval: true,     // require at least one recorded approval to deploy
  notifyChannel: '',         // integration id to notify on new changes ('' = none)
};

function key(project) {
  const p = parseGitUrl(project?.git_url || '');
  const id = p ? `${p.owner}/${p.repo}` : project?.id || 'unknown';
  const b = project?.git_branch || 'main';
  return `lh_settings_${VERSION}_${id}#${b}`;
}

export function loadSettings(project) {
  try {
    const s = localStorage.getItem(key(project));
    return { ...DEFAULT_SETTINGS, ...(s ? JSON.parse(s) : {}) };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(project, patch) {
  const next = { ...loadSettings(project), ...patch };
  try { localStorage.setItem(key(project), JSON.stringify(next)); } catch {}
  return next;
}
