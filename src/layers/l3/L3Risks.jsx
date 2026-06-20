import { useState, useCallback, useMemo } from "react";

const C = {
  surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2",
};
const inp = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:4, color:C.sage, fontSize:11, padding:"5px 8px", outline:"none", fontFamily:"inherit", width:"100%", boxSizing:"border-box" };

function ragColor(l, i) { const s=(parseInt(l)||1)*(parseInt(i)||1); return s>=9?C.risk:s>=4?C.milestone:C.activity; }
function statusColor(s) { return ({Open:C.risk,"In Progress":C.milestone,Resolved:C.activity,Escalated:"#9c6ee0",Closed:C.muted}[s]||C.muted); }
function priorityColor(p) { return ({High:C.risk,Medium:C.milestone,Low:C.activity}[p]||C.muted); }
function toISO(d) { try { return d.toISOString().slice(0,10); } catch { return ""; } }

function Badge({ label, color, small }) {
  return <span style={{ fontSize:small?8:9, fontWeight:700, padding:small?"1px 5px":"2px 7px", borderRadius:12, background:color+"22", color, border:`1px solid ${color}44`, whiteSpace:"nowrap" }}>{label}</span>;
}
function Lbl({ c }) {
  return <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:3 }}>{c}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk card — collapsible, with all four management features
