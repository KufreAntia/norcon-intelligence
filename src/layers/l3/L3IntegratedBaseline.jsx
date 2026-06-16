import { useState } from "react";

const C = {
  surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2",
};

const PHASE_ORDER  = ["Initiation","Planning","Execution","Monitoring & Control","Closure"];
const PHASE_COLORS = {
  Initiation:"#5d8aff", Planning:"#3ae0a2", Execution:"#2E7D52",
  "Monitoring & Control":"#e0a23a", Closure:"#8aac96",
};

const ROW_H = 46;  // px per data row — enough for two stacked date inputs
const DAY_W = 20;  // px per day in Gantt

function dBetween(a, b) {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return Math.round((db - da) / 86400000);
}
function addDays(d, n) {
  const r = new Date(typeof d === "string" ? d : d);
  r.setDate(r.getDate() + n);
  return r;
}
function toISO(d) { return d.toISOString().slice(0, 10); }
function fmtD(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"2-digit" });
}

function autoDate(items) {
  const sorted = [...items].sort((a, b) => {
    const oi = PHASE_ORDER.indexOf(a.phase), oj = PHASE_ORDER.indexOf(b.phase);
    return oi !== oj ? oi - oj : 0;
  });
  let cur = addDays(new Date(), 1);
  return sorted.map(item => {
    if (item._autoDate === false && item.startDate) return item;
    const s = new Date(cur);
    const dur = item.itemType === "milestone" ? 0 : 13;
    const e = addDays(s, dur);
    cur = addDays(e, 2);
    return { ...item, startDate: toISO(s), targetDate: toISO(e), _autoDate: true };
  });
}

