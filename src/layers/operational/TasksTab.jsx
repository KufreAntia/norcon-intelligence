import { useState } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };

const STATUS_COLORS = { complete:C.activity, "in-progress":C.milestone, "not-started":C.muted, "at-risk":C.risk };
const STATUS_LABELS = { complete:"Complete", "in-progress":"In Progress", "not-started":"Not Started", "at-risk":"At Risk" };

export default function TasksTab({ state, member, onMarkComplete }) {
  const [filter, setFilter] = useState("all"); // all | mine | incomplete
  const activities = state.l2?.sheets?.["03"]?.data?.activities || [];
  const raciRows   = state.l2?.sheets?.["04"]?.data?.raciRows   || [];
  const loginCodes = state.l2?.loginCodes || [];

  // Check if this member is R on this activity
  const isAssigned = (activity) => {
    const row = raciRows.find(r => r.taskId === activity._id);
    if (!row) return false;
    return row.assignments?.[member?.loginCode] === "R";
  };

  const getRaci = (activity) => {
    const row = raciRows.find(r => r.taskId === activity._id);
    return row?.assignments?.[member?.loginCode] || "";
  };

  const getOwnerName = (responsible) => {
    const m = loginCodes.find(lc => lc.role === responsible || lc.deliveryRole === responsible);
    return m ? m.name : responsible;
  };

  const filtered = activities.filter(a => {
    if (filter === "mine")       return isAssigned(a);
    if (filter === "incomplete") return a.status !== "complete";
    return true;
  });

  const total    = activities.length;
  const done     = activities.filter(a=>a.status==="complete").length;
  const mine     = activities.filter(a=>isAssigned(a)).length;
  const mineDone = activities.filter(a=>isAssigned(a)&&a.status==="complete").length;

  return (
    <div style={{flex:1,overflowY:"auto",padding:20}}>
      {/* Summary bar */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        {[["Total Activities",`${done}/${total} complete`,total>0?(done/total)*100:0,C.activity],["My Tasks",`${mineDone}/${mine} complete`,mine>0?(mineDone/mine)*100:0,C.accentL],["Remaining",total-done+" to complete",total>0?((total-done)/total)*100:0,C.milestone]].map(([l,s,pct,col])=>(
          <div key={l} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"10px 12px"}}>
            <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>{l}</div>
            <div style={{fontSize:13,fontWeight:700,color:col,marginBottom:5}}>{s}</div>
            <div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden"}}>
              <div style={{width:`${pct}%`,height:"100%",background:col,transition:"width .5s"}}/>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {[["all","All Activities"],["mine","My Tasks"],["incomplete","Incomplete"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)}
            style={{padding:"5px 12px",fontSize:11,fontWeight:filter===v?700:400,borderRadius:5,border:`1px solid ${filter===v?C.accent:C.border}`,background:filter===v?"rgba(46,125,82,0.15)":"none",color:filter===v?C.accentL:C.muted,cursor:"pointer"}}>
            {l}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,overflow:"hidden"}}>
        {filtered.length===0&&<div style={{padding:"24px",textAlign:"center",color:C.muted,fontSize:12}}>No activities found.</div>}
        {filtered.map((a,i)=>{
          const assigned = isAssigned(a);
          const raciVal  = getRaci(a);
          const status   = a.status||"not-started";
          const col      = STATUS_COLORS[status]||C.muted;
          const done     = status==="complete";
          return (
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:i<filtered.length-1?`1px solid ${C.border}`:"none",background:assigned?"rgba(46,125,82,0.06)":"transparent",borderLeft:assigned?`2px solid ${C.accentL}`:"2px solid transparent"}}>
              <div style={{fontFamily:"monospace",fontSize:10,color:C.muted,minWidth:60,flexShrink:0}}>{a._id}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:done?C.muted:C.sage,fontWeight:assigned?700:400,textDecoration:done?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name||"Unnamed activity"}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:2}}>{a.phase||"—"} · Owner: {getOwnerName(a.responsible)||"—"}</div>
              </div>
              {raciVal&&(
                <div style={{fontSize:10,fontWeight:700,width:24,height:24,borderRadius:4,background:raciVal==="R"?C.risk+"22":raciVal==="A"?C.milestone+"22":raciVal==="C"?"rgba(58,156,224,.2)":"rgba(156,110,224,.2)",color:raciVal==="R"?C.risk:raciVal==="A"?C.milestone:raciVal==="C"?"#3a9ce0":"#9c6ee0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {raciVal}
                </div>
              )}
              <div style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:20,background:col+"22",color:col,border:`1px solid ${col}`,whiteSpace:"nowrap",flexShrink:0}}>
                {STATUS_LABELS[status]||status}
              </div>
              {assigned && !done && (
                <button onClick={()=>onMarkComplete(a._id)}
                  style={{padding:"5px 12px",background:C.accent,color:"#fff",border:"none",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                  ✓ Mark Complete
                </button>
              )}
              {assigned && done && (
                <div style={{fontSize:11,color:C.activity,flexShrink:0}}>✓ Done</div>
              )}
              {!assigned && (
                <div style={{fontSize:10,color:C.muted,flexShrink:0}}>View only</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
