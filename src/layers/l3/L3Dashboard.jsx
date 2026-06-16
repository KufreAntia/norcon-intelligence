import { useState } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px" }}>
      <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:700, color:color||C.sage, marginBottom:3 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:C.muted }}>{sub}</div>}
    </div>
  );
}

function RagBar({ label, pct, color }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
      <div style={{ width:8, height:8, borderRadius:"50%", background:color, flexShrink:0 }}/>
      <div style={{ fontSize:12, color:C.dim, minWidth:90 }}>{label}</div>
      <div style={{ flex:1, height:5, background:C.surface2, borderRadius:3, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:3, transition:"width .5s ease" }}/>
      </div>
      <div style={{ fontSize:11, color:C.muted, minWidth:32, textAlign:"right" }}>{pct}%</div>
    </div>
  );
}

export default function L3Dashboard({ state, activities, milestones, risks, deliverables }) {
  const sheets = state?.l2?.sheets || {};
  const changes = sheets["06"]?.data?.changes || [];
  const costData = sheets["03"]?.data?.costData || {};
  const expLog   = sheets["03"]?.data?.expenditureLog || [];

  // ── Overall progress: activities + milestones ──────────────────────────
  const allTasks   = [...activities, ...milestones];
  const totalTasks = allTasks.length;
  const doneTasks  = allTasks.filter(a => a._complete).length;
  const pct        = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const overdue  = activities.filter(a => !a._complete && a.targetDate && new Date(a.targetDate) < new Date()).length;
  const redRisks = risks.filter(r => (parseInt(r.likelihood)||1)*(parseInt(r.impact)||1) >= 9).length;
  const ambRisks = risks.filter(r => { const s=(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1); return s>=4&&s<9; }).length;
  const nextMs   = milestones.filter(m => !m._complete && m.targetDate).sort((a,b)=>new Date(a.targetDate)-new Date(b.targetDate))[0];

  const delDone  = deliverables.filter(d => parseFloat(d.actual||0) >= parseFloat(d.target||1)).length;
  const delPct   = deliverables.length > 0 ? Math.round((delDone/deliverables.length)*100) : 0;
  const actDone  = activities.filter(a => a._complete).length;
  const actPct   = activities.length > 0 ? Math.round((actDone/activities.length)*100) : 0;
  const msDone   = milestones.filter(m => m._complete).length;
  const msPct    = milestones.length > 0 ? Math.round((msDone/milestones.length)*100) : 0;

  // ── Change log summary ────────────────────────────────────────────────
  const majorChanges  = changes.filter(c=>c.type==="major");
  const minorChanges  = changes.filter(c=>c.type==="minor");
  const pendingCCRs   = majorChanges.filter(c=>c.status==="pending"||c.status==="reviewed");
  const approvedCCRs  = majorChanges.filter(c=>c.status==="approved");
  const rejectedCCRs  = majorChanges.filter(c=>c.status==="rejected");

  // ── Cost summary ──────────────────────────────────────────────────────
  const totalPlanned = Object.values(costData).reduce((s,c)=>s+(parseFloat(c.plannedAmount)||0),0);
  const totalActual  = expLog.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  const costVariance = totalPlanned - totalActual;
  const hasCostData  = totalPlanned > 0 || totalActual > 0;

  // ── Cost chart — both lines read from costData, anchored to Gantt dates ─
  const renderCostChart = () => {
    if (!hasCostData) return (
      <div style={{ fontSize:11, color:C.muted, fontStyle:"italic", padding:8 }}>
        No cost data entered yet. Add planned costs in Integrated Baseline.
      </div>
    );

    // All Gantt items sorted by date — shared timeline for both lines
    const ganttItems = [...activities, ...milestones]
      .filter(i => (i.targetDate || i.startDate) && costData[i._id])
      .sort((a, b) => new Date(a.targetDate || a.startDate) - new Date(b.targetDate || b.startDate));

    // Planned line: costData[id].plannedAmount at activity Gantt date
    const datedPlanned = ganttItems
      .filter(i => parseFloat(costData[i._id]?.plannedAmount) > 0)
      .map(i => ({ date: i.targetDate || i.startDate, v: parseFloat(costData[i._id].plannedAmount) }));

    // Actual line: costData[id].actualAmount at activity Gantt date
    // actualAmount is auto-synced from the expenditure log in L3IntegratedBaseline
    const datedActual = ganttItems
      .filter(i => parseFloat(costData[i._id]?.actualAmount) > 0)
      .map(i => ({ date: i.targetDate || i.startDate, v: parseFloat(costData[i._id].actualAmount) }));

    // Cumulative planned
    let cumP = 0;
    const planLine = datedPlanned.map(p => ({ date: p.date, v: (cumP += p.v) }));

    // Cumulative actual — same Gantt timeline as planned
    let cumA = 0;
    const actLine = datedActual.map(p => ({ date: p.date, v: (cumA += p.v) }));

    if (!planLine.length && !actLine.length) return (
      <div style={{ fontSize:11, color:C.muted, fontStyle:"italic", padding:8 }}>
        Set activity dates in Integrated Baseline to display the cost curve.
      </div>
    );

    // Chart bounds
    const allMs = [...planLine, ...actLine].map(p => new Date(p.date).getTime()).filter(n => !isNaN(n));
    if (!allMs.length) return <div style={{ fontSize:11, color:C.muted, fontStyle:"italic", padding:8 }}>Set activity dates to display cost curve.</div>;
    const minMs = Math.min(...allMs);
    const maxMs = Math.max(...allMs);
    const span  = Math.max(maxMs - minMs, 30 * 86400000); // min 30-day span

    // Y ceiling: 20% above the higher of planned/actual so lines have breathing room
    const dataMax = Math.max(...planLine.map(p=>p.v), ...actLine.map(p=>p.v), 1);
    const maxV    = dataMax * 1.2;

    const X1 = 40, X2 = 282, Y1 = 18, Y2 = 118;
    const xOf = d => X1 + ((new Date(d).getTime() - minMs) / span) * (X2 - X1);
    const yOf = v => Y2  - Math.min(1, v / maxV) * (Y2 - Y1);
    const fmtTick = ms => new Date(ms).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"2-digit" });

    // Anchor both lines to zero at the start date so they rise from the x-axis
    const zeroPoint = { date: new Date(minMs).toISOString().slice(0,10), v: 0 };
    const planPathPts = [zeroPoint, ...planLine];
    const actPathPts  = [zeroPoint, ...actLine];

    const planPath = planPathPts.map((p,i) => `${i===0?"M":"L"}${xOf(p.date).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(" ");
    const actPath  = actPathPts.map((p,i)  => `${i===0?"M":"L"}${xOf(p.date).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(" ");

    // Monthly x-axis ticks
    const monthTicks = [];
    const tickStart = new Date(minMs);
    tickStart.setDate(1); tickStart.setMonth(tickStart.getMonth()+1);
    while (tickStart.getTime() < maxMs) {
      monthTicks.push(new Date(tickStart));
      tickStart.setMonth(tickStart.getMonth()+1);
    }

    return (
      <svg width="100%" height="155" viewBox="0 0 300 155" style={{ display:"block" }}>
        {/* Axes */}
        <line x1={X1} y1={Y2} x2={X2} y2={Y2} stroke={C.border} strokeWidth="1"/>
        <line x1={X1} y1={Y1} x2={X1} y2={Y2} stroke={C.border} strokeWidth="1"/>
        {/* Y axis labels */}
        <text x="2" y={Y1+6} fill={C.muted} fontSize="7">£{Math.round(dataMax).toLocaleString()}</text>
        <text x="2" y={Y2}   fill={C.muted} fontSize="7">£0</text>
        {/* Horizontal grid lines at 25/50/75% of dataMax */}
        {[0.25,0.5,0.75].map(pct => (
          <g key={pct}>
            <line x1={X1} y1={yOf(dataMax*pct).toFixed(0)} x2={X2} y2={yOf(dataMax*pct).toFixed(0)}
              stroke={C.border} strokeWidth="1" opacity="0.3" strokeDasharray="3 3"/>
            <text x="2" y={(yOf(dataMax*pct)+3).toFixed(0)} fill={C.muted} fontSize="6">
              £{Math.round(dataMax*pct).toLocaleString()}
            </text>
          </g>
        ))}
        {/* X axis: start, monthly ticks, end */}
        <text x={X1}  y="132" fill={C.muted} fontSize="7" textAnchor="middle">{fmtTick(minMs)}</text>
        <text x={X2}  y="132" fill={C.muted} fontSize="7" textAnchor="middle">{fmtTick(maxMs)}</text>
        {monthTicks.map((m,i) => {
          const mx = xOf(m.toISOString().slice(0,10));
          if (mx <= X1+10 || mx >= X2-10) return null;
          return (
            <g key={i}>
              <line x1={mx.toFixed(1)} y1={Y2} x2={mx.toFixed(1)} y2={Y2+4} stroke={C.border} strokeWidth="1"/>
              <text x={mx.toFixed(1)} y="132" fill={C.muted} fontSize="6" textAnchor="middle">
                {m.toLocaleDateString("en-GB",{month:"short"})}
              </text>
            </g>
          );
        })}
        {/* Planned line (dashed) — rises from zero */}
        {planPath && <path d={planPath} stroke={C.accentL} fill="none" strokeWidth="2" strokeDasharray="6 3"/>}
        {/* Actual line (solid) — rises from zero */}
        {actPath  && <path d={actPath}  stroke={C.milestone} fill="none" strokeWidth="2.5"/>}
        {/* Dots on actual data points */}
        {actLine.map((p,i) => (
          <circle key={i} cx={xOf(p.date).toFixed(1)} cy={yOf(p.v).toFixed(1)} r="3" fill={C.milestone} stroke={C.surface} strokeWidth="1"/>
        ))}
        {/* Legend */}
        <line x1="150" y1="148" x2="166" y2="148" stroke={C.accentL} strokeWidth="2" strokeDasharray="6 3"/>
        <text x="169" y="151" fill={C.accentL} fontSize="8">Planned</text>
        <line x1="215" y1="148" x2="231" y2="148" stroke={C.milestone} strokeWidth="2.5"/>
        <text x="234" y="151" fill={C.milestone} fontSize="8">Actual</text>
      </svg>
    );
  };
  return (
    <div style={{ padding:20, overflowY:"auto", height:"100%" }}>
      {/* Metric cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
        <MetricCard label="Overall Progress" value={`${pct}%`} sub={`${doneTasks} of ${totalTasks} tasks`} color={pct>=70?C.activity:pct>=40?C.milestone:C.risk}/>
        <MetricCard label="Overdue Tasks"    value={overdue}   sub="need attention"                         color={overdue>0?C.risk:C.activity}/>
        <MetricCard label="Open Risks"       value={risks.length} sub={`${redRisks} red · ${ambRisks} amber`} color={redRisks>0?C.risk:ambRisks>0?C.milestone:C.activity}/>
        <MetricCard label="Next Milestone"   value={nextMs?.name||"None"} sub={nextMs?.targetDate||"No date set"} color={C.milestone}/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        {/* RAG by register */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px" }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>RAG by register</div>
          <RagBar label="Activities"   pct={actPct} color={actPct>=70?C.activity:actPct>=40?C.milestone:C.risk}/>
          <RagBar label="Milestones"   pct={msPct}  color={msPct>=70?C.activity:msPct>=40?C.milestone:C.risk}/>
          <RagBar label="Deliverables" pct={delPct} color={delPct>=70?C.activity:delPct>=40?C.milestone:C.risk}/>
          <RagBar label="Risks closed" pct={risks.length>0?Math.round((risks.filter(r=>r._closed).length/risks.length)*100):0} color={C.activity}/>
        </div>

        {/* Milestones */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px" }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>Milestones</div>
          {milestones.length === 0 && <div style={{ fontSize:12, color:C.muted }}>No milestones set.</div>}
          {milestones.slice(0,6).map((m,i) => {
            const done = m._complete;
            const past = m.targetDate && new Date(m.targetDate) < new Date() && !done;
            const col  = done ? C.activity : past ? C.risk : C.milestone;
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7, fontSize:12 }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:col, flexShrink:0 }}/>
                <div style={{ color:C.dim, flex:1 }}>{m.name||"—"}</div>
                <div style={{ fontSize:10, color:C.muted }}>{m.targetDate||"TBC"}</div>
                <div style={{ fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:20, background:col+"22", color:col }}>
                  {done?"Done":past?"Overdue":"Upcoming"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        {/* Change log summary */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px" }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>Change Log</div>
          {changes.length === 0 && <div style={{ fontSize:11, color:C.muted, fontStyle:"italic" }}>No changes recorded yet.</div>}
          <div style={{ display:"flex", gap:10, marginBottom:10, flexWrap:"wrap" }}>
            <div style={{ background:C.surface2, borderRadius:6, padding:"6px 10px", textAlign:"center" }}>
              <div style={{ fontSize:18, fontWeight:700, color:C.accentL }}>{majorChanges.length}</div>
              <div style={{ fontSize:9, color:C.muted }}>Major CCRs</div>
            </div>
            <div style={{ background:C.surface2, borderRadius:6, padding:"6px 10px", textAlign:"center" }}>
              <div style={{ fontSize:18, fontWeight:700, color:C.dim }}>{minorChanges.length}</div>
              <div style={{ fontSize:9, color:C.muted }}>Minor changes</div>
            </div>
            <div style={{ background:C.surface2, borderRadius:6, padding:"6px 10px", textAlign:"center" }}>
              <div style={{ fontSize:18, fontWeight:700, color:C.milestone }}>{pendingCCRs.length}</div>
              <div style={{ fontSize:9, color:C.muted }}>Pending</div>
            </div>
            <div style={{ background:C.surface2, borderRadius:6, padding:"6px 10px", textAlign:"center" }}>
              <div style={{ fontSize:18, fontWeight:700, color:C.activity }}>{approvedCCRs.length}</div>
              <div style={{ fontSize:9, color:C.muted }}>Approved</div>
            </div>
            {rejectedCCRs.length > 0 && (
              <div style={{ background:C.surface2, borderRadius:6, padding:"6px 10px", textAlign:"center" }}>
                <div style={{ fontSize:18, fontWeight:700, color:C.risk }}>{rejectedCCRs.length}</div>
                <div style={{ fontSize:9, color:C.muted }}>Rejected</div>
              </div>
            )}
          </div>
          {changes.slice(-3).reverse().map((c,i)=>(
            <div key={i} style={{ fontSize:11, color:C.dim, marginBottom:4, paddingLeft:8, borderLeft:`2px solid ${c.type==="major"?C.milestone:C.border}` }}>
              <span style={{ fontFamily:"monospace", fontSize:10, color:C.muted }}>{c.id}</span> — {c.description||"Change recorded"}
            </div>
          ))}
        </div>

        {/* Cost chart */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px" }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:6 }}>Cost Performance</div>
          {(totalPlanned > 0 || totalActual > 0) && (
            <div style={{ display:"flex", gap:10, marginBottom:8, flexWrap:"wrap" }}>
              <div style={{ background:C.surface2, borderRadius:6, padding:"5px 10px", textAlign:"center" }}>
                <div style={{ fontSize:16, fontWeight:700, color:C.accentL }}>£{totalPlanned.toLocaleString()}</div>
                <div style={{ fontSize:9, color:C.muted }}>Planned</div>
              </div>
              <div style={{ background:C.surface2, borderRadius:6, padding:"5px 10px", textAlign:"center" }}>
                <div style={{ fontSize:16, fontWeight:700, color:C.milestone }}>£{totalActual.toLocaleString()}</div>
                <div style={{ fontSize:9, color:C.muted }}>Actual logged</div>
              </div>
              <div style={{ background:C.surface2, borderRadius:6, padding:"5px 10px", textAlign:"center" }}>
                <div style={{ fontSize:16, fontWeight:700, color:costVariance>=0?C.activity:C.risk }}>
                  {costVariance>=0?"":"-"}£{Math.abs(costVariance).toLocaleString()}
                </div>
                <div style={{ fontSize:9, color:C.muted }}>Variance</div>
              </div>
            </div>
          )}
          {renderCostChart()}
        </div>
      </div>

      {/* Risk summary */}
      {risks.length > 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px" }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>Top risks</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:8 }}>
            {risks.slice(0,6).map((r,i)=>{
              const score = (parseInt(r.likelihood)||1)*(parseInt(r.impact)||1);
              const col   = score>=9?C.risk:score>=4?C.milestone:C.activity;
              return (
                <div key={i} style={{ background:C.surface2, borderLeft:`3px solid ${col}`, borderRadius:6, padding:"8px 10px" }}>
                  <div style={{ fontSize:10, fontFamily:"monospace", color:C.muted, marginBottom:2 }}>{r._id}</div>
                  <div style={{ fontSize:12, color:C.sage, marginBottom:4 }}>{r.name||r.description||"—"}</div>
                  <div style={{ display:"flex", gap:5 }}>
                    <span style={{ fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:20, background:col+"22", color:col }}>Score: {score}</span>
                    <span style={{ fontSize:9, color:C.muted }}>{r.response||"—"}</span>
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