// ── Gantt SVG — the entire chart rendered as one SVG ──────────────────────
function GanttSVG({ items, gStart, gEnd, DAY_W, ROW_H, phases }) {
  const totalDays = Math.max(dBetween(gStart, gEnd), 60);
  const W = totalDays * DAY_W;
  const todayX = Math.max(0, dBetween(gStart, new Date())) * DAY_W;

  // Build weeks
  const weeks = [];
  let wc = new Date(gStart);
  while (wc < gEnd) { weeks.push(new Date(wc)); wc = addDays(wc, 7); }

  // Build months
  const months = [];
  let mc = new Date(gStart.getFullYear(), gStart.getMonth(), 1);
  while (mc < gEnd) { months.push(new Date(mc)); mc = new Date(mc.getFullYear(), mc.getMonth() + 1, 1); }

  const HEADER_H = 44; // two header rows
  const PHASE_H = 24;

  // Build flat row list with y positions
  const rows = [];
  let y = HEADER_H;
  phases.forEach(phase => {
    const phItems = items.filter(i => (i.phase || "Unassigned") === phase);
    if (!phItems.length) return;
    rows.push({ type:"phase", phase, y });
    y += PHASE_H;
    phItems.forEach((item, idx) => {
      rows.push({ type:"item", item, idx, y });
      y += ROW_H;
    });
  });
  const totalH = y;

  return (
    <svg
      width={W}
      height={totalH}
      style={{ display:"block", overflow:"visible" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── Background ── */}
      <rect width={W} height={totalH} fill={C.surface}/>

      {/* ── Month header (top 22px) ── */}
      <rect x={0} y={0} width={W} height={22} fill={C.surface2}/>
      {months.map((m, i) => {
        const x = Math.max(0, dBetween(gStart, m)) * DAY_W;
        const label = m.toLocaleDateString("en-GB", { month:"short", year:"numeric" });
        return (
          <g key={i}>
            <line x1={x} y1={0} x2={x} y2={22} stroke={C.border} strokeWidth={1}/>
            <text x={x+4} y={15} fill={C.muted} fontSize={9} fontFamily="system-ui">{label}</text>
          </g>
        );
      })}

      {/* ── Week header (22–44px) ── */}
      <rect x={0} y={22} width={W} height={22} fill={C.surface2}/>
      <line x1={0} y1={44} x2={W} y2={44} stroke={C.border} strokeWidth={2}/>
      {weeks.map((w, i) => {
        const x = Math.max(0, dBetween(gStart, w)) * DAY_W;
        const label = w.toLocaleDateString("en-GB", { day:"2-digit", month:"short" });
        return (
          <g key={i}>
            <line x1={x} y1={22} x2={x} y2={44} stroke={C.border} strokeWidth={1} strokeOpacity={0.4}/>
            <text x={x+2} y={36} fill={C.muted} fontSize={8} fontFamily="system-ui" opacity={0.7}>{label}</text>
          </g>
        );
      })}

      {/* ── Today line (full height) ── */}
      <line x1={todayX} y1={0} x2={todayX} y2={totalH} stroke={C.accentL} strokeWidth={2} opacity={0.5}/>

      {/* ── Row backgrounds + grid ── */}
      {rows.map((row, ri) => {
        if (row.type === "phase") {
          return (
            <g key={ri}>
              <rect x={0} y={row.y} width={W} height={PHASE_H} fill={C.surface}/>
              <line x1={0} y1={row.y+PHASE_H} x2={W} y2={row.y+PHASE_H} stroke={C.border} strokeWidth={1} opacity={0.4}/>
            </g>
          );
        }
        const bg = row.idx % 2 === 0 ? C.surface : C.surface2;
        return (
          <g key={ri}>
            <rect x={0} y={row.y} width={W} height={ROW_H} fill={bg}/>
            {/* Week grid lines */}
            {weeks.map((_, wi) => (
              <line key={wi} x1={wi*7*DAY_W} y1={row.y} x2={wi*7*DAY_W} y2={row.y+ROW_H} stroke={C.border} strokeWidth={1} opacity={0.15}/>
            ))}
            <line x1={0} y1={row.y+ROW_H} x2={W} y2={row.y+ROW_H} stroke={C.border} strokeWidth={1} opacity={0.2}/>
          </g>
        );
      })}

      {/* ── Bars ── */}
      {rows.map((row, ri) => {
        if (row.type !== "item") return null;
        const { item, y: ry } = row;
        const isMile = item.itemType === "milestone";

        const x1 = Math.max(0, dBetween(gStart, item.startDate)) * DAY_W;
        const x2 = Math.max(x1, dBetween(gStart, item.targetDate || item.startDate)) * DAY_W + DAY_W;
        const bw = Math.max(isMile ? 12 : DAY_W, x2 - x1);
        const by = ry + ROW_H / 2;
        const color = item.color || C.accentL;

        if (isMile) {
          // Diamond shape
          const mx = x1 + 6;
          const my = by;
          return (
            <g key={ri}>
              <polygon
                points={`${mx},${my-8} ${mx+8},${my} ${mx},${my+8} ${mx-8},${my}`}
                fill={color}
                opacity={0.9}
              />
            </g>
          );
        }

        return (
          <g key={ri}>
            {/* Bar body */}
            <rect x={x1} y={by-9} width={bw} height={18} rx={3} fill={color} opacity={0.85}/>
            {/* Completion overlay */}
            {item._complete && (
              <rect x={x1} y={by-9} width={bw} height={18} rx={3} fill="none" stroke={C.activity} strokeWidth={2}/>
            )}
            {/* Label inside bar */}
            <clipPath id={`clip-${item._id}`}>
              <rect x={x1+4} y={by-9} width={Math.max(0,bw-8)} height={18}/>
            </clipPath>
            <text
              x={x1+5} y={by+3}
              fill="#ffffff"
              fontSize={9}
              fontFamily="system-ui"
              clipPath={`url(#clip-${item._id})`}
              style={{ pointerEvents:"none" }}
            >
              {item.name || item.description}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function L3IntegratedBaseline({ state, activities, milestones, member, onStateChange, onBaselineBlur }) {
  const canEdit = member?.isPM;
  const sheets  = state?.l2?.sheets || {};

  // ── Cost data ──────────────────────────────────────────────────────────
  const savedCost = sheets["03"]?.data?.costData || {};
  const [costData, setCostData] = useState(() => {
    const init = {};
    [...activities, ...milestones].forEach(a => {
      init[a._id] = savedCost[a._id] || { plannedAmount:"", actualAmount:"" };
    });
    return init;
  });

  // ── Expenditure log ────────────────────────────────────────────────────
  const [expLog, setExpLog] = useState(sheets["03"]?.data?.expenditureLog || []);
  const [newExp, setNewExp] = useState({ activityId:"", date:"", amount:"", description:"", invoiceRef:"" });

  // ── Persist helpers ────────────────────────────────────────────────────
  const saveSheet03 = (patch) => {
    onStateChange(prev => ({
      ...prev,
      l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
        "03": { ...prev.l2.sheets["03"], data: { ...prev.l2.sheets["03"]?.data, ...patch } }
      }},
    }));
  };

  const updateCost = (id, field, val) => {
    const next = { ...costData, [id]: { ...(costData[id]||{}), [field]: val } };
    setCostData(next);
    saveSheet03({ costData: next });
  };

  // ── Inline date editing ────────────────────────────────────────────────
  const updateItemDate = (taskId, itemType, field, newVal) => {
    if (!newVal) return;
    const key = itemType === "milestone" ? "milestones" : "activities";
    const oldItems = itemType === "milestone" ? milestones : activities;
    const old = oldItems.find(i => i._id === taskId);
    onBaselineBlur && onBaselineBlur(itemType, taskId, field, old?.[field]||"", newVal, old?.name||taskId);
    onStateChange(prev => {
      const d03 = prev.l2.sheets["03"]?.data || {};
      return {
        ...prev,
        l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
          "03": { ...prev.l2.sheets["03"], data: {
            ...d03,
            [key]: (d03[key]||[]).map(i => i._id === taskId ? { ...i, [field]: newVal, _autoDate: false } : i),
          }},
        }},
      };
    });
  };

  // ── Expenditure log helpers ────────────────────────────────────────────
  // Recalculate costData.actualAmount for every activity from the expenditure log
  const syncActuals = (log, currentCostData) => {
    const sums = {};
    log.forEach(e => {
      if (!e.activityId || !e.amount) return;
      sums[e.activityId] = (sums[e.activityId] || 0) + (parseFloat(e.amount) || 0);
    });
    const next = { ...currentCostData };
    // Update every activity's actualAmount to match the log sum
    Object.keys(next).forEach(id => {
      next[id] = { ...next[id], actualAmount: sums[id] ? String(sums[id]) : "" };
    });
    // Also handle any activity id that appears in sums but not yet in costData
    Object.keys(sums).forEach(id => {
      if (!next[id]) next[id] = { plannedAmount: "", actualAmount: String(sums[id]) };
    });
    return next;
  };

  const addExp = () => {
    if (!newExp.activityId || !newExp.amount) return;
    const nextLog = [...expLog, { ...newExp, id:`EXP-${String(expLog.length+1).padStart(3,"0")}`, date: newExp.date || toISO(new Date()) }];
    const nextCost = syncActuals(nextLog, costData);
    setExpLog(nextLog);
    setCostData(nextCost);
    saveSheet03({ expenditureLog: nextLog, costData: nextCost });
    setNewExp({ activityId:"", date:"", amount:"", description:"", invoiceRef:"" });
  };
  const delExp = (i) => {
    const nextLog = expLog.filter((_, j) => j !== i);
    const nextCost = syncActuals(nextLog, costData);
    setExpLog(nextLog);
    setCostData(nextCost);
    saveSheet03({ expenditureLog: nextLog, costData: nextCost });
  };

  // ── Build flat item list ───────────────────────────────────────────────
  const raw = [
    ...activities.map(a => ({ ...a, itemType:"activity",  color: PHASE_COLORS[a.phase] || C.accentL })),
    ...milestones.map(m => ({ ...m, itemType:"milestone", color: C.milestone })),
  ].filter(i => i.name || i.description);

  const items = autoDate(raw);
  const phases = [...new Set(items.map(i => i.phase || "Unassigned"))];
  phases.sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b));

  // ── Gantt range ───────────────────────────────────────────────────────
  const allD  = items.flatMap(i => [i.startDate, i.targetDate].filter(Boolean));
  const gStart = allD.length ? addDays(new Date(Math.min(...allD.map(d=>new Date(d)))), -7) : addDays(new Date(), -14);
  const gEnd   = allD.length ? addDays(new Date(Math.max(...allD.map(d=>new Date(d)))), 21) : addDays(new Date(), 90);
  const gW     = Math.max(dBetween(gStart, gEnd), 60) * DAY_W;

  // ── Cost chart data ───────────────────────────────────────────────────
  const phaseSpend = phases.map(ph => {
    const its = items.filter(i => (i.phase||"Unassigned") === ph);
    return {
      phase: ph,
      planned: its.reduce((s,i) => s+(parseFloat(costData[i._id]?.plannedAmount)||0), 0),
      actual:  its.reduce((s,i) => s+(parseFloat(costData[i._id]?.actualAmount )||0), 0),
    };
  }).filter(d => d.planned||d.actual);
  const maxBar = Math.max(...phaseSpend.map(d=>Math.max(d.planned,d.actual)), 1);
  const totalPlanned = Object.values(costData).reduce((s,c)=>s+(parseFloat(c.plannedAmount)||0),0);
  const totalActual  = expLog.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);

  // ── Shared styles ─────────────────────────────────────────────────────
  const inp = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:4, color:C.sage, fontSize:11, padding:"3px 6px", outline:"none", fontFamily:"inherit", boxSizing:"border-box", width:"100%" };
  const dateInp = { ...inp, fontSize:10, padding:"2px 4px", cursor:"pointer" };
  const TH = { background:C.surface2, fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", padding:"0 8px", whiteSpace:"nowrap" };

  // Column widths for the frozen left table
  const W_NAME = 160;
  const W_DATE = 130; // stacked start / end dates
  const W_PLAN = 76;
  const W_ACT  = 76;

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0, overflow:"hidden" }}>

      {/* ════════════════════════════════════════════════════════════
          GANTT AREA  —  LEFT frozen table  +  RIGHT SVG scroll
          ════════════════════════════════════════════════════════════ */}
      <div style={{ flex:"1 1 0", minHeight:0, display:"flex", overflow:"hidden" }}>

        {/* ── LEFT: frozen columns ─────────────────────────────── */}
        <div style={{ flexShrink:0, display:"flex", flexDirection:"column", borderRight:`2px solid ${C.border}`, background:C.surface2 }}>

          {/* Header row */}
          <div style={{ display:"flex", height:44, flexShrink:0, alignItems:"center", borderBottom:`2px solid ${C.border}` }}>
            <div style={{ ...TH, width:W_NAME, borderRight:`1px solid ${C.border}` }}>Activity / Milestone</div>
            <div style={{ ...TH, width:W_DATE, borderRight:`1px solid ${C.border}`, flexDirection:"column", justifyContent:"center", gap:1 }}>
              <span style={{ fontSize:8, color:C.muted }}>START</span>
              <span style={{ fontSize:8, color:C.muted }}>END</span>
            </div>
            <div style={{ ...TH, width:W_PLAN, textAlign:"right", borderRight:`1px solid ${C.border}` }}>Plan £</div>
            <div style={{ ...TH, width:W_ACT,  textAlign:"right" }}>Act £</div>
          </div>

          {/* Body — scrolls vertically in sync with SVG */}
          <div id="gantt-left" style={{ flex:1, overflowY:"auto", overflowX:"hidden",
            scrollbarWidth:"none", msOverflowStyle:"none" }}
            onScroll={e => { const r = document.getElementById("gantt-right"); if(r) r.scrollTop = e.target.scrollTop; }}>
            <style>{`#gantt-left::-webkit-scrollbar{display:none}`}</style>

            {phases.map(phase => {
              const phItems = items.filter(i => (i.phase||"Unassigned") === phase);
              if (!phItems.length) return null;
              return (
                <div key={phase}>
                  {/* Phase label */}
                  <div style={{ height:24, display:"flex", alignItems:"center", padding:"0 8px", background:C.surface, borderBottom:`1px solid ${C.border}44`, fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", width: W_NAME+W_DATE+W_PLAN+W_ACT }}>
                    {phase}
                  </div>

                  {/* Item rows */}
                  {phItems.map((item, idx) => {
                    const isMile = item.itemType === "milestone";
                    const cd = costData[item._id] || {};
                    const bg = idx % 2 === 0 ? C.surface : C.surface2;
                    return (
                      <div key={item._id} style={{ display:"flex", height:ROW_H, background:bg, borderBottom:`1px solid ${C.border}22`, alignItems:"center" }}>

                        {/* Name */}
                        <div style={{ width:W_NAME, padding:"0 8px", fontSize:11, color: isMile ? C.milestone : C.sage, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", borderRight:`1px solid ${C.border}22`, flexShrink:0 }}>
                          {isMile ? "◆ " : ""}{item.name || item.description || "—"}
                        </div>

                        {/* Dates — editable */}
                        <div style={{ width:W_DATE, display:"flex", flexDirection:"column", justifyContent:"center", borderRight:`1px solid ${C.border}22`, flexShrink:0, padding:"2px 4px", gap:2 }}>
                          <input
                            type="date"
                            value={item.startDate || ""}
                            disabled={!canEdit}
                            style={{ ...dateInp, width:"100%", fontSize:10 }}
                            onChange={e => updateItemDate(item._id, item.itemType, "startDate", e.target.value)}
                          />
                          {!isMile ? (
                            <input
                              type="date"
                              value={item.targetDate || ""}
                              disabled={!canEdit}
                              style={{ ...dateInp, width:"100%", fontSize:10 }}
                              onChange={e => updateItemDate(item._id, item.itemType, "targetDate", e.target.value)}
                            />
                          ) : (
                            <span style={{ fontSize:9, color:C.muted, paddingLeft:2 }}>milestone</span>
                          )}
                        </div>

                        {/* Planned cost */}
                        <div style={{ width:W_PLAN, padding:"0 4px", borderRight:`1px solid ${C.border}22`, flexShrink:0 }}>
                          {canEdit
                            ? <input style={{ ...inp, textAlign:"right" }} value={cd.plannedAmount||""} onChange={e=>updateCost(item._id,"plannedAmount",e.target.value)} placeholder="0"/>
                            : <span style={{ fontSize:10, color:C.dim, display:"block", textAlign:"right", paddingRight:4 }}>{cd.plannedAmount?`£${cd.plannedAmount}`:"—"}</span>}
                        </div>

                        {/* Actual cost */}
                        <div style={{ width:W_ACT, padding:"0 4px", flexShrink:0 }}>
                          {canEdit
                            ? <input style={{ ...inp, textAlign:"right" }} value={cd.actualAmount||""} onChange={e=>updateCost(item._id,"actualAmount",e.target.value)} placeholder="0"/>
                            : <span style={{ fontSize:10, color:C.dim, display:"block", textAlign:"right", paddingRight:4 }}>{cd.actualAmount?`£${cd.actualAmount}`:"—"}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: SVG Gantt ─────────────────────────────────── */}
        <div id="gantt-right" style={{ flex:1, overflowX:"auto", overflowY:"auto" }}
          onScroll={e => { const l = document.getElementById("gantt-left"); if(l) l.scrollTop = e.target.scrollTop; }}>
          <GanttSVG
            items={items}
            gStart={gStart}
            gEnd={gEnd}
            DAY_W={DAY_W}
            ROW_H={ROW_H}
            phases={phases}
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          COST OVERVIEW  —  below Gantt
          ════════════════════════════════════════════════════════════ */}
      <div style={{ flexShrink:0, borderTop:`2px solid ${C.border}`, background:C.surface, overflowY:"auto", maxHeight:"46%" }}>
        <div style={{ padding:"14px 16px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:12 }}>Cost Overview</div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
            {/* Phase bars */}
            {phaseSpend.length > 0 && (
              <div style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:9, fontWeight:700, color:C.muted, marginBottom:8, textTransform:"uppercase", letterSpacing:".4px" }}>Spend by Phase</div>
                {phaseSpend.map(({ phase, planned, actual }, i) => (
                  <div key={i} style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, color:C.dim, marginBottom:3 }}>{phase}</div>
                    {[["Planned", planned, C.accentL], ["Actual", actual, C.milestone]].map(([lbl, val, col]) => (
                      <div key={lbl} style={{ display:"flex", gap:6, alignItems:"center", marginBottom:2 }}>
                        <div style={{ width:44, fontSize:8, color:C.muted, textAlign:"right" }}>{lbl}</div>
                        <div style={{ flex:1, height:8, background:C.border, borderRadius:2, overflow:"hidden" }}>
                          <div style={{ width:`${(val/maxBar)*100}%`, height:"100%", background:col }}/>
                        </div>
                        <span style={{ fontSize:9, color:col, minWidth:50, textAlign:"right" }}>£{val.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Summary */}
            <div style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:9, fontWeight:700, color:C.muted, marginBottom:10, textTransform:"uppercase", letterSpacing:".4px" }}>Cost Summary</div>
              {[["Total Planned", totalPlanned, C.accentL], ["Total Actual", totalActual, C.milestone]].map(([lbl, val, col]) => (
                <div key={lbl} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>{lbl}</div>
                  <div style={{ fontSize:20, fontWeight:700, color:col }}>£{val.toLocaleString()}</div>
                </div>
              ))}
              <div style={{ paddingTop:8, borderTop:`1px solid ${C.border}` }}>
                <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>Variance</div>
                {(() => { const v = totalPlanned - totalActual; return (
                  <div style={{ fontSize:16, fontWeight:700, color: v>=0?C.activity:C.risk }}>
                    {v>=0?"":"-"}£{Math.abs(v).toLocaleString()}
                    <span style={{ fontSize:10, fontWeight:400, color:C.muted, marginLeft:6 }}>{v>=0?"under":"over"} budget</span>
                  </div>
                ); })()}
              </div>
            </div>
          </div>

          {/* ── Expenditure Log ── */}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>Expenditure Log</div>

            {canEdit && (
              <div style={{ display:"grid", gridTemplateColumns:"1.2fr 100px 90px 1.5fr 90px auto", gap:6, marginBottom:10, alignItems:"end" }}>
                {[
                  ["ACTIVITY", <select style={{...inp}} value={newExp.activityId} onChange={e=>setNewExp(p=>({...p,activityId:e.target.value}))}>
                    <option value="">Select…</option>{items.map(i=><option key={i._id} value={i._id}>{i.name||i.description}</option>)}</select>],
                  ["DATE", <input type="date" style={inp} value={newExp.date} onChange={e=>setNewExp(p=>({...p,date:e.target.value}))}/>],
                  ["AMOUNT £", <input style={inp} value={newExp.amount} onChange={e=>setNewExp(p=>({...p,amount:e.target.value}))} placeholder="0.00"/>],
                  ["DESCRIPTION", <input style={inp} value={newExp.description} onChange={e=>setNewExp(p=>({...p,description:e.target.value}))} placeholder="e.g. Invoice"/>],
                  ["REF", <input style={inp} value={newExp.invoiceRef} onChange={e=>setNewExp(p=>({...p,invoiceRef:e.target.value}))} placeholder="INV-001"/>],
                ].map(([lbl, el]) => (
                  <div key={lbl}>
                    <div style={{fontSize:8,color:C.muted,marginBottom:2,textTransform:"uppercase",letterSpacing:".4px"}}>{lbl}</div>
                    {el}
                  </div>
                ))}
                <button onClick={addExp} style={{padding:"5px 12px",background:C.accent,border:"none",borderRadius:5,color:"#fff",fontSize:11,cursor:"pointer",alignSelf:"end"}}>+ Log</button>
              </div>
            )}

            {expLog.length === 0
              ? <div style={{fontSize:11,color:C.muted,fontStyle:"italic"}}>No expenditure logged yet.</div>
              : (
                <div style={{overflowX:"auto"}}>
                  <table style={{borderCollapse:"collapse",width:"100%",fontSize:11}}>
                    <thead><tr>{["ID","Activity","Date","Amount £","Description","Ref",""].map(h=>(
                      <th key={h} style={{padding:"4px 8px",fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                    ))}</tr></thead>
                    <tbody>
                      {expLog.map((e,i)=>{
                        const act=items.find(a=>a._id===e.activityId);
                        return (
                          <tr key={i} style={{borderBottom:`1px solid ${C.border}22`}}>
                            <td style={{padding:"4px 8px",fontFamily:"monospace",fontSize:10,color:C.muted}}>{e.id}</td>
                            <td style={{padding:"4px 8px",color:C.dim}}>{act?.name||act?.description||e.activityId}</td>
                            <td style={{padding:"4px 8px",color:C.muted}}>{e.date}</td>
                            <td style={{padding:"4px 8px",color:C.accentL,fontWeight:700}}>£{parseFloat(e.amount||0).toLocaleString()}</td>
                            <td style={{padding:"4px 8px",color:C.dim}}>{e.description}</td>
                            <td style={{padding:"4px 8px",fontFamily:"monospace",fontSize:10,color:C.muted}}>{e.invoiceRef}</td>
                            <td style={{padding:"4px 8px"}}>{canEdit&&<button onClick={()=>delExp(i)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:11}}>✕</button>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot><tr>
                      <td colSpan={3} style={{padding:"5px 8px",fontSize:10,fontWeight:700,color:C.muted}}>TOTAL</td>
                      <td style={{padding:"5px 8px",fontSize:12,fontWeight:700,color:C.accentL}}>£{expLog.reduce((s,e)=>s+(parseFloat(e.amount)||0),0).toLocaleString()}</td>
                      <td colSpan={3}/>
                    </tr></tfoot>
                  </table>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
