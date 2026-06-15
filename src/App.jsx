import { useState, useCallback } from "react";
import LandingScreen            from "./layers/LandingScreen.jsx";
import DocumentIntelligenceLayer from "./DocumentIntelligenceLayer.jsx";
import ProjectSetup             from "./layers/ProjectSetup.jsx";
import PersonalisationLayer     from "./layers/PersonalisationLayer.jsx";
import OperationalLayer         from "./layers/OperationalLayer.jsx";
import { INITIAL_STATE }        from "./store/appStore.js";

const C = { bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c" };

export default function App() {
  const [screen,           setScreen]           = useState("landing"); // landing|L1|L2|L3
  const [state,            setState]            = useState(INITIAL_STATE);
  const [currentMember,    setCurrentMember]    = useState(null);
  const [extractionStatus, setExtractionStatus] = useState("idle");
  const [extractionMsg,    setExtractionMsg]    = useState("");

  // ── Save project to Redis ─────────────────────────────────────────────────
  const saveProject = useCallback(async (stateToSave) => {
    const code = stateToSave.project?.code;
    if (!code) return;
    try {
      await fetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectCode: code, state: stateToSave }),
      });
    } catch(e) { console.error("Save failed:", e); }
  }, []);

  // ── Landing handlers ──────────────────────────────────────────────────────
  const handleCreateProject = () => setScreen("L1");

  const handleLoginProject = (project, member) => {
    setState(project);
    setCurrentMember(member);
    setScreen("L3");
  };

  // ── L1 handlers ───────────────────────────────────────────────────────────
  const handleL1StartExtraction = useCallback(() => {
    setExtractionStatus("running");
    setExtractionMsg("Extracting project elements in the background...");
    setScreen("L2");
    setState(prev => ({ ...prev, activeLayer:"L2", l2:{ ...prev.l2, currentSheet:"setup" } }));
  }, []);

  const handleL1Complete = useCallback((charter, elements) => {
    setExtractionStatus("done");
    setExtractionMsg("✓ Extraction complete — registers populated");
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
    setTimeout(()=>setExtractionMsg(""), 6000);
  }, []);

  const handleL1Error = useCallback((msg) => {
    setExtractionStatus("error");
    setExtractionMsg("⚠ Extraction failed: " + msg);
  }, []);

  // ── L2 handlers ───────────────────────────────────────────────────────────
  const handleSetupComplete = useCallback(({ project, loginCodes }) => {
    const pmMember = loginCodes.find(lc => lc.role === "Project Manager");
    setCurrentMember(pmMember || loginCodes[0]);
    setState(prev => ({ ...prev, project, l2:{ ...prev.l2, loginCodes, currentSheet:"02" } }));
  }, []);

  const handleSheetUpdate = useCallback((sheetId, data, status) => {
    setState(prev => ({
      ...prev,
      l2: { ...prev.l2, sheets: { ...prev.l2.sheets, [sheetId]:{ ...prev.l2.sheets[sheetId], data, status:status||prev.l2.sheets[sheetId].status } } },
    }));
  }, []);

  const handleSheetApprove = useCallback((sheetId) => {
    setState(prev => ({
      ...prev,
      l2: { ...prev.l2, sheets: { ...prev.l2.sheets, [sheetId]:{ ...prev.l2.sheets[sheetId], locked:true, status:"approved" } } },
    }));
  }, []);

  const handleSheetUnlock = useCallback((sheetId) => {
    setState(prev => ({
      ...prev,
      l2: { ...prev.l2, sheets: { ...prev.l2.sheets, [sheetId]:{ ...prev.l2.sheets[sheetId], locked:false, status:"in-progress" } } },
    }));
  }, []);

  const handleSheetNav = useCallback((sheetId) => {
    setState(prev => ({ ...prev, l2:{ ...prev.l2, currentSheet:sheetId } }));
  }, []);

  const handleGoToL3 = useCallback(() => {
    const newState = { ...state };
    saveProject(newState);
    setScreen("L3");
  }, [state, saveProject]);

  // ── L3 handlers ───────────────────────────────────────────────────────────
  const handleMarkComplete = useCallback((activityId) => {
    setState(prev => {
      const acts = prev.l2?.sheets?.["03"]?.data?.activities || [];
      const updated = acts.map(a => a._id===activityId ? {...a, status:"complete"} : a);
      const newState = {
        ...prev,
        l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
          "03": { ...prev.l2.sheets["03"], data:{ ...prev.l2.sheets["03"].data, activities:updated } }
        }}
      };
      saveProject(newState);
      return newState;
    });
  }, [saveProject]);

  const handleSaveProject = useCallback(() => {
    saveProject(state);
  }, [state, saveProject]);

  const handleGoToL2 = () => {
    setState(prev => ({ ...prev, l2:{ ...prev.l2, currentSheet:"01" } }));
    setScreen("L2");
  };

  // ── Top bar (shown on L1/L2/L3, not landing) ─────────────────────────────
  const showTopBar = screen !== "landing";
  const approvedCount = Object.values(state.l2?.sheets||{}).filter(s=>s.locked).length;

  return (
    <div style={{ background:C.bg, color:C.sage, minHeight:"100vh", display:"flex", flexDirection:"column", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", fontSize:13, overflow:"hidden" }}>

      {/* Top bar */}
      {showTopBar && (
        <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 20px", display:"flex", alignItems:"center", gap:12, height:48, flexShrink:0 }}>
          <div style={{ width:28, height:28, background:C.accent, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0, cursor:"pointer" }}
            onClick={()=>setScreen("landing")}>🏗️</div>
          <div style={{ fontSize:14, fontWeight:700, color:C.sage }}>NorCon Projects</div>
          {state.project?.name && (
            <>
              <div style={{ color:C.border, fontSize:16 }}>·</div>
              <div style={{ fontSize:12, color:C.dim }}>
                {state.project.code && <span style={{ color:C.accentL, marginRight:6, fontFamily:"monospace" }}>{state.project.code}</span>}
                {state.project.name}
              </div>
            </>
          )}
          {currentMember && (
            <div style={{ fontSize:11, color:C.muted, marginLeft:8, display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontFamily:"monospace", color:C.accentL, background:"rgba(46,125,82,0.12)", padding:"2px 8px", borderRadius:4, border:`1px solid ${C.border}` }}>{currentMember.loginCode}</span>
              <span>{currentMember.role}</span>
            </div>
          )}
          {/* Layer switcher */}
          <div style={{ marginLeft:"auto", display:"flex", gap:4 }}>
            {[
              { id:"L1", label:"L1 · Intelligence", available:true },
              { id:"L2", label:"L2 · Personalisation", available:state.l1?.complete || screen==="L2" },
              { id:"L3", label:"L3 · Operational", available:state.l2?.loginCodes?.length>0 },
            ].map(({ id, label, available }) => {
              const active = screen===id || (screen==="L2" && state.l2?.currentSheet==="setup" && id==="L2");
              const actuallyActive = (screen==="L1"&&id==="L1")||(screen==="L2"&&id==="L2")||(screen==="L3"&&id==="L3");
              return (
                <button key={id} disabled={!available}
                  onClick={()=>{
                    if(!available) return;
                    if(id==="L1") setScreen("L1");
                    if(id==="L2") setScreen("L2");
                    if(id==="L3") handleGoToL3();
                  }}
                  style={{ padding:"5px 12px", fontSize:11, fontWeight:700, borderRadius:5,
                    border:`1px solid ${actuallyActive?C.accent:C.border}`,
                    background: actuallyActive?C.accent:"none",
                    color: actuallyActive?"#fff":available?C.dim:C.muted,
                    cursor: available?"pointer":"not-allowed", opacity:available?1:.4 }}>
                  {label}
                  {id==="L2"&&approvedCount>0&&<span style={{marginLeft:5,background:C.accentL,color:"#fff",fontSize:9,padding:"1px 5px",borderRadius:10}}>{approvedCount}/9</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Extraction progress bar */}
      {extractionStatus!=="idle" && screen==="L2" && (
        <div style={{ flexShrink:0 }}>
          <div style={{ height:3, background:"#1F4D34" }}>
            <div style={{ height:"100%", background:extractionStatus==="done"?C.activity:extractionStatus==="error"?C.risk:C.accent, width:extractionStatus==="running"?"85%":"100%", transition:extractionStatus==="running"?"width 45s cubic-bezier(0.1,0,0.2,1)":"width 0.4s ease" }}/>
          </div>
          <div style={{ padding:"5px 20px", background:extractionStatus==="done"?"rgba(58,224,162,0.08)":extractionStatus==="error"?"rgba(224,92,92,0.08)":"rgba(46,125,82,0.08)", borderBottom:`1px solid ${C.border}`, fontSize:11, fontWeight:600, color:extractionStatus==="done"?C.activity:extractionStatus==="error"?C.risk:C.dim, display:"flex", alignItems:"center", gap:8 }}>
            {extractionStatus==="running"&&<div style={{width:8,height:8,borderRadius:"50%",background:"#2E7D52",animation:"pulse 1.2s ease-in-out infinite"}}/>}
            {extractionStatus==="done"&&"✓"}
            {extractionStatus==="error"&&"⚠"}
            {extractionMsg}
          </div>
        </div>
      )}

      {/* Screens */}
      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        {screen==="landing" && (
          <LandingScreen onCreateProject={handleCreateProject} onLoginProject={handleLoginProject}/>
        )}
        {screen==="L1" && (
          <DocumentIntelligenceLayer
            onStartExtraction={handleL1StartExtraction}
            onSendToPersonalisation={handleL1Complete}
            onExtractionError={handleL1Error}/>
        )}
        {screen==="L2" && state.l2?.currentSheet==="setup" && (
          <ProjectSetup project={state.project} l1Charter={state.l1?.charter} onComplete={handleSetupComplete}/>
        )}
        {screen==="L2" && state.l2?.currentSheet!=="setup" && (
          <PersonalisationLayer
            state={state}
            onSheetUpdate={handleSheetUpdate}
            onSheetApprove={handleSheetApprove}
            onSheetUnlock={handleSheetUnlock}
            onSheetNav={handleSheetNav}
            onGoToL3={handleGoToL3}/>
        )}
        {screen==="L3" && (
          <OperationalLayer
            state={state}
            member={currentMember}
            onGoToL2={handleGoToL2}
            onGoToL1={()=>setScreen("L1")}
            onMarkComplete={handleMarkComplete}
            onSaveProject={handleSaveProject}/>
        )}
      </div>

      <style>{`
        @keyframes spin  { to { transform:rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1.2)} }
      `}</style>
    </div>
  );
}
