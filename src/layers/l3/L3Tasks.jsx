import { useState } from "react";
import SustainabilityPrompt from "./SustainabilityPrompt.jsx";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };
const inp = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:4, color:C.sage, fontSize:11, padding:"3px 7px", outline:"none", width:"80px", fontFamily:"inherit" };

function ragColor(target, actual) {
  if(!target||!actual) return C.muted;
  const pct = (parseFloat(actual)/parseFloat(target))*100;
  if(pct>=100) return C.activity;
  if(pct>=60)  return C.milestone;
  return C.risk;
}

export default function L3Tasks({ state, activities, milestones, member, raciData, onMarkComplete, onStateChange, sustainConfig, onSustainRecord }) {
  const [filter, setFilter] = useState("all");
  const [activeSection, setActiveSection] = useState("tasks"); // tasks | deliverables
  const [sustainPrompt, setSustainPrompt] = useState(null);

  const loginCode = member?.loginCode;
  const raciRows  = [...(raciData.raciRows||[]), ...(raciData.customRows||[])];
  const sheets    = state?.l2?.sheets || {};
  const deliverables = sheets["07"]?.data?.deliverables || [];

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

  // Update deliverable actual value
  const updateDeliverableActual = (idx, field, value) => {
    const next = deliverables.map((d,i) => i===idx ? {...d,[field]:value} : d);
    onStateChange && onStateChange(prev => ({
      ...prev,
      l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
        "07": { ...prev.l2.sheets["07"], data: { ...prev.l2.sheets["07"]?.data, deliverables: next } }
      }},
    }));
  };

  return (
    <div style={{ padding:20 }}>
      {/* Section tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:14, borderBottom:`1px solid ${C.border}`, paddingBottom:8 }}>
        {[["tasks",`Tasks (${allItems.length})`],["deliverables",`KD Tracker (${deliverables.length})`]].map(([s,l])=>(
          <button key={s} onClick={()=>setActiveSection(s)}
            style={{ padding:"5px 14px", borderRadius:5, border:"none", fontSize:12, fontWeight:600, background:activeSection===s?C.accent:"none", color:activeSection===s?"#fff":C.muted, cursor:"pointer" }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Tasks ── */}
      {activeSection==="tasks" && (
        <>
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
                        <button onClick={() => {
                            if (sustainConfig && Object.values(sustainConfig.enabled||{}).some(Boolean)) {
                              setSustainPrompt(item);
                            } else {
                              onMarkComplete(item._id, item.itemType, true);
                            }
                          }}
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
        </>
      )}

      {/* ── KD Tracker (Actual / Achieved) ── */}
      {activeSection==="deliverables" && (
        <div>
          <div style={{ fontSize:12, color:C.dim, marginBottom:14, lineHeight:1.6 }}>
            Log actual values against targets set in the Personalisation Layer. Achievement % is calculated automatically.
          </div>
          {deliverables.length===0&&<div style={{ color:C.muted, fontSize:12 }}>No deliverables configured. Set them up in L2 → Sheet 07.</div>}

          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"70px 2fr 2fr 100px 100px 90px 80px", padding:"8px 14px", background:C.surface2, borderBottom:`1px solid ${C.border}` }}>
              {["ID","Deliverable","KPI","Target","Actual","Achievement","Deadline"].map(h=>(
                <div key={h} style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px" }}>{h}</div>
              ))}
            </div>

            {deliverables.map((d,i)=>{
              const pct = d.target && d.actual ? Math.round((parseFloat(d.actual)/parseFloat(d.target))*100) : null;
              const col = ragColor(d.target, d.actual);
              return (
                <div key={i} style={{ display:"grid", gridTemplateColumns:"70px 2fr 2fr 100px 100px 90px 80px", padding:"10px 14px", borderBottom:`1px solid ${C.border}22`, alignItems:"center", borderLeft:`3px solid ${col}` }}>
                  <div style={{ fontFamily:"monospace", fontSize:10, color:C.accentL }}>{d._id}</div>
                  <div style={{ fontSize:12, color:C.sage }}>{d.name||"—"}</div>
                  <div style={{ fontSize:11, color:C.dim }}>{d.kpi||"—"}</div>
                  <div style={{ fontSize:12, color:C.muted, fontWeight:600 }}>{d.target||"—"}</div>
                  <div>
                    {member?.isPM ? (
                      <input style={inp} value={d.actual||""} onChange={e=>updateDeliverableActual(i,"actual",e.target.value)} placeholder="Enter"/>
                    ) : (
                      <span style={{ fontSize:12, color:C.dim }}>{d.actual||"—"}</span>
                    )}
                  </div>
                  <div>
                    {pct!==null ? (
                      <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:20, background:col+"22", color:col, border:`1px solid ${col}55` }}>
                        {pct}%
                      </span>
                    ) : <span style={{ fontSize:11, color:C.muted }}>—</span>}
                  </div>
                  <div style={{ fontSize:11, color:C.muted }}>{d.deadlineV1||"—"}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sustainPrompt && (
        <SustainabilityPrompt
          activity={sustainPrompt}
          sustainConfig={sustainConfig}
          onRecord={(ev) => {
            onSustainRecord?.(ev);
            onMarkComplete(sustainPrompt._id, sustainPrompt.itemType, true);
            setSustainPrompt(null);
          }}
          onSkip={() => {
            onMarkComplete(sustainPrompt._id, sustainPrompt.itemType, true);
            setSustainPrompt(null);
          }}/>
      )}
    </div>
  );
}
