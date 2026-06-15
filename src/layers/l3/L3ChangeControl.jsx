import { useState } from "react";

const C = {
  bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2",
};

const inp = {
  width:"100%", background:C.surface2, border:`1px solid ${C.border}`,
  borderRadius:5, color:C.sage, fontSize:12, padding:"7px 10px",
  outline:"none", boxSizing:"border-box", fontFamily:"inherit",
};

const STATUS_COLORS = {
  pending:   { color:C.milestone,  label:"Pending"   },
  reviewed:  { color:"#3a9ce0",    label:"Reviewed"  },
  approved:  { color:C.activity,   label:"Approved"  },
  rejected:  { color:C.risk,       label:"Rejected"  },
};

function Badge({ status }) {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{ fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:20,
      background:cfg.color+"22", color:cfg.color, border:`1px solid ${cfg.color}55` }}>
      {cfg.label}
    </span>
  );
}

function ImpactPill({ imp }) {
  const cols = { Scope:C.accentL, Time:C.milestone, Cost:C.risk, Quality:"#3a9ce0" };
  return (
    <span style={{ fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:10,
      background:(cols[imp]||C.muted)+"22", color:cols[imp]||C.muted,
      border:`1px solid ${(cols[imp]||C.muted)}55` }}>
      {imp}
    </span>
  );
}

