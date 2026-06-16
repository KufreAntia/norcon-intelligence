import { useMemo } from "react";

const C = {
  surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2",
};

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || C.sage, marginBottom: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>}
    </div>
  );
}

function RagBar({ label, pct, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <div style={{ fontSize: 12, color: C.dim, minWidth: 90 }}>{label}</div>
      <div style={{ flex: 1, height: 5, background: C.surface2, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width .5s ease" }} />
      </div>
      <div style={{ fontSize: 11, color: C.muted, minWidth: 32, textAlign: "right" }}>{pct}%</div>
    </div>
  );
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export default function L3Dashboard({ state, activities, milestones, risks, deliverables }) {
  const sheets   = state?.l2?.sheets || {};
  const changes  = sheets["06"]?.data?.changes       || [];
  const costData = sheets["03"]?.data?.costData       || {};
  const expLog   = sheets["03"]?.data?.expenditureLog || [];

  // ── Progress ──────────────────────────────────────────────────────────────
  const allTasks   = [...activities, ...milestones];
  const doneTasks  = allTasks.filter(a => a._complete).length;
  const pct        = allTasks.length > 0 ? Math.round((doneTasks / allTasks.length) * 100) : 0;
  const overdue    = activities.filter(a => !a._complete && a.targetDate && new Date(a.targetDate) < new Date()).length;
  const nextMs     = milestones.filter(m => !m._complete && m.targetDate).sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate))[0];

  const actPct = activities.length > 0 ? Math.round((activities.filter(a => a._complete).length / activities.length) * 100) : 0;
  const msPct  = milestones.length > 0 ? Math.round((milestones.filter(m => m._complete).length / milestones.length) * 100) : 0;
  const delPct = deliverables.length > 0 ? Math.round((deliverables.filter(d => parseFloat(d.actual || 0) >= parseFloat(d.target || 1)).length / deliverables.length) * 100) : 0;

  const redRisks = risks.filter(r => (parseInt(r.likelihood) || 1) * (parseInt(r.impact) || 1) >= 9).length;
  const ambRisks = risks.filter(r => { const s = (parseInt(r.likelihood) || 1) * (parseInt(r.impact) || 1); return s >= 4 && s < 9; }).length;

  // ── Change log ────────────────────────────────────────────────────────────
  const majorChanges = changes.filter(c => c.type === "major");
  const minorChanges = changes.filter(c => c.type === "minor");
  const pendingCCRs  = majorChanges.filter(c => c.status === "pending" || c.status === "reviewed");
  const approvedCCRs = majorChanges.filter(c => c.status === "approved");
  const rejectedCCRs = majorChanges.filter(c => c.status === "rejected");

  // ── Cost ──────────────────────────────────────────────────────────────────
  const totalPlanned = Object.values(costData).reduce((s, c) => s + (parseFloat(c.plannedAmount) || 0), 0);
  const totalActual  = expLog.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const costVariance = totalPlanned - totalActual;

  // ── Cost performance chart ────────────────────────────────────────────────
  const costChart = useMemo(() => {
    // Sort all items by their Gantt date
    const ganttItems = [...activities, ...milestones]
      .filter(i => costData[i._id] && (i.targetDate || i.startDate))
      .map(i => ({ ...i, _date: parseDate(i.targetDate || i.startDate) }))
      .filter(i => i._date)
      .sort((a, b) => a._date - b._date);

    const planned = ganttItems.filter(i => parseFloat(costData[i._id]?.plannedAmount) > 0);
    const actual  = ganttItems.filter(i => parseFloat(costData[i._id]?.actualAmount)  > 0);

    if (!planned.length && !actual.length) return null;

    // Cumulative lines
    let cp = 0, ca = 0;
    const planLine = planned.map(i => ({ d: i._date, v: (cp += parseFloat(costData[i._id].plannedAmount)) }));
    const actLine  = actual.map( i => ({ d: i._date, v: (ca += parseFloat(costData[i._id].actualAmount))  }));

    const allDates = [...planLine, ...actLine].map(p => p.d.getTime());
    if (!allDates.length) return null;

    const minMs  = Math.min(...allDates);
    const maxMs  = Math.max(...allDates);
    const span   = Math.max(maxMs - minMs, 30 * 86400000);
    const dataMax = Math.max(...planLine.map(p => p.v), ...actLine.map(p => p.v), 1);
    const maxV   = dataMax * 1.2;

    const X1 = 40, X2 = 282, Y1 = 18, Y2 = 118;
    const xOf = ms => X1 + ((ms - minMs) / span) * (X2 - X1);
    const yOf = v  => Y2 - Math.min(1, v / maxV) * (Y2 - Y1);
    const fmt  = ms => new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });

    const zero = { d: new Date(minMs), v: 0 };
    const planPts = [zero, ...planLine];
    const actPts  = [zero, ...actLine];

    const planPath = planPts.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.d.getTime()).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(" ");
    const actPath  = actPts.map( (p, i) => `${i === 0 ? "M" : "L"}${xOf(p.d.getTime()).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(" ");

    // Month ticks
    const ticks = [];
    const tc = new Date(minMs); tc.setDate(1); tc.setMonth(tc.getMonth() + 1);
    while (tc.getTime() < maxMs) { ticks.push(new Date(tc)); tc.setMonth(tc.getMonth() + 1); }

    return { planPath, actPath, actLine, xOf, yOf, fmt, minMs, maxMs, dataMax, ticks };
  }, [activities, milestones, costData]);

  return (
    <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
        <MetricCard label="Overall Progress" value={`${pct}%`}          sub={`${doneTasks} of ${allTasks.length} tasks`} color={pct >= 70 ? C.activity : pct >= 40 ? C.milestone : C.risk} />
        <MetricCard label="Overdue Tasks"    value={overdue}             sub="need attention"                              color={overdue > 0 ? C.risk : C.activity} />
        <MetricCard label="Open Risks"       value={risks.length}        sub={`${redRisks} red · ${ambRisks} amber`}       color={redRisks > 0 ? C.risk : ambRisks > 0 ? C.milestone : C.activity} />
        <MetricCard label="Next Milestone"   value={nextMs?.name || "None"} sub={nextMs?.targetDate || "No date set"}      color={C.milestone} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>

        {/* RAG */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 }}>RAG by register</div>
          <RagBar label="Activities"   pct={actPct} color={actPct >= 70 ? C.activity : actPct >= 40 ? C.milestone : C.risk} />
          <RagBar label="Milestones"   pct={msPct}  color={msPct  >= 70 ? C.activity : msPct  >= 40 ? C.milestone : C.risk} />
          <RagBar label="Deliverables" pct={delPct} color={delPct >= 70 ? C.activity : delPct >= 40 ? C.milestone : C.risk} />
          <RagBar label="Risks closed" pct={risks.length > 0 ? Math.round((risks.filter(r => r._closed).length / risks.length) * 100) : 0} color={C.activity} />
        </div>

        {/* Milestones */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 }}>Milestones</div>
          {milestones.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>No milestones set.</div>}
          {milestones.slice(0, 6).map((m, i) => {
            const done = m._complete;
            const past = m.targetDate && new Date(m.targetDate) < new Date() && !done;
            const col  = done ? C.activity : past ? C.risk : C.milestone;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, fontSize: 12 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: col, flexShrink: 0 }} />
                <div style={{ color: C.dim, flex: 1 }}>{m.name || "—"}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{m.targetDate || "TBC"}</div>
                <div style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: col + "22", color: col }}>
                  {done ? "Done" : past ? "Overdue" : "Upcoming"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>

        {/* Change log */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 }}>Change Log</div>
          {changes.length === 0 && <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>No changes recorded yet.</div>}
          <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            {[
              [majorChanges.length, "Major CCRs", C.accentL],
              [minorChanges.length, "Minor changes", C.dim],
              [pendingCCRs.length,  "Pending",       C.milestone],
              [approvedCCRs.length, "Approved",      C.activity],
              ...(rejectedCCRs.length ? [[rejectedCCRs.length, "Rejected", C.risk]] : []),
            ].map(([val, lbl, col]) => (
              <div key={lbl} style={{ background: C.surface2, borderRadius: 6, padding: "6px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: col }}>{val}</div>
                <div style={{ fontSize: 9, color: C.muted }}>{lbl}</div>
              </div>
            ))}
          </div>
          {changes.slice(-3).reverse().map((c, i) => (
            <div key={i} style={{ fontSize: 11, color: C.dim, marginBottom: 4, paddingLeft: 8, borderLeft: `2px solid ${c.type === "major" ? C.milestone : C.border}` }}>
              <span style={{ fontFamily: "monospace", fontSize: 10, color: C.muted }}>{c.id}</span> — {c.description || "Change recorded"}
            </div>
          ))}
        </div>

        {/* Cost chart */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Cost Performance</div>

          {(totalPlanned > 0 || totalActual > 0) && (
            <div style={{ display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              {[
                [`£${totalPlanned.toLocaleString()}`, "Planned",      C.accentL],
                [`£${totalActual.toLocaleString()}`,  "Actual logged", C.milestone],
                [`${costVariance >= 0 ? "" : "-"}£${Math.abs(costVariance).toLocaleString()}`, "Variance", costVariance >= 0 ? C.activity : C.risk],
              ].map(([val, lbl, col]) => (
                <div key={lbl} style={{ background: C.surface2, borderRadius: 6, padding: "5px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: col }}>{val}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>{lbl}</div>
                </div>
              ))}
            </div>
          )}

          {!costChart
            ? <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic", padding: 8 }}>
                {totalPlanned > 0 || totalActual > 0
                  ? "Set activity dates in Integrated Baseline to display the cost curve."
                  : "No cost data yet. Add planned costs in Integrated Baseline."}
              </div>
            : (
              <svg width="100%" height="155" viewBox="0 0 300 155" style={{ display: "block" }}>
                {/* Axes */}
                <line x1={40} y1={118} x2={282} y2={118} stroke={C.border} strokeWidth="1" />
                <line x1={40} y1={18}  x2={40}  y2={118} stroke={C.border} strokeWidth="1" />
                {/* Y labels */}
                <text x="2" y="24"  fill={C.muted} fontSize="7">£{Math.round(costChart.dataMax).toLocaleString()}</text>
                <text x="2" y="120" fill={C.muted} fontSize="7">£0</text>
                {/* Grid lines */}
                {[0.25, 0.5, 0.75].map(f => (
                  <g key={f}>
                    <line x1={40} y1={costChart.yOf(costChart.dataMax * f).toFixed(0)} x2={282} y2={costChart.yOf(costChart.dataMax * f).toFixed(0)} stroke={C.border} strokeWidth="1" opacity="0.3" strokeDasharray="3 3" />
                    <text x="2" y={(costChart.yOf(costChart.dataMax * f) + 3).toFixed(0)} fill={C.muted} fontSize="6">£{Math.round(costChart.dataMax * f).toLocaleString()}</text>
                  </g>
                ))}
                {/* X labels */}
                <text x={40}  y="132" fill={C.muted} fontSize="7" textAnchor="middle">{costChart.fmt(costChart.minMs)}</text>
                <text x={282} y="132" fill={C.muted} fontSize="7" textAnchor="middle">{costChart.fmt(costChart.maxMs)}</text>
                {costChart.ticks.map((m, i) => {
                  const mx = costChart.xOf(m.getTime());
                  if (mx <= 50 || mx >= 272) return null;
                  return (
                    <g key={i}>
                      <line x1={mx.toFixed(1)} y1={118} x2={mx.toFixed(1)} y2={122} stroke={C.border} strokeWidth="1" />
                      <text x={mx.toFixed(1)} y="132" fill={C.muted} fontSize="6" textAnchor="middle">
                        {m.toLocaleDateString("en-GB", { month: "short" })}
                      </text>
                    </g>
                  );
                })}
                {/* Planned line */}
                <path d={costChart.planPath} stroke={C.accentL}   fill="none" strokeWidth="2"   strokeDasharray="6 3" />
                {/* Actual line */}
                <path d={costChart.actPath}  stroke={C.milestone} fill="none" strokeWidth="2.5" />
                {/* Actual dots */}
                {costChart.actLine.map((p, i) => (
                  <circle key={i} cx={costChart.xOf(p.d.getTime()).toFixed(1)} cy={costChart.yOf(p.v).toFixed(1)} r="3" fill={C.milestone} stroke={C.surface} strokeWidth="1" />
                ))}
                {/* Legend */}
                <line x1="150" y1="148" x2="166" y2="148" stroke={C.accentL}   strokeWidth="2"   strokeDasharray="6 3" />
                <text x="169" y="151" fill={C.accentL}   fontSize="8">Planned</text>
                <line x1="215" y1="148" x2="231" y2="148" stroke={C.milestone} strokeWidth="2.5" />
                <text x="234" y="151" fill={C.milestone} fontSize="8">Actual</text>
              </svg>
            )}
        </div>
      </div>

      {/* Risks */}
      {risks.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 }}>Top risks</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
            {risks.slice(0, 6).map((r, i) => {
              const score = (parseInt(r.likelihood) || 1) * (parseInt(r.impact) || 1);
              const col   = score >= 9 ? C.risk : score >= 4 ? C.milestone : C.activity;
              return (
                <div key={i} style={{ background: C.surface2, borderLeft: `3px solid ${col}`, borderRadius: 6, padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, fontFamily: "monospace", color: C.muted, marginBottom: 2 }}>{r._id}</div>
                  <div style={{ fontSize: 12, color: C.sage, marginBottom: 4 }}>{r.name || r.description || "—"}</div>
                  <div style={{ display: "flex", gap: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: col + "22", color: col }}>Score: {score}</span>
                    <span style={{ fontSize: 9, color: C.muted }}>{r.response || "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
