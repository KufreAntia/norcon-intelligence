import { useState } from "react";

const C = {
  bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2",
};

const PHASE_COLORS = {
  Concept:"#9c6ee0", Definition:"#3a9ce0", Development:"#3ae0a2",
  "Handover & Closeout":"#e0a23a", "Benefits Realisation":"#e05c5c",
  Planning:"#3a9ce0", Execution:"#3ae0a2", "Monitoring & Control":"#e0a23a",
  Closure:"#8aac96", Initiation:"#9c6ee0",
};

const PHASE_ORDER = ["Concept","Initiation","Definition","Planning","Development","Execution","Monitoring & Control","Handover & Closeout","Benefits Realisation","Closure"];

function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate()+days); return d; }
function daysBetween(a, b)   { return Math.round((new Date(b)-new Date(a))/86400000); }
function fmtDate(d)          { return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short"}); }
function fmtInput(d)         { try { return new Date(d).toISOString().split("T")[0]; } catch { return ""; } }

function autoAssignDates(items) {
  const phases = [...new Set(items.map(i=>i.phase||"Definition"))];
  phases.sort((a,b)=>PHASE_ORDER.indexOf(a)-PHASE_ORDER.indexOf(b));
  const phaseDays = Math.max(14, Math.floor(90/Math.max(phases.length,1)));
  const projectStart = new Date();
  return items.map(item => {
    if (item.startDate || item.targetDate) return item;
    const phaseIdx = Math.max(0, phases.indexOf(item.phase||"Definition"));
    const start    = addDays(projectStart, phaseIdx * phaseDays);
    const end      = addDays(start, item.itemType==="milestone" ? 0 : phaseDays - 2);
    return { ...item, startDate: fmtInput(start), targetDate: fmtInput(end), _autoDate: true };
  });
}

// Get owner from RACI (person with R on this task)
function getOwner(taskId, raciData, loginCodes) {
  const rows = [...(raciData?.raciRows||[]), ...(raciData?.customRows||[])];
  const row  = rows.find(r => r.taskId === taskId);
  if (!row) return null;
  const entry = Object.entries(row.assignments||{}).find(([,v])=>v==="R");
  if (!entry) return null;
  const member = (loginCodes||[]).find(m=>m.loginCode===entry[0]);
  return member ? (member.name || member.role) : entry[0];
}

// Auto-generate cost account codes
function getCostAccount(idx, projectCode) {
  return `${(projectCode||"NC").toUpperCase()}-${String(idx+1).padStart(2,"0")}`;
}

export default function L3IntegratedBaseline({ activities, milestones, raciData, project, loginCodes, member, onStateChange }) {
  const projectCode = project?.code || "NC";
  const canEdit     = member?.isPM;

  // Merge activities and milestones with cost data
  const [costData, setCostData] = useState(() => {
    const init = {};
    activities.forEach(a => { init[a._id] = { plannedAmount:"", actualAmount:"", costAccount:"" }; });
    milestones.forEach(m => { init[m._id] = { plannedAmount:"", actualAmount:"", costAccount:"" }; });
    return init;
  });

  const [editing,   setEditing]   = useState(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd,   setEditEnd]   = useState("");

  const rawItems = [
    ...activities.map((a,i) => ({ ...a, itemType:"activity",  color:PHASE_COLORS[a.phase]||C.accentL, _costIdx:i })),
    ...milestones.map((m,i) => ({ ...m, itemType:"milestone", color:C.milestone, _costIdx:activities.length+i })),
  ].filter(i=>i.name||i.description);

  const allItems = autoAssignDates(rawItems);

  // Date range
  const allDates = allItems.flatMap(i=>[i.startDate,i.targetDate].filter(Boolean)).map(d=>new Date(d));
  const minDate  = allDates.length>0 ? new Date(Math.min(...allDates)) : new Date();
  const maxDate  = allDates.length>0 ? new Date(Math.max(...allDates)) : addDays(new Date(),90);
  const ganttStart = addDays(minDate,-7);
  const ganttEnd   = addDays(maxDate,14);
  const totalDays  = Math.max(daysBetween(ganttStart,ganttEnd),30);
  const DAY_W      = 22;

  const weeks = [];
  let wCur = new Date(ganttStart);
  while(wCur<ganttEnd){ weeks.push(new Date(wCur)); wCur=addDays(wCur,7); }

  const todayOff = daysBetween(ganttStart, new Date());

  const getBar = (item) => {
    const s = item.startDate;
    const e = item.targetDate||item.startDate;
    if(!s) return null;
    const left  = Math.max(0, daysBetween(ganttStart, new Date(s)));
    const width = Math.max(item.itemType==="milestone"?8:DAY_W, daysBetween(new Date(s),new Date(e))*DAY_W + DAY_W);
    return { left:left*DAY_W, width };
  };

  const saveEdit = (taskId, itemType) => {
    if(!editStart) return;
    const key = itemType==="milestone"?"milestones":"activities";
    onStateChange(prev=>({
      ...prev,
      l2:{
        ...prev.l2,
        sheets:{
          ...prev.l2.sheets,
          "03":{
            ...prev.l2.sheets["03"],
            data:{
              ...prev.l2.sheets["03"].data,
              [key]:(prev.l2.sheets["03"].data?.[key]||[]).map(i=>
                i._id===taskId ? {...i, startDate:editStart, targetDate:editEnd||editStart, _autoDate:false} : i
              ),
            },
          },
        },
      },
    }));
    setEditing(null);
  };

  const updateCost = (id, field, value) => {
    setCostData(prev => ({ ...prev, [id]: { ...(prev[id]||{}), [field]:value } }));
  };

  // Calculate cumulative planned and actual
  let cumPlanned = 0, cumActual = 0;

  // Items with cost
  const costItems = allItems.filter(i => costData[i._id]?.plannedAmount || costData[i._id]?.actualAmount);

  // Group by phase
  const phases = [...new Set(allItems.map(i=>i.phase||"Unassigned"))];
  phases.sort((a,b)=>PHASE_ORDER.indexOf(a)-PHASE_ORDER.indexOf(b));

  const thStyle = {
    padding:"6px 8px", fontSize:9, fontWeight:700, color:C.muted,
    textTransform:"uppercase", letterSpacing:".4px",
    borderBottom:`1px solid ${C.border}`, background:C.surface2,
    whiteSpace:"nowrap",
  };

  return (
    <div style={{ padding:20 }}>
      {/* Legend */}
      <div style={{ display:"flex", gap:16, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ fontSize:11, color:C.muted }}>
          {allItems.some(i=>i._autoDate) && <span style={{ color:C.milestone }}>⚠ Some dates estimated — click bar to set actual dates</span>}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.muted }}>
          <div style={{ width:16, height:2, background:C.risk }}/> Today
        </div>
        {canEdit && <span style={{ fontSize:11, color:C.accentL }}>Click bar to edit dates · Click cost cells to enter budget</span>}
      </div>

      {allItems.length === 0 && (
        <div style={{ color:C.muted, fontSize:13, textAlign:"center", padding:40 }}>
          No activities yet. Complete Sheet 03 in the Personalisation Layer.
        </div>
      )}

      {allItems.length > 0 && (
        <div style={{ border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <div style={{ minWidth: 680 + totalDays*DAY_W }}>

              {/* Column headers */}
              <div style={{ display:"flex", background:C.surface2, borderBottom:`1px solid ${C.border}`, position:"sticky", top:0, zIndex:10 }}>
                <div style={{ ...thStyle, width:60, flexShrink:0 }}>ID</div>
                <div style={{ ...thStyle, width:160, flexShrink:0 }}>Activity</div>
                <div style={{ ...thStyle, width:80, flexShrink:0 }}>Owner</div>
                <div style={{ ...thStyle, width:90, flexShrink:0, borderLeft:`1px solid ${C.border}` }}>
                  <div style={{ color:C.accentL }}>Planned (£)</div>
                  <div style={{ fontSize:8, fontWeight:400 }}>Amt · Cum · Acct</div>
                </div>
                <div style={{ ...thStyle, width:90, flexShrink:0, borderLeft:`1px solid ${C.border}` }}>
                  <div style={{ color:C.milestone }}>Actual (£)</div>
                  <div style={{ fontSize:8, fontWeight:400 }}>Amt · Cum · Acct</div>
                </div>
                <div style={{ ...thStyle, width:50, flexShrink:0 }}>Days</div>
                <div style={{ ...thStyle, width:60, flexShrink:0 }}>Progress</div>
                <div style={{ flex:1, position:"relative", height:34, overflow:"hidden", background:C.surface2, borderLeft:`1px solid ${C.border}` }}>
                  {weeks.filter((_,i)=>i%4===0).map((w,i)=>(
                    <div key={i} style={{ position:"absolute", left:daysBetween(ganttStart,w)*DAY_W, top:2, fontSize:8, fontWeight:700, color:C.dim, whiteSpace:"nowrap", paddingLeft:4 }}>
                      {new Date(w).toLocaleDateString("en-GB",{month:"short",year:"2-digit"})}
                    </div>
                  ))}
                  {weeks.map((w,i)=>(
                    <div key={i} style={{ position:"absolute", left:daysBetween(ganttStart,w)*DAY_W, top:16, fontSize:7, color:C.muted, whiteSpace:"nowrap", paddingLeft:2 }}>
                      {new Date(w).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}
                    </div>
                  ))}
                  {todayOff>=0&&todayOff<=totalDays&&(
                    <div style={{ position:"absolute", left:todayOff*DAY_W, top:0, width:2, height:"100%", background:C.risk, opacity:.8 }}/>
                  )}
                </div>
              </div>

              {/* Phase groups */}
              {phases.map(phase => {
                const items = allItems.filter(i=>(i.phase||"Unassigned")===phase);
                const col   = PHASE_COLORS[phase]||C.muted;

                return (
                  <div key={phase}>
                    {/* Phase header */}
                    <div style={{ display:"flex", background:"rgba(0,0,0,0.12)", borderBottom:`1px solid ${C.border}` }}>
                      <div style={{ width:590, flexShrink:0, padding:"3px 8px", display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ width:3, height:10, background:col, borderRadius:1 }}/>
                        <span style={{ fontSize:9, fontWeight:700, color:col, textTransform:"uppercase", letterSpacing:".4px" }}>{phase}</span>
                      </div>
                      <div style={{ flex:1, height:20 }}/>
                    </div>

                    {/* Activity rows */}
                    {items.map((item, idx) => {
                      const bar     = getBar(item);
                      const isMil   = item.itemType==="milestone";
                      const isEdit  = editing===item._id;
                      const owner   = getOwner(item._id, raciData, loginCodes);
                      const days    = item.startDate && item.targetDate ? daysBetween(new Date(item.startDate), new Date(item.targetDate)) : "—";
                      const progress = item._complete ? 100 : 0;
                      const cd       = costData[item._id] || {};

                      // Running cumulative
                      const pa = parseFloat(cd.plannedAmount)||0;
                      const aa = parseFloat(cd.actualAmount)||0;
                      cumPlanned += pa;
                      cumActual  += aa;
                      const thisCumP = cumPlanned;
                      const thisCumA = cumActual;

                      const tdBase = { padding:"5px 8px", fontSize:10, color:C.sage, borderBottom:`1px solid ${C.border}`, background: idx%2===0?C.surface:"transparent", flexShrink:0 };

                      return (
                        <div key={item._id||idx}>
                          <div style={{ display:"flex", alignItems:"center" }}>
                            {/* ID */}
                            <div style={{ ...tdBase, width:60, fontFamily:"monospace", fontSize:9, color:isMil?C.milestone:C.muted }}>
                              {item._id}
                            </div>
                            {/* Name */}
                            <div style={{ ...tdBase, width:160 }}>
                              <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:item._complete?C.muted:C.sage, textDecoration:item._complete?"line-through":"none", fontSize:11 }}>
                                {isMil?"🏁 ":""}{item.name||item.description||"—"}
                              </div>
                              {item._autoDate && <div style={{ fontSize:8, color:C.milestone }}>est. dates</div>}
                            </div>
                            {/* Owner */}
                            <div style={{ ...tdBase, width:80, fontSize:10, color:owner?C.accentL:C.muted }}>
                              {owner||"—"}
                            </div>
                            {/* Planned cost */}
                            <div style={{ ...tdBase, width:90, borderLeft:`1px solid ${C.border}` }}>
                              {canEdit ? (
                                <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                                  <input value={cd.plannedAmount||""} onChange={e=>updateCost(item._id,"plannedAmount",e.target.value)}
                                    placeholder="0" style={{ width:"100%", background:"transparent", border:"none", color:C.accentL, fontSize:10, outline:"none", fontFamily:"inherit" }}/>
                                  <div style={{ fontSize:9, color:C.muted }}>{pa>0?`Cum: £${thisCumP.toFixed(0)}`:"—"}</div>
                                  <input value={cd.costAccount||""} onChange={e=>updateCost(item._id,"costAccount",e.target.value)}
                                    placeholder={pa>0?getCostAccount(item._costIdx,projectCode):""}
                                    style={{ width:"100%", background:"transparent", border:"none", color:C.muted, fontSize:9, outline:"none", fontFamily:"monospace" }}/>
                                </div>
                              ) : (
                                <div>
                                  <div style={{ color:C.accentL }}>{pa>0?`£${pa}`:"—"}</div>
                                  <div style={{ fontSize:9, color:C.muted }}>{cd.costAccount||""}</div>
                                </div>
                              )}
                            </div>
                            {/* Actual cost */}
                            <div style={{ ...tdBase, width:90, borderLeft:`1px solid ${C.border}` }}>
                              {canEdit ? (
                                <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                                  <input value={cd.actualAmount||""} onChange={e=>updateCost(item._id,"actualAmount",e.target.value)}
                                    placeholder="0" style={{ width:"100%", background:"transparent", border:"none", color:aa>pa&&pa>0?C.risk:C.milestone, fontSize:10, outline:"none", fontFamily:"inherit" }}/>
                                  <div style={{ fontSize:9, color:C.muted }}>{aa>0?`Cum: £${thisCumA.toFixed(0)}`:"—"}</div>
                                </div>
                              ) : (
                                <div style={{ color:aa>pa&&pa>0?C.risk:C.milestone }}>{aa>0?`£${aa}`:"—"}</div>
                              )}
                            </div>
                            {/* Days */}
                            <div style={{ ...tdBase, width:50, textAlign:"center" }}>{days}</div>
                            {/* Progress */}
                            <div style={{ ...tdBase, width:60, textAlign:"center" }}>
                              <div style={{ fontSize:11, fontWeight:700, color:progress===100?C.activity:C.muted }}>
                                {progress}%
                              </div>
                              <div style={{ height:3, background:C.surface2, borderRadius:2, marginTop:2 }}>
                                <div style={{ width:`${progress}%`, height:"100%", background:C.activity, borderRadius:2 }}/>
                              </div>
                            </div>
                            {/* Gantt track */}
                            <div style={{ flex:1, position:"relative", height:36, overflow:"hidden", borderLeft:`1px solid ${C.border}`, background: idx%2===0?C.surface:"transparent", borderBottom:`1px solid ${C.border}` }}>
                              {weeks.map((w,i)=>(
                                <div key={i} style={{ position:"absolute", left:daysBetween(ganttStart,w)*DAY_W, top:0, width:1, height:"100%", background:C.border, opacity:.25 }}/>
                              ))}
                              {todayOff>=0&&todayOff<=totalDays&&(
                                <div style={{ position:"absolute", left:todayOff*DAY_W, top:0, width:2, height:"100%", background:C.risk, opacity:.5, zIndex:2 }}/>
                              )}
                              {bar && (
                                <div
                                  onClick={()=>{ if(!canEdit)return; setEditing(item._id); setEditStart(item.startDate||fmtInput(new Date())); setEditEnd(item.targetDate||fmtInput(addDays(new Date(),7))); }}
                                  title={`${fmtDate(item.startDate||new Date())} → ${fmtDate(item.targetDate||new Date())}${canEdit?" · Click to edit":""}`}
                                  style={{ position:"absolute", left:bar.left, width:bar.width, top:isMil?14:7, height:isMil?8:20, borderRadius:isMil?1:4,
                                    background:item._complete?C.activity+"99":col+"bb", border:`1px solid ${item._complete?C.activity:col}`,
                                    cursor:canEdit?"pointer":"default", display:"flex", alignItems:"center", paddingLeft:4,
                                    fontSize:8, color:"#fff", fontWeight:600, overflow:"hidden", whiteSpace:"nowrap", zIndex:3 }}>
                                  {!isMil&&bar.width>50&&(item.name||"").slice(0,14)}
                                </div>
                              )}
                              {!bar && canEdit && (
                                <div style={{ position:"absolute", left:8, top:10, fontSize:9, color:C.muted, fontStyle:"italic", cursor:"pointer" }}
                                  onClick={()=>{ setEditing(item._id); setEditStart(fmtInput(new Date())); setEditEnd(fmtInput(addDays(new Date(),14))); }}>
                                  + Set dates
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Inline date editor */}
                          {isEdit && (
                            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 8px 8px 68px", background:"rgba(46,125,82,0.1)", borderBottom:`1px solid ${C.border}`, flexWrap:"wrap" }}>
                              <span style={{ fontSize:11, color:C.dim, fontWeight:600 }}>Edit: {item.name||item._id}</span>
                              <div>
                                <div style={{ fontSize:8, color:C.muted, marginBottom:2 }}>Start</div>
                                <input type="date" value={editStart} onChange={e=>setEditStart(e.target.value)}
                                  style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:4, color:C.sage, fontSize:10, padding:"3px 6px", outline:"none" }}/>
                              </div>
                              <div>
                                <div style={{ fontSize:8, color:C.muted, marginBottom:2 }}>End / Target</div>
                                <input type="date" value={editEnd} onChange={e=>setEditEnd(e.target.value)}
                                  style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:4, color:C.sage, fontSize:10, padding:"3px 6px", outline:"none" }}/>
                              </div>
                              <button onClick={()=>saveEdit(item._id,item.itemType)}
                                style={{ padding:"4px 12px", background:C.accent, border:"none", borderRadius:4, color:"#fff", fontSize:10, fontWeight:700, cursor:"pointer", marginTop:10 }}>
                                Save
                              </button>
                              <button onClick={()=>setEditing(null)}
                                style={{ padding:"4px 10px", background:"none", border:`1px solid ${C.border}`, borderRadius:4, color:C.muted, fontSize:10, cursor:"pointer", marginTop:10 }}>
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Cost summary row */}
              {Object.values(costData).some(c=>c.plannedAmount||c.actualAmount) && (
                <div style={{ display:"flex", background:C.surface2, borderTop:`2px solid ${C.border}` }}>
                  <div style={{ width:220, flexShrink:0, padding:"8px", fontSize:11, fontWeight:700, color:C.sage }}>TOTAL</div>
                  <div style={{ width:80, flexShrink:0 }}/>
                  <div style={{ width:90, flexShrink:0, padding:"8px", borderLeft:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.accentL }}>£{cumPlanned.toFixed(0)}</div>
                    <div style={{ fontSize:9, color:C.muted }}>Planned</div>
                  </div>
                  <div style={{ width:90, flexShrink:0, padding:"8px", borderLeft:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:11, fontWeight:700, color:cumActual>cumPlanned?C.risk:C.milestone }}>£{cumActual.toFixed(0)}</div>
                    <div style={{ fontSize:9, color:C.muted }}>Actual {cumPlanned>0?`(${Math.round(cumActual/cumPlanned*100)}%)`:"—"}</div>
                  </div>
                  <div style={{ flex:1 }}/>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cost breakdown table */}
      {costItems.length > 0 && (
        <div style={{ marginTop:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>
            Cost Breakdown
          </div>
          <div style={{ border:`1px solid ${C.border}`, borderRadius:7, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"80px 1fr 100px 80px 100px", background:C.surface2, borderBottom:`1px solid ${C.border}` }}>
              {["ID","Activity","Cost Account","Planned (£)","Actual (£)"].map(h=>(
                <div key={h} style={{ padding:"6px 10px", fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px" }}>{h}</div>
              ))}
            </div>
            {costItems.map((item,i)=>{
              const cd = costData[item._id]||{};
              const acct = cd.costAccount || getCostAccount(item._costIdx, projectCode);
              return (
                <div key={item._id} style={{ display:"grid", gridTemplateColumns:"80px 1fr 100px 80px 100px", borderBottom:`1px solid ${C.border}`, background:i%2===0?C.surface:"transparent" }}>
                  <div style={{ padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:C.muted }}>{item._id}</div>
                  <div style={{ padding:"6px 10px", fontSize:11, color:C.sage }}>{item.name||"—"}</div>
                  <div style={{ padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:C.accentL }}>{acct}</div>
                  <div style={{ padding:"6px 10px", fontSize:11, color:C.accentL }}>{cd.plannedAmount?`£${cd.plannedAmount}`:"—"}</div>
                  <div style={{ padding:"6px 10px", fontSize:11, color:parseFloat(cd.actualAmount||0)>parseFloat(cd.plannedAmount||0)&&cd.plannedAmount?C.risk:C.milestone }}>
                    {cd.actualAmount?`£${cd.actualAmount}`:"—"}
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