// FIX BUG 3: added onClose prop for closure confirmation feedback
// ─────────────────────────────────────────────────────────────────────────────
function RiskCard({ risk, idx, canEdit, onUpdate, onRaiseCCR, onClose }) {
  const [open,     setOpen]     = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewL,    setReviewL]    = useState(risk.likelihood || "1 - Low");
  const [reviewI,    setReviewI]    = useState(risk.impact     || "1 - Low");
  const [newAction,  setNewAction]  = useState({ text:"", owner:"", dueDate:"", done:false });

  const score   = (parseInt(risk.likelihood)||1) * (parseInt(risk.impact)||1);
  const rag     = ragColor(risk.likelihood, risk.impact);
  const actions = risk.actions      || [];
  const history = risk.reviewHistory || [];
  const isClosed = risk.status === "Closed";

  // ── Add a review entry (score + note) ──────────────────────────────────────────────────
  const submitReview = () => {
    if (!reviewNote.trim()) return;
    const entry = {
      date:       toISO(new Date()),
      likelihood: reviewL,
      impact:     reviewI,
      score:      (parseInt(reviewL)||1)*(parseInt(reviewI)||1),
      note:       reviewNote.trim(),
    };
    onUpdate(idx, "reviewHistory",  [...history, entry]);
    onUpdate(idx, "likelihood",     reviewL);
    onUpdate(idx, "impact",         reviewI);
    onUpdate(idx, "lastReviewed",   toISO(new Date()));
    setReviewNote(""); setShowReview(false);
  };

  // ── Close risk ──────────────────────────────────────────────────────────────────────────────────
  const closeRisk = () => {
    onUpdate(idx, "status",     "Closed");
    onUpdate(idx, "closedDate", toISO(new Date()));
    onClose?.(risk.name || risk._id); // FIX BUG 3: notify parent for confirmation toast
  };
  const reopenRisk = () => {
    onUpdate(idx, "status",    "Open");
    onUpdate(idx, "closedDate", "");
  };

  // ── Action items ───────────────────────────────────────────────────────────────────────────────────
  const addAction = () => {
    if (!newAction.text.trim()) return;
    const next = [...actions, { ...newAction, id:`ACT-${String(actions.length+1).padStart(2,"0")}`, done:false }];
    onUpdate(idx, "actions", next);
    setNewAction({ text:"", owner:"", dueDate:"", done:false });
  };
  const toggleAction = (ai) => {
    const next = actions.map((a,j) => j===ai ? { ...a, done:!a.done } : a);
    onUpdate(idx, "actions", next);
  };
  const removeAction = (ai) => {
    onUpdate(idx, "actions", actions.filter((_,j)=>j!==ai));
  };

  const openActions = actions.filter(a => !a.done).length;

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`,
      borderLeft:`3px solid ${isClosed ? C.muted : rag}`, borderRadius:8,
      marginBottom:10, opacity: isClosed ? 0.65 : 1 }}>

      {/* ── Collapsed header — always visible ── */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
        cursor:"pointer" }} onClick={() => setOpen(o => !o)}>
        <span style={{ fontFamily:"monospace", fontSize:11, color:C.muted, fontWeight:700 }}>{risk._id}</span>
        {isClosed
          ? <Badge label="Closed" color={C.muted}/>
          : <Badge label={`Score: ${score}`} color={rag}/>
        }
        {risk.category && <Badge label={risk.category} color={C.accentL} small/>}
        <span style={{ fontSize:12, color: isClosed ? C.muted : C.sage, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{risk.name||"—"}</span>
        {openActions > 0 && <Badge label={`${openActions} action${openActions>1?"s":""}`} color={C.milestone} small/>}
        {risk.lastReviewed && <span style={{ fontSize:9, color:C.muted }}>Reviewed {risk.lastReviewed}</span>}
        <span style={{ color:C.muted, fontSize:12 }}>{open ? "▲" : "▼"}</span>
      </div>

      {/* ── Expanded detail ── */}
      {open && (
        <div style={{ borderTop:`1px solid ${C.border}`, padding:"12px 14px" }}>

          {/* Risk details grid */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12, fontSize:11 }}>
            <div><span style={{ color:C.muted }}>Likelihood: </span><span style={{ color:C.dim }}>{risk.likelihood||"—"}</span></div>
            <div><span style={{ color:C.muted }}>Impact: </span><span style={{ color:C.dim }}>{risk.impact||"—"}</span></div>
            <div><span style={{ color:C.muted }}>Response: </span>{risk.response && <Badge label={risk.response} color={C.accentL} small/>}</div>
            <div><span style={{ color:C.muted }}>Owner: </span><span style={{ color:C.accentL }}>{risk._suggestedOwner||"—"}</span></div>
            {risk.cause         && <div style={{ gridColumn:"1/-1" }}><span style={{ color:C.muted }}>Cause: </span><span style={{ color:C.dim }}>{risk.cause}</span></div>}
            {risk.potentialImpact && <div style={{ gridColumn:"1/-1" }}><span style={{ color:C.muted }}>Potential impact: </span><span style={{ color:C.dim }}>{risk.potentialImpact}</span></div>}
            {risk.mitigation    && <div style={{ gridColumn:"1/-1" }}><span style={{ color:C.muted }}>Mitigation: </span><span style={{ color:C.dim }}>{risk.mitigation}</span></div>}
            {risk.closedDate    && <div style={{ gridColumn:"1/-1" }}><span style={{ color:C.muted }}>Closed: </span><span style={{ color:C.muted }}>{risk.closedDate}</span></div>}
          </div>

          {/* ── SECTION 1: Action Items ── */}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, marginBottom:12 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:8 }}>
              Response Actions {actions.length > 0 && `(${actions.filter(a=>a.done).length}/${actions.length} done)`}
            </div>

            {actions.map((a, ai) => (
              <div key={ai} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0",
                borderBottom:`1px solid ${C.border}22`, opacity: a.done ? 0.55 : 1 }}>
                <button onClick={() => toggleAction(ai)}
                  style={{ width:18, height:18, borderRadius:3, border:`1px solid ${a.done?C.activity:C.border}`,
                    background: a.done ? C.activity+"22" : "none", color:C.activity,
                    cursor:"pointer", fontSize:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {a.done ? "✓" : ""}
                </button>
                <span style={{ flex:1, fontSize:11, color: a.done ? C.muted : C.sage, textDecoration: a.done ? "line-through" : "none" }}>{a.text}</span>
                {a.owner   && <span style={{ fontSize:9, color:C.accentL }}>{a.owner}</span>}
                {a.dueDate && <span style={{ fontSize:9, color: new Date(a.dueDate)<new Date()&&!a.done?C.risk:C.muted, fontFamily:"monospace" }}>{a.dueDate}</span>}
                {canEdit && <button onClick={() => removeAction(ai)} style={{ background:"none", border:"none", color:C.risk, cursor:"pointer", fontSize:11, flexShrink:0 }}>✕</button>}
              </div>
            ))}

            {canEdit && !isClosed && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 110px auto", gap:6, marginTop:8 }}>
                <input style={inp} value={newAction.text}    onChange={e=>setNewAction(p=>({...p,text:e.target.value}))}    placeholder="Action description"/>
                <input style={inp} value={newAction.owner}   onChange={e=>setNewAction(p=>({...p,owner:e.target.value}))}   placeholder="Owner"/>
                <input style={inp} type="date" value={newAction.dueDate} onChange={e=>setNewAction(p=>({...p,dueDate:e.target.value}))}/>
                <button onClick={addAction} style={{ padding:"4px 10px", background:C.accent, border:"none", borderRadius:4, color:"#fff", fontSize:11, cursor:"pointer", whiteSpace:"nowrap" }}>+ Add</button>
              </div>
            )}
          </div>

          {/* ── SECTION 2: Review History ── */}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px" }}>
                Review History ({history.length})
              </div>
              {canEdit && !isClosed && (
                <button onClick={() => setShowReview(r=>!r)}
                  style={{ marginLeft:"auto", padding:"2px 10px", background:"none", border:`1px solid ${C.border}`, borderRadius:4, color:C.dim, fontSize:10, cursor:"pointer" }}>
                  {showReview ? "Cancel" : "+ Log Review"}
                </button>
              )}
            </div>

            {/* Review entry form */}
            {showReview && (
              <div style={{ background:C.surface2, borderRadius:6, padding:"10px 12px", marginBottom:10, border:`1px solid ${C.border}` }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                  <div>
                    <Lbl c="Revised Likelihood"/>
                    <select style={inp} value={reviewL} onChange={e=>setReviewL(e.target.value)}>
                      {["1 - Low","2 - Medium","3 - High"].map(l=><option key={l} value={l} style={{background:C.surface2}}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl c="Revised Impact"/>
                    <select style={inp} value={reviewI} onChange={e=>setReviewI(e.target.value)}>
                      {["1 - Low","2 - Medium","3 - High"].map(l=><option key={l} value={l} style={{background:C.surface2}}>{l}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn:"1/-1" }}>
                    <Lbl c="Review Note — what changed and why?"/>
                    <input style={inp} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="e.g. Mitigation implemented — likelihood reduced"/>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <span style={{ fontSize:10, color:C.muted, alignSelf:"center" }}>
                    New score: {(parseInt(reviewL)||1)*(parseInt(reviewI)||1)}
                    {" "}<Badge label={String((parseInt(reviewL)||1)*(parseInt(reviewI)||1))} color={ragColor(reviewL, reviewI)} small/>
                  </span>
                  <button onClick={submitReview} style={{ marginLeft:"auto", padding:"5px 14px", background:C.accent, border:"none", borderRadius:4, color:"#fff", fontSize:11, cursor:"pointer" }}>
                    Save Review
                  </button>
                </div>
              </div>
            )}

            {/* Review timeline */}
            {history.length === 0
              ? <div style={{ fontSize:11, color:C.muted, fontStyle:"italic" }}>No reviews logged yet.</div>
              : history.map((h, hi) => (
                <div key={hi} style={{ display:"flex", gap:10, padding:"5px 0", borderBottom:`1px solid ${C.border}22`, alignItems:"flex-start" }}>
                  <span style={{ fontFamily:"monospace", fontSize:9, color:C.muted, flexShrink:0, paddingTop:2 }}>{h.date}</span>
                  <Badge label={`Score: ${h.score}`} color={ragColor(h.likelihood, h.impact)} small/>
                  <span style={{ fontSize:11, color:C.dim, flex:1 }}>{h.note}</span>
                </div>
              ))
            }
          </div>

          {/* ── SECTION 3: Close risk / Raise CCR ── */}
          {canEdit && (
            <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, display:"flex", gap:8, flexWrap:"wrap" }}>
              {!isClosed ? (
                <>
                  <button onClick={closeRisk}
                    style={{ padding:"5px 12px", background:"none", border:`1px solid ${C.border}`, borderRadius:5, color:C.muted, fontSize:11, cursor:"pointer" }}>
                    ✓ Close Risk
                  </button>
                  <button onClick={() => onRaiseCCR("risk", risk)}
                    style={{ padding:"5px 12px", background:"none", border:`1px solid ${C.milestone}`, borderRadius:5, color:C.milestone, fontSize:11, cursor:"pointer" }}>
                    ↗ Raise CCR from this risk
                  </button>
                </>
              ) : (
                <button onClick={reopenRisk}
                  style={{ padding:"5px 12px", background:"none", border:`1px solid ${C.border}`, borderRadius:5, color:C.muted, fontSize:11, cursor:"pointer" }}>
                  ↩ Reopen Risk
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue card — with action log and CCR link
// ─────────────────────────────────────────────────────────────────────────────
function IssueCard({ iss, idx, canEdit, onUpdate, onRaiseCCR }) {
  const [open, setOpen] = useState(false);
  const [newAction, setNewAction] = useState({ text:"", owner:"", dueDate:"" });

  const sc      = statusColor(iss.status);
  const pc      = priorityColor(iss.priority);
  const actions = iss.actionLog || [];
  const overdue = iss.targetResolutionDate && new Date(iss.targetResolutionDate) < new Date() && iss.status !== "Resolved";

  const addAction = () => {
    if (!newAction.text.trim()) return;
    const entry = { ...newAction, date: toISO(new Date()), id:`AL-${String(actions.length+1).padStart(2,"0")}` };
    onUpdate(idx, "actionLog", [...actions, entry]);
    setNewAction({ text:"", owner:"", dueDate:"" });
  };

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`,
      borderLeft:`3px solid ${sc}`, borderRadius:8, marginBottom:10 }}>

      {/* Collapsed header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", cursor:"pointer" }}
        onClick={() => setOpen(o=>!o)}>
        <span style={{ fontFamily:"monospace", fontSize:11, color:C.muted, fontWeight:700 }}>{iss._id}</span>
        <Badge label={iss.status||"Open"} color={sc}/>
        <Badge label={iss.priority||"Medium"} color={pc} small/>
        {overdue && <Badge label="Overdue" color={C.risk} small/>}
        <span style={{ fontSize:12, color:C.sage, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{iss.name||"—"}</span>
        {actions.length > 0 && <Badge label={`${actions.length} action${actions.length>1?"s":""}`} color={C.accentL} small/>}
        {iss.targetResolutionDate && <span style={{ fontSize:9, color:overdue?C.risk:C.muted, fontFamily:"monospace" }}>Due {iss.targetResolutionDate}</span>}
        <span style={{ color:C.muted, fontSize:12 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ borderTop:`1px solid ${C.border}`, padding:"12px 14px" }}>

          {/* Issue details */}
          {iss.description && <div style={{ fontSize:12, color:C.dim, marginBottom:8, lineHeight:1.5 }}>{iss.description}</div>}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12, fontSize:11 }}>
            {iss.cause         && <div><span style={{ color:C.muted }}>Cause: </span><span style={{ color:C.dim }}>{iss.cause}</span></div>}
            {iss.impact        && <div><span style={{ color:C.muted }}>Impact: </span><span style={{ color:C.dim }}>{iss.impact}</span></div>}
            {iss.owner         && <div><span style={{ color:C.muted }}>Owner: </span><span style={{ color:C.accentL }}>{iss.owner}</span></div>}
            {iss.escalationPath && <div><span style={{ color:C.muted }}>Escalation: </span><span style={{ color:C.dim }}>{iss.escalationPath}</span></div>}
            {iss.raisedDate    && <div><span style={{ color:C.muted }}>Raised: </span><span style={{ color:C.muted }}>{iss.raisedDate}</span></div>}
          </div>

          {/* Status + Resolution — editable */}
          {canEdit && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:8, marginBottom:12 }}>
              <div>
                <Lbl c="Status"/>
                <select style={inp} value={iss.status||"Open"} onChange={e=>onUpdate(idx,"status",e.target.value)}>
                  {["Open","In Progress","Resolved","Escalated"].map(s=><option key={s} value={s} style={{background:C.surface2}}>{s}</option>)}
                </select>
              </div>
              <div>
                <Lbl c="Resolution Summary"/>
                <input style={inp} value={iss.resolution||""} onChange={e=>onUpdate(idx,"resolution",e.target.value)} placeholder="What was done to resolve this?"/>
              </div>
            </div>
          )}

          {/* ── Action Log ── */}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, marginBottom:12 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:8 }}>
              Action Log ({actions.length})
            </div>

            {actions.length === 0
              ? <div style={{ fontSize:11, color:C.muted, fontStyle:"italic", marginBottom:8 }}>No actions logged yet.</div>
              : actions.map((a, ai) => (
                <div key={ai} style={{ display:"flex", gap:8, padding:"5px 0", borderBottom:`1px solid ${C.border}22`, alignItems:"flex-start" }}>
                  <span style={{ fontFamily:"monospace", fontSize:9, color:C.muted, flexShrink:0, paddingTop:2 }}>{a.date}</span>
                  <span style={{ fontSize:11, color:C.sage, flex:1 }}>{a.text}</span>
                  {a.owner   && <span style={{ fontSize:9, color:C.accentL, flexShrink:0 }}>{a.owner}</span>}
                  {a.dueDate && <span style={{ fontSize:9, color:C.muted, fontFamily:"monospace", flexShrink:0 }}>{a.dueDate}</span>}
                </div>
              ))
            }

            {canEdit && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 110px auto", gap:6, marginTop:8 }}>
                <input style={inp} value={newAction.text}    onChange={e=>setNewAction(p=>({...p,text:e.target.value}))}    placeholder="Action taken or assigned"/>
                <input style={inp} value={newAction.owner}   onChange={e=>setNewAction(p=>({...p,owner:e.target.value}))}   placeholder="Owner"/>
                <input style={inp} type="date" value={newAction.dueDate} onChange={e=>setNewAction(p=>({...p,dueDate:e.target.value}))}/>
                <button onClick={addAction} style={{ padding:"4px 10px", background:C.accent, border:"none", borderRadius:4, color:"#fff", fontSize:11, cursor:"pointer", whiteSpace:"nowrap" }}>+ Log</button>
              </div>
            )}
          </div>

          {/* ── Raise CCR ── */}
          {canEdit && iss.status !== "Resolved" && (
            <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, display:"flex", gap:8 }}>
              <button onClick={() => onRaiseCCR("issue", iss)}
                style={{ padding:"5px 12px", background:"none", border:`1px solid ${C.milestone}`, borderRadius:5, color:C.milestone, fontSize:11, cursor:"pointer" }}>
                ↗ Raise CCR from this issue
              </button>
              <span style={{ fontSize:10, color:C.muted, alignSelf:"center" }}>
                Use when the issue requires a change to scope, cost, or schedule
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CCR pre-fill modal
// ─────────────────────────────────────────────────────────────────────────────
function CCRPrefillModal({ source, item, onConfirm, onClose }) {
  const [desc,   setDesc]   = useState(`${source==="risk"?"Risk":"Issue"} ${item._id}: ${item.name||""}`);
  const [justif, setJustif] = useState(source==="risk"
    ? `Risk response requires change to baseline. Risk: ${item.name||""}. Mitigation: ${item.mitigation||"TBC"}`
    : `Issue requires baseline change. Issue: ${item.name||""}. Impact: ${item.impact||"TBC"}`
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, width:"100%", maxWidth:520, padding:"20px 24px" }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.sage, marginBottom:4 }}>Raise Change Request</div>
        <div style={{ fontSize:11, color:C.muted, marginBottom:16 }}>
          Linked to {source==="risk"?"Risk":"Issue"} <span style={{ fontFamily:"monospace", color:C.accentL }}>{item._id}</span>
        </div>
        <div style={{ marginBottom:10 }}>
          <Lbl c="Description"/>
          <input style={inp} value={desc} onChange={e=>setDesc(e.target.value)}/>
        </div>
        <div style={{ marginBottom:16 }}>
          <Lbl c="Justification"/>
          <input style={inp} value={justif} onChange={e=>setJustif(e.target.value)}/>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onClose} style={{ flex:1, padding:"8px", background:"none", border:`1px solid ${C.border}`, borderRadius:5, color:C.muted, fontSize:11, cursor:"pointer" }}>Cancel</button>
          <button onClick={() => onConfirm({ desc, justif })}
            style={{ flex:2, padding:"8px", background:C.accent, border:"none", borderRadius:5, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            Create CCR → Change Control
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function L3Risks({ state, risks, member, onStateChange }) {
  const [activeTab,    setActiveTab]    = useState("risks");
  const [ccrSource,    setCcrSource]    = useState(null); // { type:"risk"|"issue", item }
  const [filterClosed, setFilterClosed] = useState(false);
  const [closeToast,   setCloseToast]   = useState(""); // FIX BUG 3: closure confirmation

  const canEdit = member?.isPM;
  const sheets  = state?.l2?.sheets || {};
  const issues  = sheets["05"]?.data?.issues || [];
  const changes = sheets["06"]?.data?.changes || [];

  // ── Update a risk field in state ──────────────────────────────────────────────────────
  const updateRisk = useCallback((idx, field, val) => {
    onStateChange(prev => {
      const d05 = prev.l2.sheets["05"]?.data || {};
      const next = (d05.risks||[]).map((r,i) => i===idx ? { ...r, [field]:val } : r);
      return { ...prev, l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
        "05": { ...prev.l2.sheets["05"], data: { ...d05, risks:next } }
      }}};
    });
  }, [onStateChange]);

  // ── Update an issue field in state ──────────────────────────────────────────────────────
  const updateIssue = useCallback((idx, field, val) => {
    onStateChange(prev => {
      const d05 = prev.l2.sheets["05"]?.data || {};
      const next = (d05.issues||[]).map((iss,i) => i===idx ? { ...iss, [field]:val } : iss);
      return { ...prev, l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
        "05": { ...prev.l2.sheets["05"], data: { ...d05, issues:next } }
      }}};
    });
  }, [onStateChange]);

  // ── Add new issue ──────────────────────────────────────────────────────────────────────────────
  const addIssue = useCallback(() => {
    onStateChange(prev => {
      const d05  = prev.l2.sheets["05"]?.data || {};
      const curr = d05.issues || [];
      const next = [...curr, {
        _id:`I-${String(101+curr.length).padStart(3,"0")}`,
        name:"", description:"", cause:"", impact:"",
        priority:"Medium", owner:"", raisedDate: toISO(new Date()),
        targetResolutionDate:"", status:"Open", resolution:"",
        escalationPath:"", actionLog:[],
      }];
      return { ...prev, l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
        "05": { ...prev.l2.sheets["05"], data: { ...d05, issues:next } }
      }}};
    });
  }, [onStateChange]);

  // ── Raise CCR from risk or issue ──────────────────────────────────────────────────────────────────────
  const handleRaiseCCR = useCallback((type, item) => {
    setCcrSource({ type, item });
  }, []);

  // FIX BUG 3: confirmCCR now:
  // – uses max-suffix ID generation (no collision when records are deleted)
  // – resolves reviewer and approver from state (no new props required)
  // – includes an impacts array so CCR routing logic can process the request
  // – uses correct date format matching the rest of the CCR log
  const confirmCCR = useCallback(({ desc, justif }) => {
    if (!ccrSource) return;
    const { type, item } = ccrSource;
    onStateChange(prev => {
      const d06       = prev.l2.sheets["06"]?.data || {};
      const curr      = d06.changes || [];
      const approvers = d06.approvers || [];

      // Max-suffix ID — no collision when records are deleted
      const major  = curr.filter(c => (c.id || "").startsWith("CCR-"));
      const maxNum = major.reduce((max, c) => {
        const n = parseInt((c.id || "").replace("CCR-", ""), 10);
        return isNaN(n) ? max : Math.max(max, n);
      }, 0);
      const newId = `CCR-${String(maxNum + 1).padStart(3, "0")}`;

      // Resolve reviewer and approver using same rights-based logic as OperatingLayer
      const impacts  = type === "issue" ? ["Scope"] : ["Time"];
      const reviewer = approvers.find(a => (a.rights || []).includes("reviewer"))
                    || approvers.find(a => a.tier === "Tier 3 — Project Manager")
                    || approvers[0] || null;
      const approver = approvers.find(a => (a.rights || []).includes("approver"))
                    || approvers.find(a => a.tier === "Tier 1 — Sponsor")
                    || approvers[0] || null;

      const newCCR = {
        id:            newId,
        type:          "major",
        date:          new Date().toLocaleDateString("en-GB"),
        status:        "pending",
        priority:      type === "issue" ? "High" : "Medium",
        description:   desc,
        justification: justif,
        requestedBy:   member?.loginCode || "PM",
        linkedId:      item._id,
        linkedType:    type,
        oldValue:      "",
        proposedValue: "",
        impacts,
        reviewerCode:  reviewer?.loginCode || "",
        reviewerName:  reviewer?.name      || reviewer?.role || "",
        approverCode:  approver?.loginCode || "",
        approverName:  approver?.name      || approver?.role || "",
      };
      return { ...prev, l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
        "06": { ...prev.l2.sheets["06"], data: { ...d06, changes: [...curr, newCCR] } }
      }}};
    });
    setCcrSource(null);
  }, [ccrSource, member, onStateChange]);

  // ── Filtered views ────────────────────────────────────────────────────────────────────────────
  const displayRisks = useMemo(() =>
    filterClosed ? risks : risks.filter(r => r.status !== "Closed"),
  [risks, filterClosed]);

  const closedCount = risks.filter(r => r.status === "Closed").length;

  const openRisks  = displayRisks.filter(r => (parseInt(r.likelihood)||1)*(parseInt(r.impact)||1) >= 9).length;
  const ambRisks   = displayRisks.filter(r => { const s=(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1); return s>=4&&s<9; }).length;
  const openIssues = issues.filter(i => i.status !== "Resolved").length;
  const resolvedIss= issues.filter(i => i.status === "Resolved").length;

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0, overflow:"hidden" }}>

      {/* Sub-nav */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", padding:"0 20px", flexShrink:0 }}>
        {[["risks",`Risks (${risks.length})`,"\u26A0\uFE0F"],["issues",`Issues (${issues.length})`,"\U0001F6A8"]].map(([id,label,icon]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{ display:"flex", alignItems:"center", gap:5, padding:"0 14px", height:38,
              fontSize:11, fontWeight:600, background:"none", border:"none",
              borderBottom:`2px solid ${activeTab===id?C.accentL:"transparent"}`,
              color:activeTab===id?C.sage:C.muted, cursor:"pointer", whiteSpace:"nowrap" }}>
            <span>{icon}</span>{label}
          </button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:10, fontSize:10, alignItems:"center" }}>
          {activeTab==="risks" ? (
            <>
              <span style={{ color:C.risk }}>⬤ {openRisks} Red</span>
              <span style={{ color:C.milestone }}>⬤ {ambRisks} Amber</span>
              <span style={{ color:C.activity }}>⬤ {displayRisks.length-openRisks-ambRisks} Green</span>
              {closedCount > 0 && (
                <button onClick={() => setFilterClosed(f=>!f)}
                  style={{ padding:"2px 8px", background:"none", border:`1px solid ${C.border}`, borderRadius:10, color:C.muted, fontSize:9, cursor:"pointer" }}>
                  {filterClosed ? `Hide ${closedCount} closed` : `Show ${closedCount} closed`}
                </button>
              )}
            </>
          ) : (
            <>
              <span style={{ color:C.risk }}>⬤ {openIssues} Open</span>
              <span style={{ color:C.activity }}>⬤ {resolvedIss} Resolved</span>
            </>
          )}
        </div>
      </div>

      {/* FIX BUG 3: closure confirmation toast */}
      {closeToast && (
        <div style={{ padding:"6px 20px", background:"rgba(58,224,162,0.08)", borderBottom:`1px solid ${C.activity}`,
          fontSize:11, color:C.activity, flexShrink:0 }}>
          ✓ {closeToast}
        </div>
      )}

      {/* Content */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>

        {activeTab === "risks" && (
          <div>
            {displayRisks.length === 0 && (
              <div style={{ padding:"48px 0", textAlign:"center", color:C.muted, fontSize:13 }}>
                {filterClosed && closedCount > 0
                  ? "No open risks. All risks are closed."
                  : "No risks logged yet. Go to L2 → Sheet 05 to add risks, or extract from a document in Layer 1."}
              </div>
            )}
            {displayRisks.map((r, i) => (
              <RiskCard
                key={r._id||i}
                risk={r}
                idx={risks.indexOf(r)}
                canEdit={canEdit}
                onUpdate={updateRisk}
                onRaiseCCR={handleRaiseCCR}
                onClose={name => {
                  setCloseToast(`Risk "${name}" closed`);
                  setTimeout(() => setCloseToast(""), 4000);
                }}
              />
            ))}
            {displayRisks.length > 0 && (
              <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>
                Basic risk details (name, category, mitigation) are configured in L2 → Sheet 05. Actions, reviews, and closure are managed here.
              </div>
            )}
          </div>
        )}

        {activeTab === "issues" && (
          <div>
            <div style={{ fontSize:12, color:C.dim, marginBottom:14, lineHeight:1.6 }}>
              Issues are risks that have materialised — active problems affecting the project now.
              Assign owners, log actions, and raise a CCR if scope or baseline changes are needed.
            </div>
            {issues.length === 0 && (
              <div style={{ padding:"32px 0", textAlign:"center", color:C.muted, fontSize:13 }}>
                No issues logged yet.{canEdit && <span style={{ color:C.accentL }}> Add one below.</span>}
              </div>
            )}
            {issues.map((iss, i) => (
              <IssueCard
                key={iss._id||i}
                iss={iss}
                idx={i}
                canEdit={canEdit}
                onUpdate={updateIssue}
                onRaiseCCR={handleRaiseCCR}
              />
            ))}
            {canEdit && (
              <button onClick={addIssue}
                style={{ padding:"8px 14px", background:"none", border:`1px dashed ${C.border}`, borderRadius:6, color:C.dim, fontSize:12, cursor:"pointer", width:"100%", marginTop:4 }}>
                + Log Issue
              </button>
            )}
          </div>
        )}
      </div>

      {/* CCR prefill modal */}
      {ccrSource && (
        <CCRPrefillModal
          source={ccrSource.type}
          item={ccrSource.item}
          onConfirm={confirmCCR}
          onClose={() => setCcrSource(null)}
        />
      )}
    </div>
  );
}
