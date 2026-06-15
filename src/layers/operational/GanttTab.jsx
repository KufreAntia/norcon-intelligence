const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };

const PHASE_COLORS = { Concept:"#3a9ce0", Definition:"#9c6ee0", Development:"#3ae0a2", "Handover & Closeout":"#e0a23a", "Benefits Realisation":"#e05c5c", Planning:"#3a9ce0", Execution:"#3ae0a2", Closure:"#e0a23a" };

export default function GanttTab({ state, member }) {
  const activities = state.l2?.sheets?.["03"]?.data?.activities || [];
  const milestones = state.l2?.sheets?.["03"]?.data?.milestones || [];
  const raciRows   = state.l2?.sheets?.["04"]?.data?.raciRows   || [];

  const isAssigned = (id) => {
    const row = raciRows.find(r => r.taskId === id);
    return row?.assignments?.[member?.loginCode] === "R";
  };

  // Get date range
  const allDates = [...activities, ...milestones]
    .flatMap(a => [a.startDate, a.endDate, a.targetDate].filter(Boolean))
    .map(d => new Date(d)).filter(d => !isNaN(d));
  const minDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date();
  const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date(Date.now() + 90*86400000);
  const totalDays = Math.max((maxDate - minDate) / 86400000, 30);

  const pct = (date) => {
    if (!date) return 0;
    return Math.max(0, Math.min(100, ((new Date(date) - minDate) / (totalDays * 86400000)) * 100));
  };

  const width = (start, end) => {
    if (!start || !end) return 20;
    return Math.max(2, pct(end) - pct(start));
  };

  const today = new Date();
  const todayPct = Math.max(0, Math.min(100, ((today - minDate) / (totalDays * 86400000)) * 100));

  const allItems = [
    ...activities.map(a => ({ ...a, itemType:"activity" })),
    ...milestones.map(m => ({ ...m, itemType:"milestone" })),
  ];

  if (allItems.length === 0) {
    return (
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,flexDirection:"column",gap:8}}>
        <div style={{fontSize:32,opacity:.3}}>📅</div>
        <div style={{fontSize:13,color:C.dim}}>No activities or milestones yet.</div>
        <div style={{fontSize:11}}>Complete Sheet 03 in the Personalisation Layer.</div>
      </div>
    );
  }

  return (
    <div style={{flex:1,overflowY:"auto",padding:20}}>
      {/* Legend */}
      <div style={{display:"flex",gap:16,marginBottom:14,flexWrap:"wrap"}}>
        {[["Your tasks (R)",C.accentL],["Complete",C.activity],["In Progress",C.milestone],["Not Started",C.muted],["Milestone","#e0a23a"]].map(([l,c])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.dim}}>
            <div style={{width:12,height:4,borderRadius:2,background:c}}/>
            {l}
          </div>
        ))}
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.dim}}>
          <div style={{width:1,height:12,background:C.risk}}/>
          Today
        </div>
      </div>

      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,overflow:"hidden"}}>
        {allItems.map((item, i) => {
          const assigned   = isAssigned(item._id);
          const isMilestone = item.itemType === "milestone";
          const status     = item.status || "not-started";
          const barColor   = status==="complete" ? C.activity : status==="in-progress" ? C.milestone : assigned ? C.accentL : C.muted;
          const phaseColor = PHASE_COLORS[item.phase] || C.muted;

          return (
            <div key={i} style={{display:"flex",alignItems:"center",height:36,borderBottom:i<allItems.length-1?`1px solid ${C.border}`:"none",background:assigned?"rgba(46,125,82,0.06)":"transparent",borderLeft:assigned?`2px solid ${C.accentL}`:"2px solid transparent"}}>
              {/* Label */}
              <div style={{width:220,flexShrink:0,padding:"0 10px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
                <div style={{fontSize:11,color:assigned?C.sage:C.sageDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:assigned?700:400}}>
                  {isMilestone?"🏁 ":""}{item.name||item._id}
                </div>
                <div style={{fontSize:9,color:phaseColor,marginTop:1}}>{item.phase||"—"}</div>
              </div>
              {/* Track */}
              <div style={{flex:1,position:"relative",height:20,margin:"0 10px"}}>
                {/* Today line */}
                <div style={{position:"absolute",left:`${todayPct}%`,top:0,bottom:0,width:1,background:C.risk,zIndex:2}}/>
                {/* Bar or diamond */}
                {isMilestone ? (
                  item.targetDate && (
                    <div style={{position:"absolute",left:`${pct(item.targetDate)}%`,top:"50%",transform:"translate(-50%,-50%) rotate(45deg)",width:10,height:10,background:status==="complete"?C.activity:C.milestone,zIndex:1}}/>
                  )
                ) : (
                  item.startDate && item.endDate && (
                    <div style={{position:"absolute",left:`${pct(item.startDate)}%`,width:`${width(item.startDate,item.endDate)}%`,top:"50%",transform:"translateY(-50%)",height:14,borderRadius:3,background:barColor,zIndex:1,minWidth:4,display:"flex",alignItems:"center",paddingLeft:4,overflow:"hidden"}}>
                      {status==="complete"&&<span style={{fontSize:8,color:"#fff",fontWeight:700}}>✓</span>}
                    </div>
                  )
                )}
                {/* No dates fallback */}
                {!item.startDate && !item.endDate && !item.targetDate && (
                  <div style={{position:"absolute",left:"5%",width:"30%",top:"50%",transform:"translateY(-50%)",height:10,borderRadius:3,background:C.border,border:`1px dashed ${C.muted}`,zIndex:1}}/>
                )}
              </div>
              {/* Date */}
              <div style={{width:80,flexShrink:0,fontSize:9,color:C.muted,textAlign:"right",paddingRight:10}}>
                {isMilestone ? item.targetDate||"TBC" : item.endDate||"TBC"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
