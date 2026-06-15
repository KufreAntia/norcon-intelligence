import { useState } from "react";
import L3Home       from "./l3/L3Home.jsx";
import L3Dashboard  from "./l3/L3Dashboard.jsx";
import L3Tasks      from "./l3/L3Tasks.jsx";
import L3Gantt      from "./l3/L3Gantt.jsx";
import L3RACI       from "./l3/L3RACI.jsx";
import L3Report     from "./l3/L3Report.jsx";

const C = {
  bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66",
};

const TABS = [
  { id:"home",      label:"Home",      icon:"ti-home"             },
  { id:"dashboard", label:"Dashboard", icon:"ti-layout-dashboard" },
  { id:"tasks",     label:"Tasks",     icon:"ti-checklist"        },
  { id:"gantt",     label:"Gantt",     icon:"ti-chart-gantt"      },
  { id:"raci",      label:"RACI",      icon:"ti-table"            },
  { id:"report",    label:"Report",    icon:"ti-file-analytics"   },
];

export default function OperatingLayer({ state, member, onGoToL2, onMarkComplete, onStateChange, onLogout }) {
  const [activeTab, setActiveTab] = useState("home");

  const project  = state.project  || {};
  const sheets   = state.l2?.sheets || {};
  const isPM     = member?.isPM;

  // Derive live data from L2 sheets
  const activities   = sheets["03"]?.data?.activities   || [];
  const milestones   = sheets["03"]?.data?.milestones   || [];
  const risks        = sheets["05"]?.data?.risks        || [];
  const deliverables = sheets["07"]?.data?.deliverables || [];
  const stakeholders = sheets["08"]?.data?.stakeholders || [];
  const teamMembers  = state.l2?.loginCodes             || [];
  const raciData     = sheets["04"]?.data               || {};
  const charter      = sheets["01"]?.data?.charter      || state.l1?.charter || {};

  // Auto-build RACI from schedule if sheet 04 is empty
  const autoRaci = (() => {
    const r = raciData;
    if ((r.raciRows||[]).length > 0 || (r.customRows||[]).length > 0) return r;
    // Build from schedule
    const members = state.l2?.loginCodes?.filter(m=>m.name&&m.role) || [];
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

  const sharedProps = {
    state, member, project, sheets, charter,
    activities, milestones, risks, deliverables, stakeholders,
    teamMembers, raciData: autoRaci, isPM,
    onMarkComplete, onGoToL2, onStateChange,
  };

  const TabComponent = {
    home:      L3Home,
    dashboard: L3Dashboard,
    tasks:     L3Tasks,
    gantt:     L3Gantt,
    raci:      L3RACI,
    report:    L3Report,
  }[activeTab];

  // Completion stats for dashboard badge
  const totalTasks    = activities.length;
  const doneTasks     = activities.filter(a => a._complete).length;
  const pct           = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div style={{
      background:C.bg, color:C.sage, minHeight:"100vh", display:"flex",
      flexDirection:"column", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      fontSize:13, overflow:"hidden",
    }}>

      {/* Top bar */}
      <div style={{
        background:C.surface, borderBottom:`1px solid ${C.border}`,
        padding:"0 20px", display:"flex", alignItems:"center", gap:12,
        height:48, flexShrink:0,
      }}>
        <div style={{ width:28, height:28, background:C.accent, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🏗️</div>
        <div style={{ fontSize:14, fontWeight:700, color:C.sage }}>NorCon Projects</div>
        {project.name && (
          <>
            <div style={{ color:C.border, fontSize:16 }}>·</div>
            <div style={{ fontSize:12, color:C.dim }}>
              <span style={{ color:C.accentL, fontFamily:"monospace", marginRight:6 }}>{project.code}</span>
              {project.name}
            </div>
          </>
        )}
        {/* Progress pill */}
        {totalTasks > 0 && (
          <div style={{ background:"rgba(46,125,82,0.15)", border:`1px solid ${C.border}`, borderRadius:20, padding:"3px 10px", fontSize:11, color:C.accentL }}>
            {pct}% complete
          </div>
        )}
        {/* User */}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontFamily:"monospace", fontSize:11, color:C.accentL, background:"rgba(46,125,82,0.15)", padding:"3px 9px", borderRadius:5, border:`1px solid ${C.border}` }}>
            {member?.loginCode}
          </div>
          <div style={{ fontSize:11, color:C.muted }}>{member?.role}</div>
          {/* Layer tabs — PM only */}
          {isPM && (
            <div style={{ display:"flex", gap:3, marginLeft:8 }}>
              {["L1","L2","L3"].map(l => (
                <button key={l} onClick={() => l==="L2" && onGoToL2()}
                  style={{ padding:"3px 9px", fontSize:10, fontWeight:700, borderRadius:4, border:`1px solid ${l==="L3"?C.accent:C.border}`, background:l==="L3"?C.accent:"none", color:l==="L3"?"#fff":C.muted, cursor:l==="L2"?"pointer":"default" }}>
                  {l}
                </button>
              ))}
            </div>
          )}
          {onLogout && (
            <button onClick={onLogout}
              style={{ marginLeft:8, padding:"3px 10px", fontSize:10, fontWeight:600, borderRadius:4, border:`1px solid ${C.border}`, background:"none", color:C.muted, cursor:"pointer" }}>
              Log out
            </button>
          )}
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex", padding:"0 20px", flexShrink:0, overflowX:"auto" }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              display:"flex", alignItems:"center", gap:6, padding:"0 14px", height:40,
              fontSize:12, fontWeight:600, background:"none", border:"none",
              borderBottom:`2px solid ${activeTab===tab.id ? C.accentL : "transparent"}`,
              color: activeTab===tab.id ? C.sage : C.muted,
              cursor:"pointer", whiteSpace:"nowrap", transition:"all .15s",
            }}>
            <i className={`ti ${tab.icon}`} style={{ fontSize:14 }} aria-hidden="true"/>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow:"auto" }}>
        {TabComponent && <TabComponent {...sharedProps}/>}
      </div>
    </div>
  );
}
