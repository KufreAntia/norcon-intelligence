import { useState, useCallback, useEffect, useRef } from "react";
import DocumentIntelligenceLayer from "./DocumentIntelligenceLayer.jsx";
import ProjectSetup              from "./layers/ProjectSetup.jsx";
import PersonalisationLayer      from "./layers/PersonalisationLayer.jsx";
import OperatingLayer            from "./layers/OperatingLayer.jsx";
import LandingScreen             from "./layers/LandingScreen.jsx";
import { INITIAL_STATE }         from "./store/appStore.js";
import { useProjectPersistence } from "./store/useProjectPersistence.js";

const C = { bg:"#0D2B1B", surface:"#122E1E", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c" };

export default function App() {
  const [screen, setScreen]                 = useState("landing"); // landing|app
  const [state,  setState]                  = useState(INITIAL_STATE);
  const [member, setMember]                 = useState(null);
  const [extractionStatus, setExtStatus]    = useState("idle");
  const [extractionMsg,    setExtMsg]       = useState("");
  const { saveState, authenticate }         = useProjectPersistence();
  const saveTimer                           = useRef(null);

  // Auto-save whenever state changes and we have a project code
  useEffect(() => {
    const code = state.project?.code;
    if (!code || screen !== "app") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveState(code, state);
    }, 2000);
  }, [state, screen]);

  // ── Auth handlers ──────────────────────────────────────────────────────
  const handleCreateNew = useCallback(() => {
    setState(INITIAL_STATE);
    setMember(null);
    setScreen("app");
  }, []);

  const handleLogin = useCallback(async (projectCode, memberCode) => {
    const result = await authenticate(projectCode, memberCode);
    setState(result.state);
    setMember(result.member);
    setScreen("app");
    // Set active layer to L3 for team members
    setState(prev => ({ ...prev, activeLayer: "L3" }));
  }, [authenticate]);

  // ── Layer 1 handlers ───────────────────────────────────────────────────
  const handleL1Start = useCallback(() => {
    setExtStatus("running");
    setExtMsg("Extracting project elements in the background...");
    setState(prev => ({ ...prev, activeLayer:"L2", l1:{...prev.l1, complete:false}, l2:{...prev.l2, currentSheet:"setup"} }));
  }, []);

  const handleL1Complete = useCallback((charter, elements) => {
    setExtStatus("done");
    setExtMsg("✓ Extraction complete — registers populated");
    setState(prev => ({
      ...prev,
      l1: { charter, elements, complete:true },
      l2: {
        ...prev.l2,
        sheets: {
          ...prev.l2.sheets,
          "01": { status:"ai-draft", locked:false, data:{ charter } },
          "03": { status: elements.filter(e=>e.type==="activity"||e.type==="milestone").length>0?"ai-draft":"empty", locked:false, data:{ activities:elements.filter(e=>e.type==="activity"), milestones:elements.filter(e=>e.type==="milestone") } },
          "05": { status: elements.filter(e=>e.type==="risk").length>0?"ai-draft":"empty", locked:false, data:{ risks:elements.filter(e=>e.type==="risk") } },
          "07": { status: elements.filter(e=>e.type==="deliverable").length>0?"ai-draft":"empty", locked:false, data:{ deliverables:elements.filter(e=>e.type==="deliverable") } },
          "08": { status: elements.filter(e=>e.type==="stakeholder").length>0?"ai-draft":"empty", locked:false, data:{ stakeholders:elements.filter(e=>e.type==="stakeholder") } },
        },
      },
    }));
    setTimeout(() => setExtMsg(""), 6000);
  }, []);

  const handleL1Error = useCallback((msg) => {
    setExtStatus("error");
    setExtMsg("⚠ Extraction failed: " + msg);
  }, []);

  // ── Layer 2 handlers ───────────────────────────────────────────────────
  const handleSetupComplete = useCallback(({ project, loginCodes }) => {
    setState(prev => ({ ...prev, project, l2:{ ...prev.l2, loginCodes, currentSheet:"02" } }));
  }, []);

  const handleSheetUpdate = useCallback((sheetId, data, status) => {
    setState(prev => ({
      ...prev,
      l2: { ...prev.l2, sheets: { ...prev.l2.sheets, [sheetId]:{ ...prev.l2.sheets[sheetId], data, status: status||prev.l2.sheets[sheetId].status } } },
    }));
  }, []);

  const handleSheetApprove = useCallback((sheetId) => {
    setState(prev => ({ ...prev, l2:{ ...prev.l2, sheets:{ ...prev.l2.sheets, [sheetId]:{ ...prev.l2.sheets[sheetId], locked:true, status:"approved" } } } }));
  }, []);

  const handleSheetUnlock = useCallback((sheetId) => {
    setState(prev => ({ ...prev, l2:{ ...prev.l2, sheets:{ ...prev.l2.sheets, [sheetId]:{ ...prev.l2.sheets[sheetId], locked:false, status:"in-progress" } } } }));
  }, []);

  const handleSheetNav = useCallback((sheetId) => {
    setState(prev => ({ ...prev, l2:{ ...prev.l2, currentSheet:sheetId } }));
  }, []);

  // ── Layer 3 handlers ───────────────────────────────────────────────────
  const handleMarkComplete = useCallback((taskId, itemType, complete=true) => {
    setState(prev => {
      const sheet   = "03";
      const sheetData = prev.l2.sheets[sheet]?.data || {};
      // Try both activities and milestones — taskId might be in either
      const tryUpdate = (key) => {
        const items = sheetData[key] || [];
        const idx   = items.findIndex(a => a._id === taskId || a.taskId === taskId);
        if (idx === -1) return null;
        return items.map((a,i) => i === idx ? { ...a, _complete: complete } : a);
      };
      const updatedActivities  = tryUpdate("activities");
      const updatedMilestones  = tryUpdate("milestones");
      const newData = {
        ...sheetData,
        ...(updatedActivities  ? { activities:  updatedActivities  } : {}),
        ...(updatedMilestones  ? { milestones:  updatedMilestones  } : {}),
      };
      return {
        ...prev,
        l2: {
          ...prev.l2,
          sheets: {
            ...prev.l2.sheets,
            [sheet]: { ...prev.l2.sheets[sheet], data: newData },
          },
        },
      };
    });
  }, []);

  const handleGoToL2 = useCallback(() => {
    setState(prev => ({ ...prev, activeLayer:"L2", l2:{ ...prev.l2, currentSheet:"01" } }));
  }, []);

  const handleGoToL3 = useCallback(() => {
    setState(prev => ({ ...prev, activeLayer:"L3" }));
  }, []);

  const handleLaunch = useCallback(() => {
    // Save then go to L3
    const code = state.project?.code;
    if (code) {
      fetch('/api/state', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ code, state }),
      });
    }
    setState(prev => ({ ...prev, activeLayer:"L3" }));
  }, [state]);

  const handleLogout = useCallback(() => {
    setState(INITIAL_STATE);
    setMember(null);
    setExtStatus("idle");
    setExtMsg("");
    setScreen("landing");
  }, []);

  const setLayer = useCallback((layer) => {
    setState(prev => ({ ...prev, activeLayer:layer }));
  }, []);

  // ── Landing screen ─────────────────────────────────────────────────────
  if (screen === "landing") {
    return <LandingScreen onCreateNew={handleCreateNew} onLogin={handleLogin}/>;
  }

  // ── App ────────────────────────────────────────────────────────────────
  const approvedCount = Object.values(state.l2.sheets).filter(s => s.locked).length;
  const l3Unlocked    = approvedCount > 0 && state.l2.loginCodes.length > 0;

  return (
    <div style={{ background:C.bg, color:C.sage, minHeight:"100vh", display:"flex", flexDirection:"column",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", fontSize:13 }}>

      {/* Layer 3 — full screen, has own top bar */}
      {state.activeLayer === "L3" && (
        <OperatingLayer
          state={state} member={member || { isPM:true, role:"Project Manager", loginCode:"PM", name:"Project Manager" }}
          onGoToL2={handleGoToL2}
          onMarkComplete={handleMarkComplete}
          onStateChange={setState}
          onLogout={handleLogout}/>
      )}

      {/* Layers 1 & 2 — shared top bar */}
      {state.activeLayer !== "L3" && (
        <>
          {/* Top bar */}
          <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 20px", display:"flex", alignItems:"center", gap:12, height:48, flexShrink:0 }}>
            <div style={{ width:28, height:28, background:C.accent, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🏗️</div>
            <div style={{ fontSize:14, fontWeight:700, color:C.sage }}>NorCon Projects</div>
            {state.project.name && (
              <><div style={{ color:C.border, fontSize:16 }}>·</div>
              <div style={{ fontSize:12, color:C.dim }}><span style={{ color:C.accentL, fontFamily:"monospace", marginRight:6 }}>{state.project.code}</span>{state.project.name}</div></>
            )}
            <div style={{ marginLeft:"auto", display:"flex", gap:4 }}>
              {[{id:"L1",label:"L1 · Intelligence",avail:true},{id:"L2",label:"L2 · Personalisation",avail:state.l1.complete},{id:"L3",label:"L3 · Operational",avail:l3Unlocked}].map(({id,label,avail})=>{
                const active = state.activeLayer === id;
                return (
                  <button key={id} onClick={() => avail && (id==="L3" ? handleGoToL3() : setLayer(id))} disabled={!avail}
                    style={{ padding:"5px 12px", fontSize:11, fontWeight:700, borderRadius:5, border:`1px solid ${active?C.accent:C.border}`, background:active?C.accent:"none", color:active?"#fff":avail?C.dim:C.muted, cursor:avail?"pointer":"not-allowed", opacity:avail?1:.4 }}>
                    {label}
                    {id==="L2" && approvedCount>0 && <span style={{ marginLeft:5, background:C.accentL, color:"#fff", fontSize:9, padding:"1px 5px", borderRadius:10 }}>{approvedCount}/9</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Extraction progress bar */}
          {extractionStatus !== "idle" && extractionMsg && (
            <div style={{ flexShrink:0 }}>
              <div style={{ height:3, background:"#1F4D34" }}>
                <div style={{ height:"100%", background:extractionStatus==="done"?"#3ae0a2":extractionStatus==="error"?"#e05c5c":"#2E7D52", width:extractionStatus==="running"?"85%":"100%", transition:extractionStatus==="running"?"width 45s cubic-bezier(0.1,0,0.2,1)":"width .4s ease" }}/>
              </div>
              <div style={{ padding:"5px 20px", background:extractionStatus==="done"?"rgba(58,224,162,0.08)":extractionStatus==="error"?"rgba(224,92,92,0.08)":"rgba(46,125,82,0.08)", borderBottom:`1px solid ${C.border}`, fontSize:11, fontWeight:600, color:extractionStatus==="done"?"#3ae0a2":extractionStatus==="error"?C.risk:C.dim, display:"flex", alignItems:"center", gap:8 }}>
                {extractionStatus==="running" && <div style={{ width:8, height:8, borderRadius:"50%", background:"#2E7D52", animation:"pulse 1.2s ease-in-out infinite" }}/>}
                {extractionStatus==="done"    && "✓"}
                {extractionStatus==="error"   && "⚠"}
                {extractionMsg}
              </div>
            </div>
          )}

          {/* Content */}
          <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
            {state.activeLayer === "L1" && (
              <DocumentIntelligenceLayer onStartExtraction={handleL1Start} onSendToPersonalisation={handleL1Complete} onExtractionError={handleL1Error}/>
            )}
            {state.activeLayer === "L2" && state.l2.currentSheet === "setup" && (
              <ProjectSetup project={state.project} l1Charter={state.l1.charter} onComplete={handleSetupComplete}/>
            )}
            {state.activeLayer === "L2" && state.l2.currentSheet !== "setup" && (
              <PersonalisationLayer state={state} onSheetUpdate={handleSheetUpdate} onSheetApprove={handleSheetApprove} onSheetUnlock={handleSheetUnlock} onSheetNav={handleSheetNav} onLaunch={handleLaunch} onLogout={handleLogout}/>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes spin  { to { transform:rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)} }
      `}</style>
    </div>
  );
}
