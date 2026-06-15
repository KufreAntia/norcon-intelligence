const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };
const RACI_COLORS = { R:C.risk, A:C.milestone, C:"#3a9ce0", I:"#9c6ee0" };

export default function RACITab({ state, member, onMarkComplete }) {
  const raciRows   = state.l2?.sheets?.["04"]?.data?.raciRows   || [];
  const customRows = state.l2?.sheets?.["04"]?.data?.customRows || [];
  const members    = state.l2?.loginCodes?.filter(lc => lc.name && lc.role) || [];
  const activities = state.l2?.sheets?.["03"]?.data?.activities || [];
  const allRows    = [...raciRows, ...customRows];

  const getStatus = (taskId) => {
    const act = activities.find(a => a._id === taskId);
    return act?.status || "not-started";
  };

  return (
    <div style={{flex:1,overflowY:"auto",padding:20}}>
      {/* Legend */}
      <div style={{display:"flex",gap:16,marginBottom:14,flexWrap:"wrap"}}>
        {[["R","Responsible"],["A","Accountable"],["C","Consulted"],["I","Informed"]].map(([k,v])=>(
          <div key={k} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:C.dim}}>
            <div style={{width:22,height:22,borderRadius:4,background:RACI_COLORS[k]+"22",border:`1px solid ${RACI_COLORS[k]}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:RACI_COLORS[k]}}>{k}</div>
            {v}
          </div>
        ))}
        <div style={{fontSize:11,color:C.dim,display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:22,height:22,borderRadius:4,background:C.activity+"22",border:`1px solid ${C.activity}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:C.activity}}>✓</div>
          Complete
        </div>
      </div>

      {allRows.length===0&&(
        <div style={{textAlign:"center",padding:40,color:C.muted,fontSize:12}}>
          RACI matrix not populated yet. Complete Sheet 04 in the Personalisation Layer.
        </div>
      )}

      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{background:C.surface2}}>
              <th style={{padding:"7px 10px",textAlign:"left",fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:".4px",fontWeight:700,borderBottom:`1px solid ${C.border}`,minWidth:60}}>ID</th>
              <th style={{padding:"7px 10px",textAlign:"left",fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:".4px",fontWeight:700,borderBottom:`1px solid ${C.border}`,minWidth:180}}>Activity</th>
              <th style={{padding:"7px 10px",textAlign:"left",fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:".4px",fontWeight:700,borderBottom:`1px solid ${C.border}`,minWidth:70}}>Phase</th>
              {members.map(m=>(
                <th key={m.loginCode} style={{padding:"7px 8px",textAlign:"center",fontSize:9,color:m.loginCode===member?.loginCode?C.accentL:C.muted,textTransform:"uppercase",letterSpacing:".3px",fontWeight:700,borderBottom:`1px solid ${C.border}`,minWidth:70}}>
                  <div style={{fontFamily:"monospace",fontSize:9,marginBottom:2}}>{m.loginCode}</div>
                  <div style={{fontWeight:400,fontSize:9}}>{(m.name||"").split(" ")[0]}</div>
                </th>
              ))}
              <th style={{padding:"7px 8px",textAlign:"center",fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:".3px",fontWeight:700,borderBottom:`1px solid ${C.border}`,minWidth:90}}>Status</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((row, i) => {
              const status     = getStatus(row.taskId);
              const done       = status === "complete";
              const myAssign   = row.assignments?.[member?.loginCode];
              const isMyR      = myAssign === "R";
              return (
                <tr key={i} style={{borderBottom:`1px solid ${C.border}`,background:isMyR?"rgba(46,125,82,0.06)":"transparent",borderLeft:isMyR?`2px solid ${C.accentL}`:"2px solid transparent"}}>
                  <td style={{padding:"6px 10px",fontFamily:"monospace",fontSize:10,color:C.muted}}>{row.taskId}</td>
                  <td style={{padding:"6px 10px",color:done?C.muted:C.sageDim,textDecoration:done?"line-through":"none"}}>{row.label||"—"}</td>
                  <td style={{padding:"6px 10px",color:C.muted,fontSize:11}}>{row.phase||"—"}</td>
                  {members.map(m=>{
                    const val = row.assignments?.[m.loginCode]||"";
                    const col = done ? C.activity : RACI_COLORS[val]||C.muted;
                    return (
                      <td key={m.loginCode} style={{padding:"5px 8px",textAlign:"center"}}>
                        <div style={{width:24,height:24,borderRadius:4,background:col+"22",border:`1px solid ${col}`,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:done?13:10,fontWeight:700,color:col}}>
                          {done?"✓":val||"—"}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{padding:"5px 8px",textAlign:"center"}}>
                    {isMyR && !done ? (
                      <button onClick={()=>onMarkComplete(row.taskId)}
                        style={{padding:"3px 10px",background:C.accent,color:"#fff",border:"none",borderRadius:4,fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                        ✓ Complete
                      </button>
                    ) : (
                      <span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:20,background:done?C.activity+"22":C.border,color:done?C.activity:C.muted,border:`1px solid ${done?C.activity:C.border}`}}>
                        {done?"Done":status==="in-progress"?"In Progress":"Not Started"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
