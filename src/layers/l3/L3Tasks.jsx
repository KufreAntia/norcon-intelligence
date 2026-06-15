import { useState } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };

export default function L3Tasks({ activities, milestones, member, raciData, onMarkComplete }) {
  const [filter, setFilter] = useState("all");

  const loginCode = member?.loginCode;
  const raciRows  = [...(raciData.raciRows||[]), ...(raciData.customRows||[])];

  const getAssignment = (taskId) => {
    const row = raciRows.find(r => r.taskId === taskId);
    return row?.assignments?.[loginCode] || null;
  };

  const canEdit  = (taskId) => getAssignment(taskId) === 'R' || member?.isPM;
  const isMine   = (taskId) => !!getAssignment(taskId);

  const allItems = [
    ...activities.map(a => ({ ...a, itemType:"activity" })),
    ...milestones.map(m => ({ ...m, itemType:"milestone" })),
  ];

  const filtered = allItems.filter(item => {
    if (filter === "mine")       return isMine(item._id);
    if (filter === "incomplete") return !item._complete;
    return true;
  });

  const myCount   = allItems.filter(a => isMine(a._id)).length;
  const doneCount = allItems.filter(a => a._complete).length;

  const statusColor = (item) => {
    if (item._complete) return C.activity;
    if (item.targetDate && new Date(item.targetDate) < new Date()) return C.risk;
    return C.milestone;
  };

  const statusLabel = (item) => {
    if (item._complete) return "Complete";
    if (item.targetDate && new Date(item.targetDate) < new Date()) return "Overdue";
    return "In Progress";
  };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        {[["all","All tasks"],["mine",`My tasks (${myCount})`],["incomplete","Incomplete"]].map(([f,l])=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${filter===f?C.accent:C.border}`, background:filter===f?"rgba(46,125,82,0.15)":"none", color:filter===f?C.accentL:C.muted, fontSize:11, fontWeight:600, cursor:"pointer" }}>
            {l}
          </button>
        ))}
        <div style={{ marginLeft:"auto", fontSize:11, color:C.muted }}>{doneCount} of {allItems.length} complete</div>
      </div>

      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"80px 1fr 100px 120px 110px 140px", gap:8, padding:"8px 14px", background:C.surface2, borderBottom:`1px solid ${C.border}` }}>
          {["ID","Task","Phase","Owner","Status","Action"].map(h=>(
            <div key={h} style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px" }}>{h}</div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ padding:"32px", textAlign:"center", color:C.muted, fontSize:12 }}>No tasks match this filter.</div>
        )}

        {filtered.map((item, i) => {
          const mine       = isMine(item._id);
          const canDo      = canEdit(item._id);
          const assignment = getAssignment(item._id);
          const col        = statusColor(item);
          const label      = statusLabel(item);
          const isMilestone = item.itemType === "milestone";

          return (
            <div key={item._id||i} style={{
              display:"grid", gridTemplateColumns:"80px 1fr 100px 120px 110px 140px",
              gap:8, padding:"9px 14px", borderBottom:`1px solid ${C.border}`,
              background: mine ? "rgba(46,125,82,0.06)" : "transparent",
              borderLeft: mine ? `3px solid ${C.accentL}` : "3px solid transparent",
              alignItems:"center",
            }}>
              <div style={{ fontFamily:"monospace", fontSize:10, color:isMilestone?C.milestone:C.muted }}>{item._id}</div>
              <div>
                <div style={{ fontSize:12, color: item._complete ? C.muted : C.sage, textDecoration: item._complete?"line-through":"none" }}>
                  {item.name||item.description||"—"}
                </div>
                {mine && assignment && <div style={{ fontSize:9, color:C.accentL, marginTop:1 }}>You ({assignment})</div>}
              </div>
              <div style={{ fontSize:11, color:C.muted }}>{item.phase||"—"}</div>
              <div style={{ fontSize:11, color:mine?C.accentL:C.muted }}>{item.responsible||item._suggestedOwner||"—"}</div>
              <div>
                <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20, background:col+"22", color:col, border:`1px solid ${col}55` }}>
                  {label}
                </span>
              </div>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                {canDo ? (
                  item._complete ? (
                    <button onClick={() => onMarkComplete(item._id, item.itemType, false)}
                      style={{ padding:"4px 10px", background:"rgba(58,224,162,0.15)", border:`1px solid ${C.activity}`, borderRadius:5, color:C.activity, fontSize:10, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                      ✓ Undo
                    </button>
                  ) : (
                    <button onClick={() => onMarkComplete(item._id, item.itemType, true)}
                      style={{ padding:"4px 10px", background:C.accent, border:"none", borderRadius:5, color:"#fff", fontSize:10, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                      ✓ Mark Complete
                    </button>
                  )
                ) : (
                  <span style={{ fontSize:10, color:C.muted }}>View only</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
