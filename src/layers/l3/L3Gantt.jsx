import { useState } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };

const PHASE_COLORS = {
  Concept:"#9c6ee0", Definition:"#3a9ce0", Development:"#3ae0a2",
  "Handover & Closeout":"#e0a23a", "Benefits Realisation":"#e05c5c",
  Planning:"#3a9ce0", Execution:"#3ae0a2", "Monitoring & Control":"#e0a23a",
  Closure:"#8aac96", Initiation:"#9c6ee0",
};

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function fmtDate(d) {
  return d.toLocaleDateString("en-GB", { day:"numeric", month:"short" });
}

function fmtDateInput(d) {
  return new Date(d).toISOString().split("T")[0];
}

export default function L3Gantt({ activities, milestones, member, onStateChange, state }) {
  const [editing,    setEditing]    = useState(null); // taskId being edited
  const [editStart,  setEditStart]  = useState("");
  const [editEnd,    setEditEnd]    = useState("");

  const canEdit = member?.isPM;

  // Build unified task list with dates
  const allItems = [
    ...activities.map(a => ({ ...a, itemType:"activity",  color: PHASE_COLORS[a.phase]||C.accentL })),
    ...milestones.map(m => ({ ...m, itemType:"milestone", color: C.milestone })),
  ].filter(i => i.name || i.description);

  // Determine overall date range
  const allDates = allItems.flatMap(i => [i.startDate, i.targetDate, i.endDate].filter(Boolean));
  const minDate  = allDates.length > 0 ? new Date(Math.min(...allDates.map(d=>new Date(d)))) : new Date();
  const maxDate  = allDates.length > 0 ? new Date(Math.max(...allDates.map(d=>new Date(d)))) : addDays(new Date(), 60);

  // Pad by 7 days each side
  const startDate = addDays(minDate, -7);
  const endDate   = addDays(maxDate, 14);
  const totalDays = Math.max(daysBetween(startDate, endDate), 30);
  const DAY_W     = 28; // px per day

  // Generate week headers
  const weeks = [];
  let cur = new Date(startDate);
  while (cur < endDate) {
    weeks.push(new Date(cur));
    cur = addDays(cur, 7);
  }

  // Today marker
  const todayOffset = daysBetween(startDate, new Date());

  const getBarStyle = (item) => {
    const s = item.startDate || item.targetDate;
    const e = item.targetDate || item.endDate || item.startDate;
    if (!s) return null;
    const left  = Math.max(0, daysBetween(startDate, new Date(s)));
    const width = Math.max(1, daysBetween(new Date(s), new Date(e||s)) + 1);
    return { left: left * DAY_W, width: width * DAY_W };
  };

  const saveEdit = (taskId, itemType) => {
    if (!editStart) return;
    const key = itemType === "milestone" ? "milestones" : "activities";
    onStateChange(prev => ({
      ...prev,
      l2: {
        ...prev.l2,
        sheets: {
          ...prev.l2.sheets,
          "03": {
            ...prev.l2.sheets["03"],
            data: {
              ...prev.l2.sheets["03"].data,
              [key]: (prev.l2.sheets["03"].data[key]||[]).map(i =>
                i._id === taskId ? { ...i, startDate: editStart, targetDate: editEnd || editStart } : i
              ),
            },
          },
        },
      },
    }));
    setEditing(null);
  };

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:11, color:C.muted, marginBottom:12, display:"flex", gap:16, alignItems:"center" }}>
        <span>Visual schedule — all activities and milestones</span>
        {canEdit && <span style={{ color:C.accentL }}>Click any bar to edit dates</span>}
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:12, height:2, background:C.risk }}/>
          <span>Today</span>
        </div>
      </div>

      {allItems.length === 0 && (
        <div style={{ color:C.muted, fontSize:13, textAlign:"center", padding:40 }}>
          No activities in the schedule yet. Complete Sheet 03 in the Personalisation Layer.
        </div>
      )}

      {allItems.length > 0 && (
        <div style={{ overflowX:"auto", border:`1px solid ${C.border}`, borderRadius:8 }}>
          <div style={{ minWidth: 200 + totalDays * DAY_W }}>

            {/* Header row */}
            <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, background:C.surface2 }}>
              <div style={{ width:200, flexShrink:0, borderRight:`1px solid ${C.border}`, padding:"7px 10px", fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px" }}>Activity</div>
              <div style={{ flex:1, position:"relative", height:32, overflow:"hidden" }}>
                {weeks.map((w,i) => (
                  <div key={i} style={{ position:"absolute", left: daysBetween(startDate,w)*DAY_W, top:0, height:"100%", borderLeft:`1px solid ${C.border}`, paddingLeft:4, paddingTop:8, fontSize:9, color:C.muted, whiteSpace:"nowrap" }}>
                    {fmtDate(w)}
                  </div>
                ))}
                {/* Today line header */}
                {todayOffset >= 0 && todayOffset <= totalDays && (
                  <div style={{ position:"absolute", left: todayOffset*DAY_W, top:0, width:1, height:"100%", background:C.risk, opacity:.7 }}/>
                )}
              </div>
            </div>

            {/* Task rows */}
            {allItems.map((item, idx) => {
              const barStyle = getBarStyle(item);
              const isMil    = item.itemType === "milestone";
              const isEditing = editing === item._id;

              return (
                <div key={item._id||idx}>
                  <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, minHeight:36, alignItems:"center", background: idx%2===0 ? C.surface : "transparent" }}>
                    {/* Label */}
                    <div style={{ width:200, flexShrink:0, borderRight:`1px solid ${C.border}`, padding:"6px 10px", display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:3, height:20, background:item.color, borderRadius:2, flexShrink:0 }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:11, color: item._complete?C.muted:C.sage, textDecoration:item._complete?"line-through":"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {isMil?"🏁 ":""}{item.name||item.description||"—"}
                        </div>
                        <div style={{ fontSize:9, color:C.muted }}>{item._id} · {item.phase||"—"}</div>
                      </div>
                      {item._complete && <span style={{ fontSize:9, color:C.activity, flexShrink:0 }}>✓</span>}
                    </div>

                    {/* Gantt track */}
                    <div style={{ flex:1, position:"relative", height:36, overflow:"hidden" }}>
                      {/* Today line */}
                      {todayOffset >= 0 && todayOffset <= totalDays && (
                        <div style={{ position:"absolute", left:todayOffset*DAY_W, top:0, width:1, height:"100%", background:C.risk, opacity:.4, zIndex:1 }}/>
                      )}
                      {/* Week grid lines */}
                      {weeks.map((w,i) => (
                        <div key={i} style={{ position:"absolute", left:daysBetween(startDate,w)*DAY_W, top:0, width:1, height:"100%", background:C.border, opacity:.5 }}/>
                      ))}
                      {/* Bar */}
                      {barStyle && (
                        <div
                          onClick={() => {
                            if (!canEdit) return;
                            setEditing(item._id);
                            setEditStart(item.startDate || fmtDateInput(new Date()));
                            setEditEnd(item.targetDate || item.endDate || fmtDateInput(addDays(new Date(),7)));
                          }}
                          style={{
                            position:"absolute", left:barStyle.left, width:barStyle.width,
                            top:8, height:20, borderRadius: isMil?2:4,
                            background: item._complete ? C.activity+"88" : item.color+"99",
                            border:`1px solid ${item._complete?C.activity:item.color}`,
                            cursor: canEdit?"pointer":"default",
                            display:"flex", alignItems:"center", paddingLeft:6,
                            fontSize:9, color:"#fff", fontWeight:600, overflow:"hidden", whiteSpace:"nowrap",
                            zIndex:2, transition:"opacity .15s",
                          }}
                          title={canEdit?"Click to edit dates":""}>
                          {barStyle.width > 40 && (item.name||item.description||"").slice(0,20)}
                        </div>
                      )}
                      {/* No dates placeholder */}
                      {!barStyle && (
                        <div style={{ position:"absolute", left:8, top:10, fontSize:10, color:C.muted, fontStyle:"italic" }}>
                          {canEdit?"Click to set dates":"No dates set"}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inline date editor */}
                  {isEditing && (
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"rgba(46,125,82,0.1)", borderBottom:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:11, color:C.dim, minWidth:80 }}>Edit dates:</span>
                      <div>
                        <div style={{ fontSize:9, color:C.muted, marginBottom:2 }}>Start Date</div>
                        <input type="date" value={editStart} onChange={e=>setEditStart(e.target.value)}
                          style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:4, color:C.sage, fontSize:11, padding:"4px 8px", outline:"none" }}/>
                      </div>
                      <div>
                        <div style={{ fontSize:9, color:C.muted, marginBottom:2 }}>End / Target Date</div>
                        <input type="date" value={editEnd} onChange={e=>setEditEnd(e.target.value)}
                          style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:4, color:C.sage, fontSize:11, padding:"4px 8px", outline:"none" }}/>
                      </div>
                      <button onClick={()=>saveEdit(item._id, item.itemType)}
                        style={{ padding:"5px 12px", background:C.accent, border:"none", borderRadius:4, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", marginTop:12 }}>
                        Save
                      </button>
                      <button onClick={()=>setEditing(null)}
                        style={{ padding:"5px 10px", background:"none", border:`1px solid ${C.border}`, borderRadius:4, color:C.muted, fontSize:11, cursor:"pointer", marginTop:12 }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
