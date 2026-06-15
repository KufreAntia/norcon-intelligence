import { useState, useRef, useCallback } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };
const inp = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:4, color:C.sage, fontSize:11, padding:"4px 7px", outline:"none", boxSizing:"border-box", fontFamily:"inherit", width:"100%" };

const PHASE_ORDER  = ["Initiation","Planning","Execution","Monitoring & Control","Closure"];
const PHASE_COLORS = { Initiation:"#5d8aff", Planning:"#3ae0a2", Execution:"#2E7D52", "Monitoring & Control":"#e0a23a", Closure:"#8aac96" };
const ROW_H = 34; // px per row
const HEAD_H = 28; // px for header row
const PHASE_H = 26; // px for phase label row
const DAY_W = 22;

function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function autoAssignDates(items) {
  const sorted = [...items].sort((a, b) => {
    const oi = PHASE_ORDER.indexOf(a.phase), oj = PHASE_ORDER.indexOf(b.phase);
    return oi !== oj ? oi - oj : 0;
  });
  let cursor = addDays(new Date(), 1);
  return sorted.map(item => {
    if (item._autoDate === false && item.startDate) return item;
    const start = new Date(cursor);
    const dur   = item.itemType === "milestone" ? 1 : 14;
    const end   = addDays(start, dur - 1);
    cursor = addDays(end, 2);
    return { ...item, startDate: start.toISOString().split("T")[0], targetDate: end.toISOString().split("T")[0], _autoDate: true };
  });
}

