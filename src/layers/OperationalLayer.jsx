import { useState } from "react";
import HomeTab      from "./operational/HomeTab.jsx";
import DashboardTab from "./operational/DashboardTab.jsx";
import TasksTab     from "./operational/TasksTab.jsx";
import GanttTab     from "./operational/GanttTab.jsx";
import RACITab      from "./operational/RACITab.jsx";
import ReportTab    from "./operational/ReportTab.jsx";

const C = { bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c" };

const TABS = [
  { id:"home",      label:"Home",      icon:"ti-home"            },
  { id:"dashboard", label:"Dashboard", icon:"ti-layout-dashboard" },
  { id:"tasks",     label:"Tasks",     icon:"ti-checklist"       },
  { id:"gantt",     label:"Gantt",     icon:"ti-chart-gantt"     },
  { id:"raci",      label:"RACI",      icon:"ti-table"           },
  { id:"report",    label:"Report",    icon:"ti-file-analytics"  },
];

export default function OperationalLayer({ state, member, onGoToL2, onGoToL1, onMarkComplete, onSaveProject }) {
  const [tab, setTab] = useState("home");
  const proj = state.project || {};

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden" }}>

      {/* Nav bar */}
      <div style={{ background:C.surface2, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"stretch", padding:"0 16px", flexShrink:0, overflowX:"auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"0 14px", height:40,
              fontSize:11, fontWeight:700, color: tab===t.id ? C.sage : C.muted,
              background:"none", border:"none", cursor:"pointer",
              borderBottom: tab===t.id ? `2px solid ${C.accentL}` : "2px solid transparent",
              whiteSpace:"nowrap", transition:"color .15s" }}>
            <i className={`ti ${t.icon}`} aria-hidden="true" style={{ fontSize:14 }}/>
            {t.label}
          </button>
        ))}
        {/* Save button */}
        <button onClick={onSaveProject}
          style={{ marginLeft:"auto", padding:"0 14px", fontSize:11, fontWeight:700,
            color:C.accentL, background:"none", border:"none", cursor:"pointer",
            display:"flex", alignItems:"center", gap:5 }}>
          <i className="ti ti-device-floppy" aria-hidden="true" style={{fontSize:14}}/>
          Save
        </button>
      </div>

      {/* Tab content */}
      <div style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden" }}>
        {tab==="home"      && <HomeTab      state={state} member={member} onGoToL2={onGoToL2}/>}
        {tab==="dashboard" && <DashboardTab state={state}/>}
        {tab==="tasks"     && <TasksTab     state={state} member={member} onMarkComplete={onMarkComplete}/>}
        {tab==="gantt"     && <GanttTab     state={state} member={member}/>}
        {tab==="raci"      && <RACITab      state={state} member={member} onMarkComplete={onMarkComplete}/>}
        {tab==="report"    && <ReportTab    state={state}/>}
      </div>
    </div>
  );
}
