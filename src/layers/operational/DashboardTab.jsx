const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2", stakeholder:"#9c6ee0" };

function Metric({ label, value, sub, color }) {
  return (
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"12px 14px"}}>
      <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".5px",marginBottom:5}}>{label}</div>
      <div style={{fontSize:24,fontWeight:700,color:color||C.sage,marginBottom:2}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:C.muted}}>{sub}</div>}
    </div>
  );
}

function RagBar({ label, pct, color }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
      <div style={{width:6,height:6,borderRadius:"50%",background:color,flexShrink:0}}/>
      <div style={{fontSize:12,color:C.sageDim,width:90,flexShrink:0}}>{label}</div>
      <div style={{flex:1,height:5,background:C.border,borderRadius:3,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:3,transition:"width .6s ease"}}/>
      </div>
      <div style={{fontSize:11,color:C.muted,minWidth:32,textAlign:"right"}}>{Math.round(pct)}%</div>
    </div>
  );
}

export default function DashboardTab({ state }) {
  const activities   = state.l2?.sheets?.["03"]?.data?.activities  || [];
  const milestones   = state.l2?.sheets?.["03"]?.data?.milestones  || [];
  const risks        = state.l2?.sheets?.["05"]?.data?.risks        || [];
  const deliverables = state.l2?.sheets?.["07"]?.data?.deliverables || [];
  const issues       = state.l1?.elements?.filter(e=>e.type==="issue") || [];
  const raciRows     = state.l2?.sheets?.["04"]?.data?.raciRows     || [];

  const totalActs    = activities.length;
  const doneActs     = activities.filter(a=>a.status==="complete").length;
  const pct          = totalActs > 0 ? Math.round((doneActs/totalActs)*100) : 0;
  const overdue      = activities.filter(a=>a.status!=="complete"&&a.endDate&&new Date(a.endDate)<new Date()).length;

  const redRisks     = risks.filter(r=>(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1)>=9).length;
  const amberRisks   = risks.filter(r=>{const s=(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1);return s>=4&&s<9;}).length;
  const openIssues   = issues.filter(i=>i.status!=="resolved").length;

  const msColors = { done:C.activity, upcoming:C.milestone, pending:C.muted };
  const today = new Date();
  const sortedMs = [...milestones].sort((a,b)=>{
    if(!a.targetDate) return 1; if(!b.targetDate) return -1;
    return new Date(a.targetDate)-new Date(b.targetDate);
  });

  const delTotal = deliverables.length;
  const delDone  = deliverables.filter(d=>d.actual&&d.target&&parseFloat(d.actual)>=parseFloat(d.target)).length;

  return (
    <div style={{flex:1,overflowY:"auto",padding:20}}>
      {/* Metric cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        <Metric label="Overall Progress" value={pct+"%"} sub={`${doneActs} of ${totalActs} activities complete`} color={pct>=70?C.activity:pct>=40?C.milestone:C.risk}/>
        <Metric label="Overdue" value={overdue} sub="activities past deadline" color={overdue>0?C.risk:C.activity}/>
        <Metric label="Open Risks" value={risks.length} sub={`${redRisks} red · ${amberRisks} amber`} color={redRisks>0?C.risk:amberRisks>0?C.milestone:C.activity}/>
        <Metric label="Open Issues" value={openIssues} sub={openIssues===0?"All clear":"Requires attention"} color={openIssues>0?C.risk:C.activity}/>
      </div>

      {/* Overall progress bar */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"12px 14px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:6}}>
          <span style={{fontWeight:700,color:C.dim}}>Project Progress</span>
          <span style={{color:pct>=70?C.activity:pct>=40?C.milestone:C.risk,fontWeight:700}}>{pct}%</span>
        </div>
        <div style={{height:8,background:C.border,borderRadius:4,overflow:"hidden"}}>
          <div style={{width:`${pct}%`,height:"100%",background:pct>=70?C.activity:pct>=40?C.milestone:C.risk,borderRadius:4,transition:"width .8s ease"}}/>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        {/* RAG by register */}
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"12px 14px"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".5px",marginBottom:10}}>Health by Register</div>
          <RagBar label="Activities" pct={totalActs>0?(doneActs/totalActs)*100:0} color={C.activity}/>
          <RagBar label="Deliverables" pct={delTotal>0?(delDone/delTotal)*100:0} color={C.deliverable||"#3a9ce0"}/>
          <RagBar label="Risks resolved" pct={risks.length>0?((risks.length-redRisks-amberRisks)/risks.length)*100:100} color={C.activity}/>
          <RagBar label="Issues closed" pct={issues.length>0?((issues.length-openIssues)/issues.length)*100:100} color={C.activity}/>
        </div>

        {/* Milestones */}
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"12px 14px"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".5px",marginBottom:10}}>Milestones</div>
          {sortedMs.length===0&&<div style={{fontSize:12,color:C.muted}}>No milestones defined.</div>}
          {sortedMs.slice(0,5).map((m,i)=>{
            const done     = m.status==="complete";
            const upcoming = m.targetDate && new Date(m.targetDate) > today && !done;
            const col      = done?C.activity:upcoming?C.milestone:C.muted;
            return (
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:col,flexShrink:0}}/>
                <div style={{flex:1,fontSize:12,color:C.sageDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name||m._id}</div>
                <div style={{fontSize:10,color:C.muted,flexShrink:0}}>{m.targetDate||"TBC"}</div>
                <div style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:20,background:col+"22",color:col,border:`1px solid ${col}`,flexShrink:0,whiteSpace:"nowrap"}}>
                  {done?"Done":upcoming?"Upcoming":"Pending"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Risk summary */}
      {risks.length>0&&(
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"12px 14px"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".5px",marginBottom:10}}>Top Risks</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{background:C.surface2}}>
                {["ID","Risk","Category","Score","Response","Owner"].map(h=>(
                  <th key={h} style={{padding:"6px 8px",textAlign:"left",fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:".4px",fontWeight:700,borderBottom:`1px solid ${C.border}`}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[...risks].sort((a,b)=>((parseInt(b.likelihood)||1)*(parseInt(b.impact)||1))-((parseInt(a.likelihood)||1)*(parseInt(a.impact)||1))).slice(0,5).map((r,i)=>{
                  const score=(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1);
                  const col=score>=9?C.risk:score>=4?C.milestone:C.activity;
                  return(
                    <tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:"6px 8px",fontFamily:"monospace",fontSize:10,color:C.muted}}>{r._id}</td>
                      <td style={{padding:"6px 8px",color:C.sageDim}}>{r.name}</td>
                      <td style={{padding:"6px 8px",color:C.muted,fontSize:11}}>{r.category||"—"}</td>
                      <td style={{padding:"6px 8px"}}><span style={{fontWeight:700,color:col}}>{score}</span></td>
                      <td style={{padding:"6px 8px",color:C.muted,fontSize:11}}>{r.response||"—"}</td>
                      <td style={{padding:"6px 8px",color:C.muted,fontSize:11}}>{r._suggestedOwner||"—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
