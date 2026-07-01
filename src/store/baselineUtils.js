// baselineUtils.js — snapshot builder and baseline helpers

// Build a point-in-time snapshot of the project baseline from L2 sheets
export function buildSnapshot(sheets) {
  const charter      = sheets["01"]?.data?.charter    || {};
  const activities   = sheets["03"]?.data?.activities || [];
  const milestones   = sheets["03"]?.data?.milestones || [];
  const risks        = sheets["05"]?.data?.risks      || [];
  const deliverables = sheets["07"]?.data?.deliverables || [];

  return {
    charter:      JSON.parse(JSON.stringify(charter)),
    activities:   JSON.parse(JSON.stringify(activities)),
    milestones:   JSON.parse(JSON.stringify(milestones)),
    risks:        JSON.parse(JSON.stringify(risks)),
    deliverables: JSON.parse(JSON.stringify(deliverables)),
    // charter.benefits is captured inside charter above, but also extracted
    // explicitly here so baseline comparisons can reference it directly
    benefits:     JSON.parse(JSON.stringify(charter.benefits || [])),
    budget:       charter.budget || "",
    capturedAt:   new Date().toISOString(),
  };
}

// Check whether the four enforced sheets are all locked
export function isBaselineReady(sheets) {
  return ["01","02","03","04"].every(id => sheets[id]?.locked);
}

// Derive current phase from activity completion
// Returns the phase containing the most in-progress activities.
// Reads _complete (boolean). Sheet03Schedule now initialises both
// _complete and _state so both are available on every activity.
export function deriveCurrentPhase(activities, milestones) {
  const PHASE_ORDER = ["Concept","Definition","Development","Execution","Handover & Closeout"];
  const all = [...(activities||[]), ...(milestones||[])];
  if (!all.length) return "Concept";

  // Find the first phase that has incomplete items
  for (const phase of PHASE_ORDER) {
    const phaseItems = all.filter(i => i.phase === phase);
    if (!phaseItems.length) continue;
    const hasIncomplete = phaseItems.some(i => !i._complete);
    if (hasIncomplete) return phase;
  }
  // All items complete — return final phase
  return PHASE_ORDER[PHASE_ORDER.length - 1];
}
