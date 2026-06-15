import { useState, useCallback } from "react";
import L3Home               from "./l3/L3Home.jsx";
import L3Dashboard          from "./l3/L3Dashboard.jsx";
import L3Tasks              from "./l3/L3Tasks.jsx";
import L3IntegratedBaseline from "./l3/L3IntegratedBaseline.jsx";
import L3RACI               from "./l3/L3RACI.jsx";
import L3Report             from "./l3/L3Report.jsx";
import L3ChangeControl      from "./l3/L3ChangeControl.jsx";
import CCRPopup             from "./l3/CCRPopup.jsx";
import L3Sustainability      from "./l3/L3Sustainability.jsx";
import SustainabilityPrompt  from "./l3/SustainabilityPrompt.jsx";
import {
  isBaselineField, describeChange, generateCCRId, generateMinorId,
  getApproverForChange, getReviewerForChange,
} from "../store/changeControl.js";

const C = {
  bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2",
};

const TABS = [
  { id:"home",      label:"Home",                 icon:"🏠" },
  { id:"dashboard", label:"Dashboard",            icon:"📊" },
  { id:"tasks",     label:"Tasks",                icon:"✅" },
  { id:"baseline",  label:"Integrated Baseline",  icon:"📅" },
  { id:"raci",      label:"RACI",                 icon:"📋" },
  { id:"change",    label:"Change Control",        icon:"🔄" },
  { id:"report",    label:"Report",               icon:"📄" },
  { id:"sustain",   label:"Sustainability",        icon:"🌿" },
];

