import { useState, useRef, useEffect } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };
const inp = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:4, color:C.sage, fontSize:11, padding:"4px 7px", outline:"none", boxSizing:"border-box", fontFamily:"inherit", width:"100%" };

const PHASE_ORDER  = ["Initiation","Planning","Execution","Monitoring & Control","Closure"];
const PHASE_COLORS = { Initiation:"#5d8aff", Planning:"#3ae0a2", Execution:"#2E7D52", "Monitoring & Control":"#e0a23a", Closure:"#8aac96" };

function daysBetween(a,b) { return Math.round((b-a)/(1000*60*60*24)); }
function addDays(d,n) { const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function fmtDate(d) { if(!d) return ""; const dt=new Date(d); return dt.toLocaleDateString("en-GB",{day:"2-digit",month:"short"}); }

function autoAssignDates(items) {
  const sorted=[...items].sort((a,b)=>{
    const oi=PHASE_ORDER.indexOf(a.phase),oj=PHASE_ORDER.indexOf(b.phase);
    if(oi!==oj) return oi-oj; return 0;
  });
  let cursor=addDays(new Date(),1);
  return sorted.map(item=>{
    if(item._autoDate===false&&item.startDate) return item;
    const start=new Date(cursor);
    const dur=item.itemType==="milestone"?1:14;
    const end=addDays(start,dur-1);
    cursor=addDays(end,2);
    return {...item, startDate:start.toISOString().split("T")[0], targetDate:end.toISOString().split("T")[0], _autoDate:true};
  });
}

export default function L3IntegratedBaseline({ state, activities, milestones, member, raciData, onStateChange, onBaselineBlur }) {
  const project    = state?.project;
  const canEdit    = member?.isPM;
  const sheets     = state?.l2?.sheets || {};

  // ── Cost data — persisted in state ────────────────────────────────────
  const savedCostData = sheets["03"]?.data?.costData || {};
  const [costData, setCostData] = useState(() => {
    const init = {};
    activities.forEach(a => { init[a._id] = savedCostData[a._id] || { plannedAmount:"", actualAmount:"", costAccount:"" }; });
    milestones.forEach(m => { init[m._id] = savedCostData[m._id] || { plannedAmount:"", actualAmount:"", costAccount:"" }; });
    return init;
  });

  // ── Expenditure log entries ────────────────────────────────────────────
  const savedExpLog = sheets["03"]?.data?.expenditureLog || [];
  const [expLog, setExpLog]       = useState(savedExpLog);
  const [newExp, setNewExp]       = useState({ activityId:"", date:"", amount:"", description:"", invoiceRef:"" });

  const [editing,   setEditing]   = useState(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd,   setEditEnd]   = useState("");
  // Track unsaved field edits for leave-page detection
  const [dirtyFields, setDirtyFields] = useState({});

  const ganttScrollRef = useRef(null);

  const rawItems = [
    ...activities.map((a,i) => ({ ...a, itemType:"activity",  color:PHASE_COLORS[a.phase]||C.accentL, _costIdx:i })),
    ...milestones.map((m,i) => ({ ...m, itemType:"milestone", color:C.milestone, _costIdx:activities.length+i })),
  ].filter(i=>i.name||i.description);

  const allItems = autoAssignDates(rawItems);

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

  // ── Persist cost data + exp log to state ──────────────────────────────
  const persistCost = (newCostData, newExpLog) => {
    onStateChange(prev => ({
      ...prev,
      l2: {
        ...prev.l2,
        sheets: {
          ...prev.l2.sheets,
          "03": {
            ...prev.l2.sheets["03"],
            data: {
              ...prev.l2.sheets["03"]?.data,
              costData: newCostData,
              expenditureLog: newExpLog ?? (prev.l2.sheets["03"]?.data?.expenditureLog || []),
            },
          },
        },
      },
    }));
  };

  const saveEdit = (taskId, itemType) => {
    if(!editStart) return;
    const key = itemType==="milestone"?"milestones":"activities";
    const oldItem = (itemType==="milestone"?milestones:activities).find(i=>i._id===taskId);
    onBaselineBlur && onBaselineBlur(itemType, taskId, "startDate", oldItem?.startDate||"", editStart, oldItem?.name||taskId);
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
    const next = { ...costData, [id]: { ...(costData[id]||{}), [field]:value } };
    setCostData(next);
    setDirtyFields(prev=>({...prev,[id+field]:true}));
    persistCost(next, null);
  };

  const addExpEntry = () => {
    if(!newExp.activityId||!newExp.amount) return;
    const entry = { ...newExp, id:`EXP-${String(expLog.length+1).padStart(3,"0")}`, date: newExp.date || new Date().toISOString().split("T")[0] };
    const next  = [...expLog, entry];
    setExpLog(next);
    setNewExp({ activityId:"", date:"", amount:"", description:"", invoiceRef:"" });
    onStateChange(prev => ({
      ...prev,
      l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
        "03": { ...prev.l2.sheets["03"], data: { ...prev.l2.sheets["03"]?.data, expenditureLog: next } }
      }},
    }));
  };

  const removeExpEntry = (idx) => {
    const next = expLog.filter((_,i)=>i!==idx);
    setExpLog(next);
    onStateChange(prev => ({
      ...prev,
      l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
        "03": { ...prev.l2.sheets["03"], data: { ...prev.l2.sheets["03"]?.data, expenditureLog: next } }
      }},
    }));
  };

  const costItems = allItems.filter(i => costData[i._id]?.plannedAmount || costData[i._id]?.actualAmount);
  const phases = [...new Set(allItems.map(i=>i.phase||"Unassigned"))];
  phases.sort((a,b)=>PHASE_ORDER.indexOf(a)-PHASE_ORDER.indexOf(b));

  const thStyle = { padding:"6px 8px", fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", borderBottom:`1px solid ${C.border}`, background:C.surface2, whiteSpace:"nowrap" };

  // Planned vs actual cumulative by activity end date
  const costTimeline = (() => {
    const pts = allItems
      .filter(i => costData[i._id]?.plannedAmount)
      .map(i => ({ date:i.targetDate||i.startDate, planned:parseFloat(costData[i._id]?.plannedAmount)||0 }))
      .sort((a,b)=>new Date(a.date)-new Date(b.date));
    let cum=0; return pts.map(p=>({ date:p.date, planned:(cum+=p.planned) }));
  })();

  const actualByDate = (() => {
    const pts = expLog
      .filter(e=>e.amount)
      .map(e=>({ date:e.date, amt:parseFloat(e.amount)||0 }))
      .sort((a,b)=>new Date(a.date)-new Date(b.date));
    let cum=0; return pts.map(p=>({ date:p.date, actual:(cum+=p.amt) }));
  })();

  // Bar chart data by phase
  const phaseSpend = phases.map(ph => {
    const items = allItems.filter(i=>(i.phase||"Unassigned")===ph);
    const planned = items.reduce((s,i)=>s+(parseFloat(costData[i._id]?.plannedAmount)||0),0);
    const actual  = items.reduce((s,i)=>s+(parseFloat(costData[i._id]?.actualAmount)||0),0);
    return { phase:ph, planned, actual };
  }).filter(d=>d.planned>0||d.actual>0);

  const maxBarVal = Math.max(...phaseSpend.map(d=>Math.max(d.planned,d.actual)),1);

  // FROZEN COLUMN widths
  const COL_NAME = 180;
  const COL_PLAN = 80;
  const COL_ACT  = 80;
  const COL_TOTAL_FROZEN = COL_NAME + COL_PLAN + COL_ACT;
  const ganttWidth = totalDays * DAY_W;

  const frozenHead = { position:"sticky", left:0, zIndex:3, background:C.surface2 };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>

      {/* ── Gantt Table ─────────────────────────────────────────────── */}
      <div style={{ flex:"1 1 0", overflow:"auto", position:"relative" }} ref={ganttScrollRef}>
        <table style={{ borderCollapse:"collapse", width:"100%", minWidth: COL_TOTAL_FROZEN + ganttWidth }}>
          <thead>
            <tr>
              {/* Frozen column headers */}
              <th style={{ ...thStyle, ...frozenHead, width:COL_NAME, minWidth:COL_NAME, left:0 }}>Activity / Milestone</th>
              <th style={{ ...thStyle, ...frozenHead, width:COL_PLAN, minWidth:COL_PLAN, left:COL_NAME, textAlign:"right" }}>Planned £</th>
              <th style={{ ...thStyle, ...frozenHead, width:COL_ACT,  minWidth:COL_ACT,  left:COL_NAME+COL_PLAN, textAlign:"right", borderRight:`2px solid ${C.border}` }}>Actual £</th>
              {/* Week headers */}
              <th colSpan={weeks.length} style={{ ...thStyle, background:C.surface2, textAlign:"left", position:"sticky", top:0, zIndex:2 }}>
                <div style={{ display:"flex", position:"relative", height:20 }}>
                  {weeks.map((w,i)=>(
                    <div key={i} style={{ minWidth:7*DAY_W, fontSize:9, color:C.muted, paddingLeft:2, borderLeft:`1px solid ${C.border}` }}>
                      {w.toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}
                    </div>
                  ))}
                  {/* Today line header marker */}
                  <div style={{ position:"absolute", left: todayOff*DAY_W, top:0, bottom:0, width:2, background:C.accentL, opacity:.5 }}/>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {phases.map(phase => {
              const phaseItems = allItems.filter(i=>(i.phase||"Unassigned")===phase);
              if(!phaseItems.length) return null;
              return [
                <tr key={`ph-${phase}`}>
                  <td colSpan={3} style={{ padding:"5px 8px", fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", background:C.surface, position:"sticky", left:0, zIndex:2 }}>{phase}</td>
                  <td style={{ background:C.surface }}/>
                </tr>,
                ...phaseItems.map((item,idx) => {
                  const bar = getBar(item);
                  const cd  = costData[item._id] || {};
                  const isEditing = editing === item._id;
                  const isMilestone = item.itemType === "milestone";
                  const plannedDays = item.startDate && item.targetDate ? daysBetween(new Date(item.startDate), new Date(item.targetDate)) : null;
                  const actualDays  = item._actualStart && item.targetDate ? daysBetween(new Date(item._actualStart), new Date(item.targetDate)) : null;
                  return (
                    <tr key={item._id} style={{ background:idx%2===0?C.surface:"transparent", borderBottom:`1px solid ${C.border}22` }}>
                      {/* Frozen: Name */}
                      <td style={{ padding:"6px 8px", fontSize:11, color:isMilestone?C.milestone:C.sage, position:"sticky", left:0, zIndex:2, background:idx%2===0?C.surface:C.surface2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:COL_NAME }}>
                        {isMilestone?"◆ ":""}{item.name||item.description||"—"}
                        {plannedDays!==null&&<span style={{ fontSize:9, color:C.muted, marginLeft:6 }}>{plannedDays}d plan</span>}
                      </td>
                      {/* Frozen: Planned Cost */}
                      <td style={{ padding:"4px 6px", position:"sticky", left:COL_NAME, zIndex:2, background:idx%2===0?C.surface:C.surface2, textAlign:"right", width:COL_PLAN }}>
                        {canEdit ? (
                          <input style={{ ...inp, width:"100%", textAlign:"right" }}
                            value={cd.plannedAmount||""} onChange={e=>updateCost(item._id,"plannedAmount",e.target.value)}
                            placeholder="0"/>
                        ) : <span style={{ fontSize:11, color:C.dim }}>{cd.plannedAmount ? `£${cd.plannedAmount}` : "—"}</span>}
                      </td>
                      {/* Frozen: Actual Cost */}
                      <td style={{ padding:"4px 6px", position:"sticky", left:COL_NAME+COL_PLAN, zIndex:2, background:idx%2===0?C.surface:C.surface2, textAlign:"right", width:COL_ACT, borderRight:`2px solid ${C.border}` }}>
                        {canEdit ? (
                          <input style={{ ...inp, width:"100%", textAlign:"right" }}
                            value={cd.actualAmount||""} onChange={e=>updateCost(item._id,"actualAmount",e.target.value)}
                            placeholder="0"/>
                        ) : <span style={{ fontSize:11, color:C.dim }}>{cd.actualAmount ? `£${cd.actualAmount}` : "—"}</span>}
                      </td>
                      {/* Scrolling: Gantt bars */}
                      <td style={{ padding:0, position:"relative", height:32 }}>
                        <div style={{ position:"relative", width: ganttWidth, height:"100%" }}>
                          {/* Today line */}
                          <div style={{ position:"absolute", left:todayOff*DAY_W, top:0, bottom:0, width:1, background:C.accentL, opacity:.3 }}/>
                          {bar && (
                            isMilestone ? (
                              <div style={{ position:"absolute", left:bar.left, top:"50%", transform:"translateY(-50%) rotate(45deg)", width:10, height:10, background:item.color, borderRadius:2, cursor:canEdit?"pointer":"default" }}
                                onClick={()=>canEdit&&(setEditing(item._id),setEditStart(item.startDate||""),setEditEnd(item.targetDate||""))}/>
                            ) : (
                              <div style={{ position:"absolute", left:bar.left, top:"50%", transform:"translateY(-50%)", height:14, width:bar.width, background:item.color+"cc", borderRadius:3, cursor:canEdit?"pointer":"default", display:"flex", alignItems:"center", paddingLeft:4 }}
                                onClick={()=>canEdit&&(setEditing(item._id),setEditStart(item.startDate||""),setEditEnd(item.targetDate||""))}>
                                {isEditing && (
                                  <div style={{ position:"absolute", top:18, left:0, zIndex:20, background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:8, display:"flex", gap:6, alignItems:"center", whiteSpace:"nowrap", boxShadow:"0 4px 12px #0006" }}
                                    onClick={e=>e.stopPropagation()}>
                                    <input type="date" value={editStart} onChange={e=>setEditStart(e.target.value)} style={{...inp,width:130}}/>
                                    <span style={{color:C.muted,fontSize:11}}>→</span>
                                    <input type="date" value={editEnd} onChange={e=>setEditEnd(e.target.value)} style={{...inp,width:130}}/>
                                    <button onClick={()=>saveEdit(item._id,item.itemType)} style={{padding:"4px 10px",background:C.accent,border:"none",borderRadius:4,color:"#fff",fontSize:11,cursor:"pointer"}}>Save</button>
                                    <button onClick={()=>setEditing(null)} style={{padding:"4px 8px",background:"none",border:`1px solid ${C.border}`,borderRadius:4,color:C.muted,fontSize:11,cursor:"pointer"}}>✕</button>
                                  </div>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ];
            })}
          </tbody>
        </table>
      </div>

      {/* ── Cost Section ─────────────────────────────────────────────── */}
      <div style={{ borderTop:`2px solid ${C.border}`, padding:"16px 16px 0", background:C.surface }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:12 }}>Cost Overview</div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
          {/* Cumulative planned vs actual line chart (SVG) */}
          {costTimeline.length > 0 && (
            <div style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.muted, marginBottom:8 }}>CUMULATIVE COST — PLANNED VS ACTUAL</div>
              <svg width="100%" height="120" viewBox="0 0 300 120">
                {(() => {
                  const allPts = [...costTimeline, ...actualByDate];
                  if(!allPts.length) return null;
                  const dates = allPts.map(p=>new Date(p.date)).sort((a,b)=>a-b);
                  const minD  = dates[0], maxD = dates[dates.length-1];
                  const maxV  = Math.max(...costTimeline.map(p=>p.planned), ...actualByDate.map(p=>p.actual), 1);
                  const xOf = d => 20 + ((new Date(d)-minD)/(maxD-minD+1))*260;
                  const yOf = v => 110 - (v/maxV)*100;
                  const planLine = costTimeline.map((p,i)=>`${i===0?"M":"L"}${xOf(p.date).toFixed(1)},${yOf(p.planned).toFixed(1)}`).join(" ");
                  const actLine  = actualByDate.map((p,i)=>`${i===0?"M":"L"}${xOf(p.date).toFixed(1)},${yOf(p.actual).toFixed(1)}`).join(" ");
                  return (<>
                    <path d={planLine} stroke={C.accentL}  fill="none" strokeWidth="2" strokeDasharray="4 2"/>
                    <path d={actLine}  stroke={C.milestone} fill="none" strokeWidth="2"/>
                    <line x1="20" y1="110" x2="280" y2="110" stroke={C.border} strokeWidth="1"/>
                    <line x1="20" y1="10"  x2="20"  y2="110" stroke={C.border} strokeWidth="1"/>
                    <text x="25" y="10" fill={C.muted} fontSize="8">£{maxV.toLocaleString()}</text>
                    <text x="240" y="108" fill={C.accentL} fontSize="8">Planned</text>
                    <text x="240" y="100" fill={C.milestone} fontSize="8">Actual</text>
                  </>);
                })()}
              </svg>
            </div>
          )}

          {/* Phase bar chart */}
          {phaseSpend.length > 0 && (
            <div style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.muted, marginBottom:8 }}>SPEND BY PHASE — PLANNED VS ACTUAL</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {phaseSpend.map(({ phase, planned, actual },i) => (
                  <div key={i}>
                    <div style={{ fontSize:10, color:C.dim, marginBottom:3 }}>{phase}</div>
                    <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                      <div style={{ flex:1, height:10, background:C.border, borderRadius:2, overflow:"hidden" }}>
                        <div style={{ width:`${(planned/maxBarVal)*100}%`, height:"100%", background:C.accentL, borderRadius:2 }}/>
                      </div>
                      <span style={{ fontSize:9, color:C.accentL, minWidth:50, textAlign:"right" }}>£{planned.toLocaleString()}</span>
                    </div>
                    <div style={{ display:"flex", gap:4, alignItems:"center", marginTop:2 }}>
                      <div style={{ flex:1, height:10, background:C.border, borderRadius:2, overflow:"hidden" }}>
                        <div style={{ width:`${(actual/maxBarVal)*100}%`, height:"100%", background:C.milestone, borderRadius:2 }}/>
                      </div>
                      <span style={{ fontSize:9, color:C.milestone, minWidth:50, textAlign:"right" }}>£{actual.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:12, marginTop:8 }}>
                <div style={{ fontSize:9, color:C.accentL }}>▬ Planned</div>
                <div style={{ fontSize:9, color:C.milestone }}>▬ Actual</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Expenditure Log ─────────────────────────────────────────── */}
        <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14, marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>Expenditure Log</div>

          {/* Add new entry */}
          {canEdit && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 110px 90px 1fr 100px auto", gap:6, marginBottom:10, alignItems:"end" }}>
              <div>
                <div style={{ fontSize:9, color:C.muted, marginBottom:3 }}>ACTIVITY</div>
                <select style={inp} value={newExp.activityId} onChange={e=>setNewExp(p=>({...p,activityId:e.target.value}))}>
                  <option value="">Select activity…</option>
                  {allItems.map(i=><option key={i._id} value={i._id}>{i.name||i.description}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:9, color:C.muted, marginBottom:3 }}>DATE</div>
                <input type="date" style={inp} value={newExp.date} onChange={e=>setNewExp(p=>({...p,date:e.target.value}))}/>
              </div>
              <div>
                <div style={{ fontSize:9, color:C.muted, marginBottom:3 }}>AMOUNT £</div>
                <input style={inp} value={newExp.amount} onChange={e=>setNewExp(p=>({...p,amount:e.target.value}))} placeholder="0.00"/>
              </div>
              <div>
                <div style={{ fontSize:9, color:C.muted, marginBottom:3 }}>DESCRIPTION</div>
                <input style={inp} value={newExp.description} onChange={e=>setNewExp(p=>({...p,description:e.target.value}))} placeholder="e.g. Subcontractor invoice"/>
              </div>
              <div>
                <div style={{ fontSize:9, color:C.muted, marginBottom:3 }}>REF / INVOICE</div>
                <input style={inp} value={newExp.invoiceRef} onChange={e=>setNewExp(p=>({...p,invoiceRef:e.target.value}))} placeholder="INV-001"/>
              </div>
              <button onClick={addExpEntry} style={{ padding:"5px 12px", background:C.accent, border:"none", borderRadius:5, color:"#fff", fontSize:11, cursor:"pointer", alignSelf:"end" }}>+ Log</button>
            </div>
          )}

          {expLog.length === 0 && <div style={{ fontSize:11, color:C.muted, fontStyle:"italic" }}>No expenditure entries logged yet.</div>}

          {expLog.length > 0 && (
            <div style={{ overflowX:"auto" }}>
              <table style={{ borderCollapse:"collapse", width:"100%", fontSize:11 }}>
                <thead>
                  <tr>
                    {["ID","Activity","Date","Amount £","Description","Ref"].map(h=>(
                      <th key={h} style={{ padding:"5px 8px", fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${C.border}` }}>{h}</th>
                    ))}
                    {canEdit && <th style={{ borderBottom:`1px solid ${C.border}` }}/>}
                  </tr>
                </thead>
                <tbody>
                  {expLog.map((e,i)=>{
                    const act = allItems.find(a=>a._id===e.activityId);
                    return (
                      <tr key={i} style={{ borderBottom:`1px solid ${C.border}22` }}>
                        <td style={{ padding:"5px 8px", fontFamily:"monospace", fontSize:10, color:C.muted }}>{e.id}</td>
                        <td style={{ padding:"5px 8px", color:C.dim }}>{act?.name||act?.description||e.activityId}</td>
                        <td style={{ padding:"5px 8px", color:C.muted }}>{e.date}</td>
                        <td style={{ padding:"5px 8px", color:C.accentL, fontWeight:700 }}>£{parseFloat(e.amount||0).toLocaleString()}</td>
                        <td style={{ padding:"5px 8px", color:C.dim }}>{e.description}</td>
                        <td style={{ padding:"5px 8px", fontFamily:"monospace", fontSize:10, color:C.muted }}>{e.invoiceRef}</td>
                        {canEdit && <td style={{ padding:"5px 8px" }}><button onClick={()=>removeExpEntry(i)} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:11 }}>✕</button></td>}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ padding:"6px 8px", fontSize:10, fontWeight:700, color:C.muted }}>TOTAL</td>
                    <td style={{ padding:"6px 8px", fontSize:12, fontWeight:700, color:C.accentL }}>£{expLog.reduce((s,e)=>s+(parseFloat(e.amount)||0),0).toLocaleString()}</td>
                    <td colSpan={canEdit?3:2}/>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
