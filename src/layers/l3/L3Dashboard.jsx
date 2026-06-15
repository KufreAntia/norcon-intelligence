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

  // Cumulative planned (by activity end date)
  const allItems = [...activities, ...milestones].filter(i=>costData[i._id]?.plannedAmount);
  const planPts  = allItems
    .map(i=>({ date:i.targetDate||i.startDate, v:parseFloat(costData[i._id]?.plannedAmount)||0 }))
    .sort((a,b)=>new Date(a.date)-new Date(b.date));
  let cumPlan=0; const planLine = planPts.map(p=>({ date:p.date, v:(cumPlan+=p.v) }));

  const actPts = expLog.filter(e=>e.amount).map(e=>({ date:e.date, v:parseFloat(e.amount)||0 })).sort((a,b)=>new Date(a.date)-new Date(b.date));
  let cumAct=0; const actLine = actPts.map(p=>({ date:p.date, v:(cumAct+=p.v) }));

  const hasCostData = planLine.length > 0 || actLine.length > 0;

  // SVG line chart helper
  const renderCostChart = () => {
    if(!hasCostData) return <div style={{ fontSize:11, color:C.muted, fontStyle:"italic", padding:8 }}>No cost data entered yet.</div>;
    const allPts  = [...planLine, ...actLine];
    const dates   = allPts.map(p=>new Date(p.date)).sort((a,b)=>a-b);
    const minD    = dates[0], maxD = dates[dates.length-1];
    const maxV    = Math.max(...planLine.map(p=>p.v), ...actLine.map(p=>p.v), 1);
    const xOf = d => 30 + ((new Date(d)-minD)/(Math.max(maxD-minD,1)))*240;
    const yOf = v => 120 - (v/maxV)*100;
    const planPath = planLine.map((p,i)=>`${i===0?"M":"L"}${xOf(p.date).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(" ");
    const actPath  = actLine.map((p,i)=>`${i===0?"M":"L"}${xOf(p.date).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(" ");
    return (
      <svg width="100%" height="130" viewBox="0 0 300 130" style={{ display:"block" }}>
        <line x1="30" y1="120" x2="280" y2="120" stroke={C.border} strokeWidth="1"/>
        <line x1="30" y1="20"  x2="30"  y2="120" stroke={C.border} strokeWidth="1"/>
        <text x="32" y="19" fill={C.muted} fontSize="8">£{maxV.toLocaleString()}</text>
        {planPath && <path d={planPath} stroke={C.accentL}  fill="none" strokeWidth="2" strokeDasharray="4 2"/>}
        {actPath  && <path d={actPath}  stroke={C.milestone} fill="none" strokeWidth="2"/>}
        <text x="200" y="130" fill={C.accentL}  fontSize="8">-- Planned</text>
        <text x="200" y="122" fill={C.milestone} fontSize="8">—— Actual</text>
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
          {hasCostData && (
            <div style={{ display:"flex", gap:10, marginBottom:8 }}>
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