function fmtShort(d) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function L3IntegratedBaseline({ state, activities, milestones, member, raciData, onStateChange, onBaselineBlur }) {
  const canEdit = member?.isPM;
  const sheets  = state?.l2?.sheets || {};

  // ── Cost data persisted to state ─────────────────────────────────────
  const savedCostData = sheets["03"]?.data?.costData || {};
  const [costData, setCostData] = useState(() => {
    const init = {};
    [...activities, ...milestones].forEach(a => {
      init[a._id] = savedCostData[a._id] || { plannedAmount: "", actualAmount: "", costAccount: "" };
    });
    return init;
  });

  // ── Expenditure log ───────────────────────────────────────────────────
  const savedExpLog = sheets["03"]?.data?.expenditureLog || [];
  const [expLog, setExpLog] = useState(savedExpLog);
  const [newExp, setNewExp] = useState({ activityId: "", date: "", amount: "", description: "", invoiceRef: "" });

  // ── Date editing ──────────────────────────────────────────────────────
  const [editing,   setEditing]   = useState(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd,   setEditEnd]   = useState("");

  // ── Sync scroll between left panel and right gantt ────────────────────
  const leftRef  = useRef(null);
  const rightRef = useRef(null);
  const syncing  = useRef(false);

  const syncLeft = useCallback(e => {
    if (syncing.current) return;
    syncing.current = true;
    if (leftRef.current) leftRef.current.scrollTop = e.target.scrollTop;
    syncing.current = false;
  }, []);

  const syncRight = useCallback(e => {
    if (syncing.current) return;
    syncing.current = true;
    if (rightRef.current) rightRef.current.scrollTop = e.target.scrollTop;
    syncing.current = false;
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────
  const rawItems = [
    ...activities.map(a => ({ ...a, itemType: "activity",  color: PHASE_COLORS[a.phase] || C.accentL })),
    ...milestones.map(m => ({ ...m, itemType: "milestone", color: C.milestone })),
  ].filter(i => i.name || i.description);

  const allItems = autoAssignDates(rawItems);

  const allDates  = allItems.flatMap(i => [i.startDate, i.targetDate].filter(Boolean)).map(d => new Date(d));
  const minDate   = allDates.length ? new Date(Math.min(...allDates)) : new Date();
  const maxDate   = allDates.length ? new Date(Math.max(...allDates)) : addDays(new Date(), 90);
  const ganttStart = addDays(minDate, -7);
  const ganttEnd   = addDays(maxDate, 14);
  const totalDays  = Math.max(daysBetween(ganttStart, ganttEnd), 30);
  const ganttWidth = totalDays * DAY_W;
  const todayOff   = Math.max(0, daysBetween(ganttStart, new Date()));

  // Week markers
  const weeks = [];
  let wCur = new Date(ganttStart);
  while (wCur < ganttEnd) { weeks.push(new Date(wCur)); wCur = addDays(wCur, 7); }

  // Ordered phases
  const phases = [...new Set(allItems.map(i => i.phase || "Unassigned"))];
  phases.sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b));

  // Build flat ordered row list (phase labels + items)
  const rows = [];
  phases.forEach(phase => {
    const items = allItems.filter(i => (i.phase || "Unassigned") === phase);
    if (!items.length) return;
    rows.push({ type: "phase", phase });
    items.forEach((item, idx) => rows.push({ type: "item", item, idx }));
  });

  const getBar = item => {
    const s = item.startDate, e = item.targetDate || item.startDate;
    if (!s) return null;
    const left  = Math.max(0, daysBetween(ganttStart, s));
    const width = Math.max(item.itemType === "milestone" ? 10 : DAY_W, daysBetween(s, e) * DAY_W + DAY_W);
    return { left: left * DAY_W, width };
  };

  // ── Persist helpers ───────────────────────────────────────────────────
  const persistCostData = cd => {
    onStateChange(prev => ({
      ...prev, l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
        "03": { ...prev.l2.sheets["03"], data: { ...prev.l2.sheets["03"]?.data, costData: cd } }
      }},
    }));
  };

  const persistExpLog = log => {
    onStateChange(prev => ({
      ...prev, l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
        "03": { ...prev.l2.sheets["03"], data: { ...prev.l2.sheets["03"]?.data, expenditureLog: log } }
      }},
    }));
  };

  const updateCost = (id, field, value) => {
    const next = { ...costData, [id]: { ...(costData[id] || {}), [field]: value } };
    setCostData(next);
    persistCostData(next);
  };

  const saveEdit = (taskId, itemType) => {
    if (!editStart) return;
    const key     = itemType === "milestone" ? "milestones" : "activities";
    const oldItem = (itemType === "milestone" ? milestones : activities).find(i => i._id === taskId);
    onBaselineBlur && onBaselineBlur(itemType, taskId, "startDate", oldItem?.startDate || "", editStart, oldItem?.name || taskId);
    onStateChange(prev => ({
      ...prev, l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
        "03": { ...prev.l2.sheets["03"], data: { ...prev.l2.sheets["03"].data,
          [key]: (prev.l2.sheets["03"].data?.[key] || []).map(i =>
            i._id === taskId ? { ...i, startDate: editStart, targetDate: editEnd || editStart, _autoDate: false } : i
          ),
        }},
      }},
    }));
    setEditing(null);
  };

  const addExpEntry = () => {
    if (!newExp.activityId || !newExp.amount) return;
    const entry = { ...newExp, id: `EXP-${String(expLog.length + 1).padStart(3, "0")}`, date: newExp.date || new Date().toISOString().split("T")[0] };
    const next  = [...expLog, entry];
    setExpLog(next);
    setNewExp({ activityId: "", date: "", amount: "", description: "", invoiceRef: "" });
    persistExpLog(next);
  };

  const removeExpEntry = idx => {
    const next = expLog.filter((_, i) => i !== idx);
    setExpLog(next);
    persistExpLog(next);
  };

  // ── Cost chart data ───────────────────────────────────────────────────
  const phaseSpend = phases.map(ph => {
    const items   = allItems.filter(i => (i.phase || "Unassigned") === ph);
    const planned = items.reduce((s, i) => s + (parseFloat(costData[i._id]?.plannedAmount) || 0), 0);
    const actual  = items.reduce((s, i) => s + (parseFloat(costData[i._id]?.actualAmount) || 0), 0);
    return { phase: ph, planned, actual };
  }).filter(d => d.planned > 0 || d.actual > 0);

  const maxBarVal = Math.max(...phaseSpend.map(d => Math.max(d.planned, d.actual)), 1);

  const costTimeline = (() => {
    const pts = allItems.filter(i => costData[i._id]?.plannedAmount)
      .map(i => ({ date: i.targetDate || i.startDate, v: parseFloat(costData[i._id]?.plannedAmount) || 0 }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    let cum = 0; return pts.map(p => ({ date: p.date, v: (cum += p.v) }));
  })();

  const actualByDate = (() => {
    const pts = expLog.filter(e => e.amount)
      .map(e => ({ date: e.date, v: parseFloat(e.amount) || 0 }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    let cum = 0; return pts.map(p => ({ date: p.date, v: (cum += p.v) }));
  })();

  // ── Column widths ─────────────────────────────────────────────────────
  const COL_NAME  = 200;
  const COL_PLAN  = 82;
  const COL_ACT   = 82;
  const LEFT_W    = COL_NAME + COL_PLAN + COL_ACT;

  // Shared row renderer helpers
  const rowBg    = idx => idx % 2 === 0 ? C.surface : C.surface2;
  const thSt     = { fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".4px", background: C.surface2, whiteSpace: "nowrap", padding: "0 8px", height: HEAD_H, display: "flex", alignItems: "center" };
  const phaseSt  = { fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", height: PHASE_H, display: "flex", alignItems: "center", padding: "0 8px", background: C.surface };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden", fontFamily: "inherit" }}>

      {/* ══════════════════════════════════════════════
          GANTT AREA — fixed left panel + scrollable right
      ══════════════════════════════════════════════ */}
      <div style={{ flex: "1 1 0", minHeight: 0, display: "flex", overflow: "hidden" }}>

        {/* LEFT PANEL — frozen: Name / Planned £ / Actual £ */}
        <div style={{ width: LEFT_W, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRight: `2px solid ${C.border}` }}>
          {/* Header row */}
          <div style={{ flexShrink: 0, display: "flex", height: HEAD_H, background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ ...thSt, width: COL_NAME, borderRight: `1px solid ${C.border}` }}>Activity / Milestone</div>
            <div style={{ ...thSt, width: COL_PLAN, justifyContent: "flex-end", borderRight: `1px solid ${C.border}` }}>Planned £</div>
            <div style={{ ...thSt, width: COL_ACT,  justifyContent: "flex-end" }}>Actual £</div>
          </div>
          {/* Body — synced scroll */}
          <div ref={leftRef} onScroll={syncLeft} style={{ flex: 1, overflowY: "scroll", overflowX: "hidden", scrollbarWidth: "none" }}>
            <style>{`.left-scroll::-webkit-scrollbar{display:none}`}</style>
            <div className="left-scroll">
              {rows.map((row, ri) => {
                if (row.type === "phase") return (
                  <div key={`ph-${row.phase}`} style={{ ...phaseSt, width: LEFT_W }}>{row.phase}</div>
                );
                const { item, idx } = row;
                const cd    = costData[item._id] || {};
                const isM   = item.itemType === "milestone";
                const bg    = rowBg(idx);
                return (
                  <div key={item._id} style={{ display: "flex", height: ROW_H, background: bg, borderBottom: `1px solid ${C.border}22`, alignItems: "center" }}>
                    {/* Name */}
                    <div style={{ width: COL_NAME, padding: "0 8px", fontSize: 11, color: isM ? C.milestone : C.sage, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderRight: `1px solid ${C.border}22` }}>
                      {isM ? "◆ " : ""}{item.name || item.description || "—"}
                    </div>
                    {/* Planned £ */}
                    <div style={{ width: COL_PLAN, padding: "0 4px", borderRight: `1px solid ${C.border}22` }}>
                      {canEdit
                        ? <input style={{ ...inp, textAlign: "right" }} value={cd.plannedAmount || ""} onChange={e => updateCost(item._id, "plannedAmount", e.target.value)} placeholder="0" />
                        : <span style={{ fontSize: 11, color: C.dim, display: "block", textAlign: "right", paddingRight: 4 }}>{cd.plannedAmount ? `£${cd.plannedAmount}` : "—"}</span>}
                    </div>
                    {/* Actual £ */}
                    <div style={{ width: COL_ACT, padding: "0 4px" }}>
                      {canEdit
                        ? <input style={{ ...inp, textAlign: "right" }} value={cd.actualAmount || ""} onChange={e => updateCost(item._id, "actualAmount", e.target.value)} placeholder="0" />
                        : <span style={{ fontSize: 11, color: C.dim, display: "block", textAlign: "right", paddingRight: 4 }}>{cd.actualAmount ? `£${cd.actualAmount}` : "—"}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — scrollable: week headers + gantt bars */}
        <div ref={rightRef} onScroll={syncRight} style={{ flex: 1, overflowX: "auto", overflowY: "scroll", position: "relative" }}>
          <div style={{ width: ganttWidth, minWidth: "100%", position: "relative" }}>

            {/* Week header — sticky top */}
            <div style={{ position: "sticky", top: 0, zIndex: 10, height: HEAD_H, background: C.surface2, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "stretch" }}>
              {weeks.map((w, i) => (
                <div key={i} style={{ width: 7 * DAY_W, flexShrink: 0, borderLeft: `1px solid ${C.border}`, display: "flex", alignItems: "center", paddingLeft: 4, fontSize: 9, color: C.muted }}>
                  {fmtShort(w)}
                </div>
              ))}
              {/* Today marker in header */}
              <div style={{ position: "absolute", left: todayOff * DAY_W, top: 0, bottom: 0, width: 2, background: C.accentL, opacity: 0.6 }} />
            </div>

            {/* Gantt body rows */}
            {rows.map((row, ri) => {
              if (row.type === "phase") return (
                <div key={`gph-${row.phase}`} style={{ height: PHASE_H, background: C.surface, borderBottom: `1px solid ${C.border}22`, position: "relative" }}>
                  {/* Today line through phase row */}
                  <div style={{ position: "absolute", left: todayOff * DAY_W, top: 0, bottom: 0, width: 1, background: C.accentL, opacity: 0.2 }} />
                </div>
              );

              const { item, idx } = row;
              const bar = getBar(item);
              const isM = item.itemType === "milestone";
              const isEditing = editing === item._id;
              const bg  = rowBg(idx);

              return (
                <div key={`g-${item._id}`} style={{ height: ROW_H, background: bg, borderBottom: `1px solid ${C.border}22`, position: "relative" }}>
                  {/* Week grid lines */}
                  {weeks.map((_, wi) => (
                    <div key={wi} style={{ position: "absolute", left: wi * 7 * DAY_W, top: 0, bottom: 0, width: 1, background: C.border, opacity: 0.3 }} />
                  ))}
                  {/* Today line */}
                  <div style={{ position: "absolute", left: todayOff * DAY_W, top: 0, bottom: 0, width: 1, background: C.accentL, opacity: 0.4 }} />

                  {/* Bar */}
                  {bar && (isM ? (
                    <div
                      title={`${item.name} — ${fmtShort(item.startDate)}`}
                      onClick={() => canEdit && (setEditing(item._id), setEditStart(item.startDate || ""), setEditEnd(item.targetDate || ""))}
                      style={{ position: "absolute", left: bar.left, top: "50%", transform: "translateY(-50%) rotate(45deg)", width: 10, height: 10, background: item.color, borderRadius: 2, cursor: canEdit ? "pointer" : "default", zIndex: 2 }}
                    />
                  ) : (
                    <div
                      title={`${item.name} · ${fmtShort(item.startDate)} → ${fmtShort(item.targetDate)}`}
                      onClick={() => canEdit && (setEditing(item._id), setEditStart(item.startDate || ""), setEditEnd(item.targetDate || ""))}
                      style={{ position: "absolute", left: bar.left, top: "50%", transform: "translateY(-50%)", height: 16, width: bar.width, background: item.color + "cc", borderRadius: 3, cursor: canEdit ? "pointer" : "default", zIndex: 2, display: "flex", alignItems: "center", paddingLeft: 5, overflow: "hidden" }}>
                      <span style={{ fontSize: 9, color: "#fff", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{item.name}</span>
                    </div>
                  ))}

                  {/* Date edit popover */}
                  {isEditing && (
                    <div style={{ position: "absolute", top: ROW_H + 2, left: bar?.left || 0, zIndex: 30, background: C.surface, border: `1px solid ${C.accentL}`, borderRadius: 7, padding: 10, display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap", boxShadow: "0 6px 20px #0008" }}
                      onClick={e => e.stopPropagation()}>
                      <span style={{ fontSize: 10, color: C.muted }}>Start</span>
                      <input type="date" value={editStart} onChange={e => setEditStart(e.target.value)} style={{ ...inp, width: 130 }} />
                      <span style={{ fontSize: 10, color: C.muted }}>End</span>
                      <input type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)} style={{ ...inp, width: 130 }} />
                      <button onClick={() => saveEdit(item._id, item.itemType)} style={{ padding: "4px 10px", background: C.accent, border: "none", borderRadius: 4, color: "#fff", fontSize: 11, cursor: "pointer" }}>Save</button>
                      <button onClick={() => setEditing(null)} style={{ padding: "4px 8px", background: "none", border: `1px solid ${C.border}`, borderRadius: 4, color: C.muted, fontSize: 11, cursor: "pointer" }}>✕</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          COST OVERVIEW — below gantt, scrollable
      ══════════════════════════════════════════════ */}
      <div style={{ flexShrink: 0, borderTop: `2px solid ${C.border}`, background: C.surface, overflowY: "auto", maxHeight: "48%" }}>
        <div style={{ padding: "14px 16px 0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 12 }}>Cost Overview</div>

          {/* Charts side by side */}
          {(costTimeline.length > 0 || phaseSpend.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              {/* Cumulative line chart */}
              {costTimeline.length > 0 && (
                <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".4px" }}>Cumulative Cost — Planned vs Actual</div>
                  <svg width="100%" height="110" viewBox="0 0 300 110" style={{ display: "block" }}>
                    {(() => {
                      const all  = [...costTimeline, ...actualByDate];
                      if (!all.length) return null;
                      const dates = all.map(p => new Date(p.date)).sort((a, b) => a - b);
                      const minD  = dates[0], maxD = dates[dates.length - 1];
                      const span  = Math.max(maxD - minD, 1);
                      const maxV  = Math.max(...costTimeline.map(p => p.v), ...actualByDate.map(p => p.v), 1);
                      const xOf   = d => 30 + ((new Date(d) - minD) / span) * 250;
                      const yOf   = v => 95 - (v / maxV) * 80;
                      const pPath = costTimeline.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.date).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(" ");
                      const aPath = actualByDate.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.date).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(" ");
                      return (<>
                        <line x1="30" y1="95" x2="280" y2="95" stroke={C.border} strokeWidth="1" />
                        <line x1="30" y1="10" x2="30"  y2="95" stroke={C.border} strokeWidth="1" />
                        <text x="32" y="14" fill={C.muted} fontSize="7">£{maxV.toLocaleString()}</text>
                        {pPath && <path d={pPath} stroke={C.accentL}  fill="none" strokeWidth="2" strokeDasharray="4 2" />}
                        {aPath && <path d={aPath} stroke={C.milestone} fill="none" strokeWidth="2" />}
                        <circle cx="248" cy="104" r="3" fill={C.accentL}  /><text x="254" y="107" fill={C.accentL}  fontSize="7">Planned</text>
                        <circle cx="248" cy="96"  r="3" fill={C.milestone}/><text x="254" y="99"  fill={C.milestone} fontSize="7">Actual</text>
                      </>);
                    })()}
                  </svg>
                </div>
              )}

              {/* Phase bar chart */}
              {phaseSpend.length > 0 && (
                <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".4px" }}>Spend by Phase</div>
                  {phaseSpend.map(({ phase, planned, actual }, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: C.dim, marginBottom: 3 }}>{phase}</div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 2 }}>
                        <div style={{ flex: 1, height: 8, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${(planned / maxBarVal) * 100}%`, height: "100%", background: C.accentL }} />
                        </div>
                        <span style={{ fontSize: 9, color: C.accentL, minWidth: 52, textAlign: "right" }}>£{planned.toLocaleString()}</span>
                      </div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <div style={{ flex: 1, height: 8, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${(actual / maxBarVal) * 100}%`, height: "100%", background: C.milestone }} />
                        </div>
                        <span style={{ fontSize: 9, color: C.milestone, minWidth: 52, textAlign: "right" }}>£{actual.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 8, color: C.accentL }}>▬ Planned</span>
                    <span style={{ fontSize: 8, color: C.milestone }}>▬ Actual</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Expenditure Log ── */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, paddingBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 }}>Expenditure Log</div>

            {/* Add entry form */}
            {canEdit && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 90px 1.5fr 100px auto", gap: 6, marginBottom: 10, alignItems: "end" }}>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, marginBottom: 3 }}>ACTIVITY</div>
                  <select style={inp} value={newExp.activityId} onChange={e => setNewExp(p => ({ ...p, activityId: e.target.value }))}>
                    <option value="">Select…</option>
                    {allItems.map(i => <option key={i._id} value={i._id}>{i.name || i.description}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, marginBottom: 3 }}>DATE</div>
                  <input type="date" style={inp} value={newExp.date} onChange={e => setNewExp(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, marginBottom: 3 }}>AMOUNT £</div>
                  <input style={inp} value={newExp.amount} onChange={e => setNewExp(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, marginBottom: 3 }}>DESCRIPTION</div>
                  <input style={inp} value={newExp.description} onChange={e => setNewExp(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Subcontractor invoice" />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, marginBottom: 3 }}>REF</div>
                  <input style={inp} value={newExp.invoiceRef} onChange={e => setNewExp(p => ({ ...p, invoiceRef: e.target.value }))} placeholder="INV-001" />
                </div>
                <button onClick={addExpEntry} style={{ padding: "5px 12px", background: C.accent, border: "none", borderRadius: 5, color: "#fff", fontSize: 11, cursor: "pointer" }}>+ Log</button>
              </div>
            )}

            {expLog.length === 0
              ? <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>No expenditure entries logged yet.</div>
              : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                    <thead>
                      <tr>
                        {["ID", "Activity", "Date", "Amount £", "Description", "Ref"].map(h => (
                          <th key={h} style={{ padding: "5px 8px", fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", textAlign: "left", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                        {canEdit && <th style={{ borderBottom: `1px solid ${C.border}` }} />}
                      </tr>
                    </thead>
                    <tbody>
                      {expLog.map((e, i) => {
                        const act = allItems.find(a => a._id === e.activityId);
                        return (
                          <tr key={i} style={{ borderBottom: `1px solid ${C.border}22` }}>
                            <td style={{ padding: "5px 8px", fontFamily: "monospace", fontSize: 10, color: C.muted }}>{e.id}</td>
                            <td style={{ padding: "5px 8px", color: C.dim }}>{act?.name || act?.description || e.activityId}</td>
                            <td style={{ padding: "5px 8px", color: C.muted }}>{e.date}</td>
                            <td style={{ padding: "5px 8px", color: C.accentL, fontWeight: 700 }}>£{parseFloat(e.amount || 0).toLocaleString()}</td>
                            <td style={{ padding: "5px 8px", color: C.dim }}>{e.description}</td>
                            <td style={{ padding: "5px 8px", fontFamily: "monospace", fontSize: 10, color: C.muted }}>{e.invoiceRef}</td>
                            {canEdit && <td style={{ padding: "5px 8px" }}><button onClick={() => removeExpEntry(i)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11 }}>✕</button></td>}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{ padding: "6px 8px", fontSize: 10, fontWeight: 700, color: C.muted }}>TOTAL</td>
                        <td style={{ padding: "6px 8px", fontSize: 12, fontWeight: 700, color: C.accentL }}>£{expLog.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0).toLocaleString()}</td>
                        <td colSpan={canEdit ? 3 : 2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
