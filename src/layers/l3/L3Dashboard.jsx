const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };

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

export default function L3Dashboard({ activities, milestones, risks, deliverables }) {
  const total    = activities.length;
  const done     = activities.filter(a => a._complete).length;
  const pct      = total > 0 ? Math.round((done/total)*100) : 0;
  const overdue  = activities.filter(a => !a._complete && a.targetDate && new Date(a.targetDate) < new Date()).length;
  const redRisks = risks.filter(r => (parseInt(r.likelihood)||1)*(parseInt(r.impact)||1) >= 9).length;
  const ambRisks = risks.filter(r => { const s=(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1); return s>=4&&s<9; }).length;
  const nextMs   = milestones.filter(m => !m._complete && m.targetDate).sort((a,b)=>new Date(a.targetDate)-new Date(b.targetDate))[0];
  const delDone  = deliverables.filter(d => parseFloat(d.actual||0) >= parseFloat(d.target||1)).length;
  const delPct   = deliverables.length > 0 ? Math.round((delDone/deliverables.length)*100) : 0;
  const msDone   = milestones.filter(m => m._complete).length;
  const msPct    = milestones.length > 0 ? Math.round((msDone/milestones.length)*100) : 0;

  return (
    <div style={{ padding:20 }}>
      {/* Metric cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
        <MetricCard label="Overall Progress" value={`${pct}%`} sub={`${done} of ${total} tasks`} color={pct>=70?C.activity:pct>=40?C.milestone:C.risk}/>
        <MetricCard label="Overdue Tasks"    value={overdue}   sub="need attention"                color={overdue>0?C.risk:C.activity}/>
        <MetricCard label="Open Risks"       value={risks.length} sub={`${redRisks} red · ${ambRisks} amber`} color={redRisks>0?C.risk:ambRisks>0?C.milestone:C.activity}/>
        <MetricCard label="Next Milestone"   value={nextMs?.name||"None"} sub={nextMs?.targetDate||"No date set"} color={C.milestone}/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        {/* RAG by register */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px" }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>RAG by register</div>
          <RagBar label="Activities"   pct={pct}    color={pct>=70?C.activity:pct>=40?C.milestone:C.risk}/>
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
                <div style={{ color:C.sageDim, flex:1 }}>{m.name||"—"}</div>
                <div style={{ fontSize:10, color:C.muted }}>{m.targetDate||"TBC"}</div>
                <div style={{ fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:20, background:col+"22", color:col }}>
                  {done?"Done":past?"Overdue":"Upcoming"}
                </div>
              </div>
            );
          })}
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
