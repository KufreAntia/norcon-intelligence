// NorCon Projects — Global App State
// Single source of truth shared across all layers

export const INITIAL_STATE = {
  // ── Active layer ─────────────────────────────────────────────────────────
  activeLayer: 'L1', // 'L1' | 'L2' | 'L3'

  // ── Project metadata (set in L2 setup screen) ────────────────────────────
  project: {
    name: '',
    code: '',          // e.g. "WF" → used for login code prefix
    teamSize: 0,
    status: 'draft',   // 'draft' | 'active' | 'closed'
  },

  // ── Baseline (frozen at project launch, never modified) ───────────────────
  baseline: null,
  // baseline shape when set:
  // {
  //   version:       1,
  //   confirmedDate: 'YYYY-MM-DD',
  //   confirmedBy:   'LOGIN-CODE',
  //   snapshot: {
  //     charter:     { ... },   // from sheets["01"].data.charter
  //     activities:  [ ... ],   // from sheets["03"].data.activities
  //     milestones:  [ ... ],   // from sheets["03"].data.milestones
  //     budget:      '...',     // from charter.budget
  //   }
  // }

  // ── Current Approved Plan (evolves with approved CCRs) ────────────────────
  currentPlan: null,
  // currentPlan shape:
  // {
  //   version:     1,            // increments with each applied CCR
  //   lastUpdated: 'YYYY-MM-DD',
  //   lastCCR:     'CCR-001',
  //   snapshot: { ... }          // same shape as baseline.snapshot
  // }

  // ── Layer 1 output ────────────────────────────────────────────────────────
  l1: {
    charter: null,
    elements: [],      // flat Project Element list with _state, _id, type etc.
    complete: false,   // true once PM clicks "Send to Personalisation"
  },

  // ── Layer 2 state ─────────────────────────────────────────────────────────
  l2: {
    currentSheet: 'setup', // 'setup' | '01' ... '10'

    // Sheet completion status
    sheets: {
      '01': { status: 'empty', locked: false, data: {} },
      '02': { status: 'empty', locked: false, data: { teamMembers: [] } },
      '03': { status: 'empty', locked: false, data: { activities: [] } },
      '04': { status: 'empty', locked: false, data: { raciRows: [] } },
      '05': { status: 'empty', locked: false, data: { risks: [] } },
      '06': { status: 'empty', locked: false, data: { changes: [] } },
      '07': { status: 'empty', locked: false, data: { deliverables: [] } },
      '08': { status: 'empty', locked: false, data: { stakeholders: [] } },
      '10': { status: 'empty', locked: false, data: { enabled: {}, selected: {}, actLinks: {} } },
    },

    // Generated login codes: [{ code, name, role, rights: [] }]
    loginCodes: [],
  },

  // ── Layer 3 state ─────────────────────────────────────────────────────────
  l3: {
    unlocked: false,
    activeElements: [],
  },
};

// Sheet metadata
export const SHEETS = [
  { id: '01', label: 'Charter',        icon: 'ti-file-description', enforced: false },
  { id: '02', label: 'Team',           icon: 'ti-users',            enforced: true  },
  { id: '03', label: 'Schedule',       icon: 'ti-calendar',         enforced: true  },
  { id: '04', label: 'RACI',           icon: 'ti-table',            enforced: true  },
  { id: '05', label: 'Risks',          icon: 'ti-alert-triangle',   enforced: false },
  { id: '06', label: 'Change Control', icon: 'ti-git-branch',       enforced: false },
  { id: '07', label: 'KD Tracker',     icon: 'ti-target',           enforced: false },
  { id: '08', label: 'Stakeholders',        icon: 'ti-users-group', enforced: false },
  { id: '10', label: 'Sustainability', icon: 'ti-leaf',             enforced: false },
];

// Status config
export const STATUS_CONFIG = {
  empty:       { label: 'Empty',       color: 'var(--color-text-secondary)',  bg: 'var(--color-background-secondary)' },
  'ai-draft':  { label: 'AI Draft',    color: 'var(--color-text-info)',       bg: 'var(--color-background-info)'      },
  'in-progress':{ label: 'In Progress',color: 'var(--color-text-warning)',    bg: 'var(--color-background-warning)'   },
  approved:    { label: 'Approved',    color: 'var(--color-text-success)',    bg: 'var(--color-background-success)'   },
};

// Generate a login code: PREFIX-XXXX
export function generateLoginCode(projectCode, existingCodes = []) {
  const prefix = (projectCode || 'NC').toUpperCase().slice(0, 4);
  let code;
  do {
    const num = Math.floor(1000 + Math.random() * 9000);
    code = `${prefix}-${num}`;
  } while (existingCodes.includes(code));
  return code;
}

// Derive sheet status from data
export function deriveSheetStatus(sheetId, sheetData, l1Elements) {
  if (sheetData.locked) return 'approved';
  const hasAIData = l1Elements && l1Elements.length > 0;
  const hasUserData = Object.values(sheetData.data || {}).some(v =>
    Array.isArray(v) ? v.length > 0 : (v !== '' && v !== null && v !== undefined)
  );
  if (hasUserData) return 'in-progress';
  if (hasAIData) return 'ai-draft';
  return 'empty';
}

// Check if a sheet is accessible given the enforced order
// Enforced order: setup → 02 → 03 → 04 → then free
export function isSheetAccessible(sheetId, sheets) {
  const enforced = ['02', '03', '04'];
  const idx = enforced.indexOf(sheetId);
  if (idx === -1) return true; // not enforced, always accessible
  // 02 always accessible
  if (sheetId === '02') return true;
  // 03 requires 02 approved
  if (sheetId === '03') return sheets['02'].locked;
  // 04 requires 03 approved
  if (sheetId === '04') return sheets['03'].locked;
  return true;
}