export default function L3ChangeControl({ changes, approvers, member, onApproveAction, onNavigateToElement }) {
  const [activeTab,   setActiveTab]   = useState("major");
  const [rejectId,    setRejectId]    = useState(null);
  const [rejectReason,setRejectReason]= useState("");

  const loginCode = member?.loginCode;
  const isPM      = member?.isPM;

  const majorChanges = (changes||[]).filter(c => c.type === "major");
  const minorChanges = (changes||[]).filter(c => c.type === "minor");

  // Count pending actions for this user
  const pendingForMe = majorChanges.filter(c => {
    if (c.status === "pending"  && c.reviewerCode  === loginCode) return true;
    if (c.status === "reviewed" && c.approverCode  === loginCode) return true;
    return false;
  }).length;

  const canReview  = (c) => c.status === "pending"  && c.reviewerCode  === loginCode;
  const canApprove = (c) => c.status === "reviewed" && c.approverCode  === loginCode;
  const canReject  = (c) => (c.status === "pending" || c.status === "reviewed") && (c.reviewerCode === loginCode || c.approverCode === loginCode || isPM);

  const handleReview = (ccrId) => onApproveAction(ccrId, "reviewed", null);
  const handleApprove = (ccrId) => onApproveAction(ccrId, "approved", null);
  const handleReject = (ccrId) => {
    if (!rejectReason.trim()) return;
    onApproveAction(ccrId, "rejected", rejectReason);
    setRejectId(null);
    setRejectReason("");
  };

  const Lbl = ({c}) => <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:3 }}>{c}</div>;

  return (
    <div style={{ padding:20 }}>
      {/* Tab bar */}
      <div style={{ display:"flex", gap:4, marginBottom:16, borderBottom:`1px solid ${C.border}`, paddingBottom:8 }}>
        {[["major","Change Requests"],["minor","Minor Updates"]].map(([t,l])=>(
          <button key={t} onClick={()=>setActiveTab(t)}
            style={{ padding:"6px 16px", borderRadius:5, border:"none", fontSize:12, fontWeight:600,
              background: activeTab===t ? C.accent : "none",
              color: activeTab===t ? "#fff" : C.muted, cursor:"pointer",
              display:"flex", alignItems:"center", gap:6 }}>
            {l}
            {t==="major" && pendingForMe>0 && (
              <span style={{ background:C.risk, color:"#fff", fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:10 }}>
                {pendingForMe}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* MAJOR CHANGES — CCR log */}
      {activeTab === "major" && (
        <div>
          {majorChanges.length === 0 && (
            <div style={{ color:C.muted, fontSize:13, textAlign:"center", padding:40 }}>
              <div style={{ fontSize:32, opacity:.3, marginBottom:12 }}>📋</div>
              No change requests yet. When a baseline element (scope, time, cost) is edited in the operating layer, a Change Request will appear here.
            </div>
          )}

          {majorChanges.map((ccr, i) => {
            const isRejectOpen = rejectId === ccr.id;
            const myAction = canReview(ccr) ? "review" : canApprove(ccr) ? "approve" : null;

            return (
              <div key={ccr.id||i} style={{
                background:C.surface, border:`1px solid ${myAction ? C.accentL : C.border}`,
                borderRadius:8, padding:"14px 16px", marginBottom:12,
              }}>
                {/* CCR Header */}
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, flexWrap:"wrap" }}>
                  <span style={{ fontFamily:"monospace", fontSize:12, color:C.accentL, fontWeight:700 }}>{ccr.id}</span>
                  <Badge status={ccr.status}/>
                  <span style={{ fontSize:11, color:C.muted }}>{ccr.date}</span>
                  <span style={{ fontSize:11, color:C.dim }}>by {ccr.requestedBy}</span>
                  {(ccr.impacts||[]).map(imp => <ImpactPill key={imp} imp={imp}/>)}
                  <span style={{ fontSize:10, fontWeight:700, padding:"1px 7px", borderRadius:20,
                    background: ccr.priority==="High"?C.risk+"22":ccr.priority==="Low"?C.activity+"22":C.milestone+"22",
                    color: ccr.priority==="High"?C.risk:ccr.priority==="Low"?C.activity:C.milestone }}>
                    {ccr.priority}
                  </span>
                  {myAction && (
                    <span style={{ marginLeft:"auto", fontSize:10, color:C.accentL, fontWeight:700 }}>
                      ● Action required from you
                    </span>
                  )}
                </div>

                {/* Description & justification */}
                <div style={{ fontSize:12, color:C.sage, marginBottom:4 }}>{ccr.description}</div>
                <div style={{ fontSize:11, color:C.dim, marginBottom:10 }}>
                  <span style={{ color:C.muted }}>Justification: </span>{ccr.justification}
                </div>

                {/* Impacted elements */}
                {(ccr.impacts||[]).length > 0 && onNavigateToElement && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:6 }}>
                      Impacted Baseline Elements
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {(ccr.impacts||[]).map(imp => (
                        <button key={imp} onClick={() => onNavigateToElement(ccr, imp)}
                          style={{ padding:"4px 12px", borderRadius:5, fontSize:11, fontWeight:600,
                            border:`1px solid ${C.border}`, background:C.surface2,
                            color:C.accentL, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                          → Review {imp} changes
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Proposed value */}
                {ccr.proposedValue !== undefined && (
                  <div style={{ background:C.surface2, borderRadius:5, padding:"8px 12px", marginBottom:10, fontSize:11 }}>
                    <span style={{ color:C.muted }}>Change: </span>
                    <span style={{ color:C.risk, textDecoration:"line-through", marginRight:8 }}>{String(ccr.oldValue||"")}</span>
                    <span style={{ color:C.activity }}>→ {String(ccr.proposedValue||"")}</span>
                  </div>
                )}

                {/* Approval trail */}
                <div style={{ display:"flex", gap:12, paddingTop:10, borderTop:`1px solid ${C.border}`, flexWrap:"wrap", alignItems:"center" }}>
                  {/* Reviewer */}
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{
                      width:20, height:20, borderRadius:4,
                      background: ccr.status==="pending" ? C.surface2 : C.accentL+"22",
                      border:`1px solid ${ccr.status==="pending" ? C.border : C.accentL}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:12, color:C.accentL,
                    }}>
                      {ccr.status !== "pending" ? "✓" : ""}
                    </div>
                    <div>
                      <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase" }}>Reviewed by</div>
                      <div style={{ fontSize:11, color:C.dim }}>{ccr.reviewerName||"—"}</div>
                    </div>
                    {canReview(ccr) && (
                      <button onClick={() => handleReview(ccr.id)}
                        style={{ padding:"4px 12px", background:C.accentL, border:"none", borderRadius:4,
                          color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", marginLeft:6 }}>
                        ✓ Mark Reviewed
                      </button>
                    )}
                  </div>

                  <div style={{ color:C.border }}>→</div>

                  {/* Approver */}
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{
                      width:20, height:20, borderRadius:4,
                      background: ccr.status==="approved" ? C.activity+"22" : C.surface2,
                      border:`1px solid ${ccr.status==="approved" ? C.activity : C.border}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:12, color:C.activity,
                    }}>
                      {ccr.status==="approved" ? "✓" : ""}
                    </div>
                    <div>
                      <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase" }}>Approved by</div>
                      <div style={{ fontSize:11, color:C.dim }}>{ccr.approverName||"—"}</div>
                    </div>
                    {canApprove(ccr) && (
                      <button onClick={() => handleApprove(ccr.id)}
                        style={{ padding:"4px 12px", background:C.activity, border:"none", borderRadius:4,
                          color:"#0D2B1B", fontSize:11, fontWeight:700, cursor:"pointer", marginLeft:6 }}>
                        ✓ Approve
                      </button>
                    )}
                  </div>

                  {/* Reject button */}
                  {canReject(ccr) && ccr.status !== "approved" && ccr.status !== "rejected" && (
                    <button onClick={() => setRejectId(ccr.id)}
                      style={{ marginLeft:"auto", padding:"4px 12px", background:"none",
                        border:`1px solid ${C.risk}`, borderRadius:4,
                        color:C.risk, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                      ✕ Reject
                    </button>
                  )}

                  {/* Rejection reason */}
                  {ccr.status === "rejected" && ccr.rejectionReason && (
                    <div style={{ width:"100%", marginTop:6, fontSize:11, color:C.risk }}>
                      Rejected: {ccr.rejectionReason}
                    </div>
                  )}
                </div>

                {/* Reject form */}
                {isRejectOpen && (
                  <div style={{ marginTop:10, padding:"10px 12px", background:"rgba(224,92,92,0.08)",
                    border:`1px solid ${C.risk}`, borderRadius:6 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.risk, marginBottom:6 }}>Rejection Reason</div>
                    <textarea value={rejectReason} onChange={e=>setRejectReason(e.target.value)}
                      placeholder="Please provide a reason for rejecting this change..."
                      style={{ ...inp, resize:"vertical", minHeight:60, borderColor:C.risk }}/>
                    <div style={{ display:"flex", gap:8, marginTop:8 }}>
                      <button onClick={() => { setRejectId(null); setRejectReason(""); }}
                        style={{ flex:1, padding:"6px", background:"none", border:`1px solid ${C.border}`, borderRadius:4, color:C.muted, fontSize:11, cursor:"pointer" }}>
                        Cancel
                      </button>
                      <button onClick={() => handleReject(ccr.id)}
                        style={{ flex:2, padding:"6px", background:C.risk, border:"none", borderRadius:4, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MINOR CHANGES — auto-log */}
      {activeTab === "minor" && (
        <div>
          {minorChanges.length === 0 && (
            <div style={{ color:C.muted, fontSize:12, textAlign:"center", padding:40 }}>
              No minor updates logged yet. Progress updates and non-baseline edits will appear here automatically.
            </div>
          )}
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
            {minorChanges.length > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"100px 140px 1fr 120px", gap:8,
                padding:"7px 14px", background:C.surface2, borderBottom:`1px solid ${C.border}` }}>
                {["ID","Date / By","Description","Element"].map(h=>(
                  <div key={h} style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px" }}>{h}</div>
                ))}
              </div>
            )}
            {minorChanges.map((m,i)=>(
              <div key={m.id||i} style={{ display:"grid", gridTemplateColumns:"100px 140px 1fr 120px", gap:8,
                padding:"8px 14px", borderBottom:`1px solid ${C.border}`,
                background: i%2===0 ? C.surface : "transparent" }}>
                <div style={{ fontFamily:"monospace", fontSize:10, color:C.muted }}>{m.id}</div>
                <div>
                  <div style={{ fontSize:11, color:C.dim }}>{m.date}</div>
                  <div style={{ fontSize:10, color:C.muted }}>{m.requestedBy}</div>
                </div>
                <div style={{ fontSize:11, color:C.sage }}>{m.description}</div>
                <div style={{ fontSize:10, color:C.accentL }}>{m.elementId||"—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
