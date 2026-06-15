const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };
const RACI_COLORS = { R:C.risk, A:C.milestone, C:"#3a9ce0", I:"#9c6ee0" };

export default function L3RACI({ raciData, teamMembers, member, activities, milestones, onMarkComplete }) {
  const rows    = [...(raciData.raciRows||[]), ...(raciData.customRows||[])];
  const members = teamMembers.filter(m => m.name && m.role);
  const loginCode = member?.loginCode;

  // Get completion from activities/milestones
  const isComplete = (taskId) => {
    const a = activities.find(x => x._id === taskId);
    const m = milestones.find(x => x._id === taskId);
    return (a||m)?._complete || false;
  };

  const canComplete = (taskId) => {
    const row = rows.find(r => r.taskId === taskId);
    const assignment = row?.assignments?.[loginCode];
    return assignment === 'R' || member?.isPM;
  };

  return (
    <div style={{ padding:20 }}>
      {/* Legend */}
      <div style={{ display:"flex", gap:16, marginBottom:14, flexWrap:"wrap" }}>
        {[["R","Responsible"],["A","Accountable"],["C","Consulted"],["I","Informed"]].map(([k,v])=>(
          <div key={k} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.dim }}>
            <div style={{ width:22, height:22, borderRadius:4, background:RACI_COLORS[k]+"22", border:`1px solid ${RACI_COLORS[k]}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:RACI_COLORS[k] }}>{k}</div>
            {v}
          </div>
        ))}
        <div style={{ fontSize:11, color:C.muted, marginLeft:"auto" }}>
          Your assignments highlighted · Mark Complete on your R items
        </div>
      </div>

      {rows.length === 0 && (
        <div style={{ color:C.muted, fontSize:13, textAlign:"center", padding:40 }}>
          RACI matrix not yet populated. Complete Sheet 04 in the Personalisation Layer.
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ background:C.surface2 }}>
                <th style={{ padding:"8px 10px", textAlign:"left", fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", borderBottom:`1px solid ${C.border}`, minWidth:70 }}>ID</th>
                <th style={{ padding:"8px 10px", textAlign:"left", fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", borderBottom:`1px solid ${C.border}`, minWidth:180 }}>Task</th>
                <th style={{ padding:"8px 10px", textAlign:"left", fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", borderBottom:`1px solid ${C.border}`, minWidth:80 }}>Phase</th>
                {members.map(m=>(
                  <th key={m.loginCode} style={{ padding:"8px 8px", textAlign:"center", fontSize:9, fontWeight:700, color: m.loginCode===loginCode?C.accentL:C.muted, textTransform:"uppercase", letterSpacing:".3px", borderBottom:`1px solid ${C.border}`, minWidth:70 }}>
                    <div style={{ fontFamily:"monospace", fontSize:9, marginBottom:1 }}>{m.loginCode}</div>
                    <div style={{ fontSize:8, fontWeight:400 }}>{(m.name||"").split(" ")[0]}</div>
                  </th>
                ))}
                <th style={{ padding:"8px 10px", textAlign:"center", fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", borderBottom:`1px solid ${C.border}`, minWidth:100 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row,i) => {
                const done    = isComplete(row.taskId);
                const myAssig = row.assignments?.[loginCode];
                const isMine  = !!myAssig;
                return (
                  <tr key={row.taskId||i} style={{
                    borderBottom:`1px solid ${C.border}`,
                    background: done ? "rgba(58,224,162,0.04)" : isMine ? "rgba(46,125,82,0.06)" : i%2===0 ? C.surface : "transparent",
                    borderLeft: isMine ? `3px solid ${C.accentL}` : "3px solid transparent",
                  }}>
                    <td style={{ padding:"7px 10px", fontFamily:"monospace", fontSize:10, color:C.muted }}>{row.taskId}</td>
                    <td style={{ padding:"7px 10px", color: done?C.muted:C.sage, textDecoration:done?"line-through":"none" }}>{row.label||"—"}</td>
                    <td style={{ padding:"7px 10px", color:C.muted, fontSize:11 }}>{row.phase||"—"}</td>
                    {members.map(m => {
                      const val = row.assignments?.[m.loginCode]||"";
                      const col = RACI_COLORS[val]||C.muted;
                      return (
                        <td key={m.loginCode} style={{ padding:"5px 8px", textAlign:"center" }}>
                          {val ? (
                            <div style={{ display:"inline-flex", width:24, height:24, borderRadius:4, alignItems:"center", justifyContent:"center", background:col+"22", border:`1px solid ${col}`, fontSize:10, fontWeight:700, color:col }}>
                              {done ? "✓" : val}
                            </div>
                          ) : <span style={{ color:C.border }}>—</span>}
                        </td>
                      );
                    })}
                    <td style={{ padding:"5px 10px", textAlign:"center" }}>
                      {done ? (
                        <span style={{ fontSize:10, color:C.activity, fontWeight:700 }}>✓ Complete</span>
                      ) : canComplete(row.taskId) ? (
                        <button onClick={() => onMarkComplete(row.taskId, "activity", true)}
                          style={{ padding:"3px 9px", background:C.accent, border:"none", borderRadius:4, color:"#fff", fontSize:10, fontWeight:700, cursor:"pointer" }}>
                          ✓ Mark Done
                        </button>
                      ) : (
                        <span style={{ fontSize:10, color:C.muted }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