export default function OperatingLayer({ state, member, onGoToL2, onMarkComplete, onStateChange, onLogout }) {
  const [activeTab,   setActiveTab]   = useState("home");
  const [ccrPending,  setCcrPending]  = useState(null); // pending CCR data for popup
  const [notification,setNotification]= useState(null); // approval notification banner

  const { l2, project } = state;
  const sheets     = l2?.sheets || {};
  const isPM       = member?.isPM;
  const loginCode  = member?.loginCode;

  // Derive live data
  const activities   = sheets["03"]?.data?.activities   || [];
  const milestones   = sheets["03"]?.data?.milestones   || [];
  const risks        = sheets["05"]?.data?.risks        || [];
  const deliverables = sheets["07"]?.data?.deliverables || [];
  const stakeholders = sheets["08"]?.data?.stakeholders || [];
  const teamMembers  = l2?.loginCodes                   || [];
  const raciData     = sheets["04"]?.data               || {};
  const charter      = sheets["01"]?.data?.charter      || state.l1?.charter || {};
  const approvers    = sheets["06"]?.data?.approvers    || [];
  const sustainConfig = sheets["10"]?.data              || {};
  const sustainData   = state.sustainData               || { evidence: [] };
  const changes      = sheets["06"]?.data?.changes      || [];

  // Auto-build RACI if empty
  const autoRaci = (() => {
    if ((raciData.raciRows||[]).length > 0) return raciData;
    const members = teamMembers.filter(m=>m.name&&m.role);
    const rows = [
      ...(activities||[]).map(a=>({ taskId:a._id, label:a.name||a._id, phase:a.phase, type:"activity", suggestedResponsible:a.responsible })),
      ...(milestones||[]).map(m=>({ taskId:m._id, label:m.name||m._id, phase:m.phase, type:"milestone", suggestedResponsible:"Project Manager" })),
    ].map(task => {
      const assignments = {};
      members.forEach(m => {
        if (m.role==="Project Manager") assignments[m.loginCode] = task.type==="milestone"?"A":"C";
        else if (task.suggestedResponsible && (m.role===task.suggestedResponsible||m.deliveryRole===task.suggestedResponsible)) assignments[m.loginCode]="R";
        else assignments[m.loginCode]="I";
      });
      return { ...task, assignments };
    });
    return { raciRows: rows, customRows: [] };
  })();

  // Count pending CCRs for badge
  const pendingForMe = changes.filter(c => {
    if (c.type !== "major") return false;
    if (c.status === "pending"  && c.reviewerCode  === loginCode) return true;
    if (c.status === "reviewed" && c.approverCode  === loginCode) return true;
    return false;
  }).length;

  // ── Save changes to Sheet 06 ─────────────────────────────────────────
  const saveChanges = useCallback((newChanges) => {
    onStateChange(prev => ({
      ...prev,
      l2: {
        ...prev.l2,
        sheets: {
          ...prev.l2.sheets,
          "06": {
            ...prev.l2.sheets["06"],
            data: { ...(prev.l2.sheets["06"]?.data||{}), changes: newChanges },
          },
        },
      },
    }));
  }, [onStateChange]);

  // ── Handle baseline field blur — trigger CCR popup ───────────────────
  const handleBaselineBlur = useCallback((elementType, elementId, fieldName, oldValue, newValue, elementName) => {
    if (String(oldValue) === String(newValue)) return; // no change
    if (!isBaselineField(elementType, fieldName)) {
      // Minor change — auto-log
      const newChanges = [...changes, {
        id: generateMinorId(changes),
        type: "minor",
        date: new Date().toLocaleDateString("en-GB"),
        requestedBy: member?.name || loginCode,
        description: describeChange(elementType, fieldName, oldValue, newValue),
        elementId, fieldName, oldValue, newValue,
      }];
      saveChanges(newChanges);
      return;
    }
    // Baseline change — show popup
    setCcrPending({
      elementType, elementId, fieldName, oldValue, newValue,
      elementName,
      description: describeChange(elementType, fieldName, oldValue, newValue),
      date: new Date().toLocaleDateString("en-GB"),
      requestedBy: member?.name || loginCode,
    });
  }, [changes, member, loginCode, saveChanges]);

  // ── Submit CCR ───────────────────────────────────────────────────────
  const handleCCRSubmit = useCallback(({ justification, priority, impacts }) => {
    if (!ccrPending) return;
    const reviewer = getReviewerForChange(approvers);
    const approver = getApproverForChange(impacts, approvers);
    const newCCR = {
      ...ccrPending,
      id: generateCCRId(changes),
      type: "major",
      justification,
      priority,
      impacts,
      status: "pending",
      reviewerCode: reviewer?.loginCode || "",
      reviewerName: reviewer?.name      || reviewer?.role || "",
      approverCode: approver?.loginCode || "",
      approverName: approver?.name      || approver?.role || "",
      proposedValue: ccrPending.newValue,
    };
    saveChanges([...changes, newCCR]);
    setCcrPending(null);
    setActiveTab("change");
  }, [ccrPending, changes, approvers, saveChanges]);

  // ── Log as minor ─────────────────────────────────────────────────────
  const handleCCRMinor = useCallback(() => {
    if (!ccrPending) return;
    const newChanges = [...changes, {
      id: generateMinorId(changes),
      type: "minor",
      date: ccrPending.date,
      requestedBy: ccrPending.requestedBy,
      description: ccrPending.description,
      elementId: ccrPending.elementId,
      fieldName: ccrPending.fieldName,
      oldValue: ccrPending.oldValue,
      newValue: ccrPending.newValue,
    }];
    saveChanges(newChanges);
    setCcrPending(null);
  }, [ccrPending, changes, saveChanges]);

  // ── Approve/Reject CCR ───────────────────────────────────────────────
  const handleApproveAction = useCallback((ccrId, newStatus, rejectionReason) => {
    const newChanges = changes.map(c => {
      if (c.id !== ccrId) return c;
      const updated = { ...c, status: newStatus };
      if (rejectionReason) updated.rejectionReason = rejectionReason;
      return updated;
    });
    saveChanges(newChanges);
    if (newStatus === "approved") {
      setNotification(`✓ Change ${ccrId} approved — ${changes.find(c=>c.id===ccrId)?.description||""}`);
      setTimeout(() => setNotification(null), 8000);
    } else if (newStatus === "rejected") {
      setNotification(`✕ Change ${ccrId} rejected — ${rejectionReason||""}`);
      setTimeout(() => setNotification(null), 6000);
    }
  }, [changes, saveChanges]);

  // ── Navigate to impacted element ────────────────────────────────────
  const handleNavigateToElement = useCallback((ccr, impact) => {
    if (impact === "Scope" || impact === "Cost") setActiveTab("home");
    else if (impact === "Time") setActiveTab("baseline");
    else setActiveTab("tasks");
  }, []);

  const handleSustainRecord = useCallback((ev) => {
    onStateChange(prev => ({
      ...prev,
      sustainData: {
        ...(prev.sustainData||{}),
        evidence: [...((prev.sustainData||{}).evidence||[]), { ...ev, date: new Date().toLocaleDateString("en-GB") }],
      },
    }));
  }, [onStateChange]);

  const sharedProps = {
    state, member, project, sheets, charter,
    activities, milestones, risks, deliverables, stakeholders,
    teamMembers, raciData: autoRaci, isPM, loginCodes: teamMembers,
    onMarkComplete, onGoToL2, onStateChange,
    onBaselineBlur: handleBaselineBlur,
    sustainConfig, onSustainRecord: handleSustainRecord,
  };

  const TabComponent = {
    home:      L3Home,
    dashboard: L3Dashboard,
    tasks:     L3Tasks,
    baseline:  L3IntegratedBaseline,
    raci:      L3RACI,
    report:    L3Report,
    change:    null,
  }[activeTab];

  const totalTasks = activities.length;
  const doneTasks  = activities.filter(a=>a._complete).length;
  const pct        = totalTasks > 0 ? Math.round((doneTasks/totalTasks)*100) : 0;

  return (
    <div style={{ background:C.bg, color:C.sage, minHeight:"100vh", display:"flex", flexDirection:"column",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", fontSize:13, overflow:"hidden" }}>

      {/* Top bar */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 20px",
        display:"flex", alignItems:"center", gap:12, height:48, flexShrink:0 }}>
        <div style={{ width:28, height:28, background:C.accent, borderRadius:6,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🏗️</div>
        <div style={{ fontSize:14, fontWeight:700, color:C.sage }}>NorCon Projects</div>
        {project?.name && (
          <>
            <div style={{ color:C.border, fontSize:16 }}>·</div>
            <div style={{ fontSize:12, color:C.dim }}>
              <span style={{ color:C.accentL, fontFamily:"monospace", marginRight:6 }}>{project.code}</span>
              {project.name}
            </div>
          </>
        )}
        {totalTasks > 0 && (
          <div style={{ background:"rgba(46,125,82,0.15)", border:`1px solid ${C.border}`, borderRadius:20,
            padding:"3px 10px", fontSize:11, color:C.accentL }}>
            {pct}% complete
          </div>
        )}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontFamily:"monospace", fontSize:11, color:C.accentL, background:"rgba(46,125,82,0.15)",
            padding:"3px 9px", borderRadius:5, border:`1px solid ${C.border}` }}>
            {member?.loginCode}
          </div>
          <div style={{ fontSize:11, color:C.muted }}>{member?.role}</div>
          {isPM && (
            <div style={{ display:"flex", gap:3, marginLeft:8 }}>
              {["L1","L2","L3"].map(l=>(
                <button key={l} onClick={()=>l==="L2"&&onGoToL2()}
                  style={{ padding:"3px 9px", fontSize:10, fontWeight:700, borderRadius:4,
                    border:`1px solid ${l==="L3"?C.accent:C.border}`,
                    background:l==="L3"?C.accent:"none",
                    color:l==="L3"?"#fff":C.muted,
                    cursor:l==="L2"?"pointer":"default" }}>
                  {l}
                </button>
              ))}
            </div>
          )}
          {onLogout && (
            <button onClick={onLogout}
              style={{ marginLeft:4, padding:"3px 10px", fontSize:10, fontWeight:600, borderRadius:4,
                border:`1px solid ${C.border}`, background:"none", color:C.muted, cursor:"pointer" }}>
              Log out
            </button>
          )}
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div style={{ padding:"8px 20px", background:"rgba(46,125,82,0.12)", borderBottom:`1px solid ${C.accent}`,
          fontSize:12, color:C.accentL, display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          {notification}
          <button onClick={()=>setNotification(null)}
            style={{ marginLeft:"auto", background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:14 }}>✕</button>
        </div>
      )}

      {/* Nav tabs */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex",
        padding:"0 20px", flexShrink:0, overflowX:"auto" }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            style={{ display:"flex", alignItems:"center", gap:5, padding:"0 12px", height:40,
              fontSize:11, fontWeight:600, background:"none", border:"none",
              borderBottom:`2px solid ${activeTab===tab.id?C.accentL:"transparent"}`,
              color:activeTab===tab.id?C.sage:C.muted,
              cursor:"pointer", whiteSpace:"nowrap", transition:"all .15s", position:"relative" }}>
            <span>{tab.icon}</span>
            {tab.label}
            {tab.id==="change" && pendingForMe>0 && (
              <span style={{ position:"absolute", top:6, right:4, width:14, height:14, borderRadius:"50%",
                background:C.risk, color:"#fff", fontSize:8, fontWeight:700,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                {pendingForMe}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow:"auto" }}>
        {activeTab === "change" ? (
          <L3ChangeControl
            changes={changes}
            approvers={approvers}
            member={member}
            onApproveAction={handleApproveAction}
            onNavigateToElement={handleNavigateToElement}/>
        ) : activeTab === "sustain" ? (
          <L3Sustainability state={state} sustainData={sustainData}/>
        ) : activeTab === "baseline" ? (
          <L3IntegratedBaseline
            activities={activities}
            milestones={milestones}
            raciData={autoRaci}
            project={project}
            loginCodes={teamMembers}
            member={member}
            onStateChange={onStateChange}/>
        ) : TabComponent ? (
          <TabComponent {...sharedProps}/>
        ) : null}
      </div>

      {/* CCR Popup */}
      {ccrPending && (
        <CCRPopup
          change={ccrPending}
          onSubmit={handleCCRSubmit}
          onMinor={handleCCRMinor}
          onCancel={()=>setCcrPending(null)}/>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
