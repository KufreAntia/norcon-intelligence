import { useState, useCallback } from "react";
import DocumentIntelligenceLayer from "./DocumentIntelligenceLayer.jsx";
import ProjectSetup from "./layers/ProjectSetup.jsx";
import PersonalisationLayer from "./layers/PersonalisationLayer.jsx";
import { INITIAL_STATE } from "./store/appStore.js";

const C = {
  bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66",
};

export default function App() {
  const [state, setState] = useState(INITIAL_STATE);
  const [extractionStatus, setExtractionStatus] = useState('idle'); // 'idle'|'running'|'done'|'error'
  const [extractionMsg,    setExtractionMsg]    = useState('');

  const setLayer = (layer) => {
    if (layer === 'L2' && !state.l1.complete) return;
    if (layer === 'L3' && !state.l2.loginCodes.length) return;
    setState(prev => ({ ...prev, activeLayer: layer }));
  };

  // Called immediately when PM clicks Extract — moves to setup right away
  const handleL1StartExtraction = useCallback(() => {
    setExtractionStatus('running');
    setExtractionMsg('Extracting project elements in the background...');
    setState(prev => ({
      ...prev,
      activeLayer: 'L2',
      l1: { ...prev.l1, complete: false },
      l2: { ...prev.l2, currentSheet: 'setup' },
    }));
  }, []);

  // Called when extraction finishes in the background
  const handleL1Complete = useCallback((charter, elements) => {
    setExtractionStatus('done');
    setExtractionMsg('✓ Extraction complete — registers populated');
    setState(prev => ({
      ...prev,
      l1: { charter, elements, complete: true },
      l2: {
        ...prev.l2,
        sheets: {
          ...prev.l2.sheets,
          '01': { status:'ai-draft', locked:false, data:{ charter } },
          '03': { status: elements.filter(e=>e.type==='activity'||e.type==='milestone').length>0 ? 'ai-draft':'empty', locked:false, data:{ activities:elements.filter(e=>e.type==='activity'), milestones:elements.filter(e=>e.type==='milestone') } },
          '05': { status: elements.filter(e=>e.type==='risk').length>0 ? 'ai-draft':'empty', locked:false, data:{ risks:elements.filter(e=>e.type==='risk') } },
          '07': { status: elements.filter(e=>e.type==='deliverable').length>0 ? 'ai-draft':'empty', locked:false, data:{ deliverables:elements.filter(e=>e.type==='deliverable') } },
          '08': { status: elements.filter(e=>e.type==='stakeholder').length>0 ? 'ai-draft':'empty', locked:false, data:{ stakeholders:elements.filter(e=>e.type==='stakeholder') } },
        },
      },
    }));
    // Clear notification after 6 seconds
    setTimeout(() => setExtractionMsg(''), 6000);
  }, []);

  const handleL1Error = useCallback((msg) => {
    setExtractionStatus('error');
    setExtractionMsg('⚠ Extraction failed: ' + msg);
  }, []);

  const handleSetupComplete = useCallback(({ project, loginCodes }) => {
    setState(prev => ({
      ...prev,
      project,
      l2: { ...prev.l2, loginCodes, currentSheet: '02' },
    }));
  }, []);

  const handleSheetUpdate = useCallback((sheetId, data, status) => {
    setState(prev => ({
      ...prev,
      l2: {
        ...prev.l2,
        sheets: {
          ...prev.l2.sheets,
          [sheetId]: { ...prev.l2.sheets[sheetId], data, status: status || prev.l2.sheets[sheetId].status },
        },
      },
    }));
  }, []);

  const handleSheetApprove = useCallback((sheetId) => {
    setState(prev => ({
      ...prev,
      l2: {
        ...prev.l2,
        sheets: {
          ...prev.l2.sheets,
          [sheetId]: { ...prev.l2.sheets[sheetId], locked:true, status:'approved' },
        },
      },
    }));
  }, []);

  const handleSheetUnlock = useCallback((sheetId) => {
    setState(prev => ({
      ...prev,
      l2: {
        ...prev.l2,
        sheets: {
          ...prev.l2.sheets,
          [sheetId]: { ...prev.l2.sheets[sheetId], locked:false, status:'in-progress' },
        },
      },
    }));
  }, []);

  const handleSheetNav = useCallback((sheetId) => {
    setState(prev => ({ ...prev, l2: { ...prev.l2, currentSheet: sheetId } }));
  }, []);

  const approvedCount = Object.values(state.l2.sheets).filter(s => s.locked).length;
  const l3Unlocked    = approvedCount > 0 && state.l2.loginCodes.length > 0;

  return (
    <div style={{ background:C.bg, color:C.sage, minHeight:"100vh", display:"flex",
      flexDirection:"column", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", fontSize:13 }}>

      {/* Top bar */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`,
        padding:"0 20px", display:"flex", alignItems:"center", gap:12, height:48, flexShrink:0 }}>
        <div style={{ width:28, height:28, background:C.accent, borderRadius:6,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🏗️</div>
        <div style={{ fontSize:14, fontWeight:700, color:C.sage }}>NorCon Projects</div>
        {state.project.name && (
          <>
            <div style={{ color:C.border, fontSize:16 }}>·</div>
            <div style={{ fontSize:12, color:C.dim }}>
              {state.project.code && <span style={{ color:C.accentL, marginRight:6, fontFamily:"monospace" }}>{state.project.code}</span>}
              {state.project.name}
            </div>
          </>
        )}
        <div style={{ marginLeft:"auto", display:"flex", gap:4 }}>
          {[
            { id:'L1', label:'L1 · Intelligence',    available:true },
            { id:'L2', label:'L2 · Personalisation', available:state.l1.complete },
            { id:'L3', label:'L3 · Operational',     available:l3Unlocked },
          ].map(({ id, label, available }) => {
            const active = state.activeLayer === id;
            return (
              <button key={id} onClick={() => setLayer(id)} disabled={!available}
                style={{ padding:"5px 12px", fontSize:11, fontWeight:700, borderRadius:5,
                  border:`1px solid ${active ? C.accent : C.border}`,
                  background: active ? C.accent : "none",
                  color: active ? "#fff" : available ? C.dim : C.muted,
                  cursor: available ? "pointer" : "not-allowed",
                  opacity: available ? 1 : 0.4, transition:"all .2s" }}>
                {label}
                {id==='L2' && approvedCount>0 && (
                  <span style={{ marginLeft:5, background:C.accentL, color:"#fff",
                    fontSize:9, padding:"1px 5px", borderRadius:10 }}>{approvedCount}/9</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Extraction progress bar */}
      {extractionStatus !== 'idle' && (
        <div style={{ flexShrink:0, position:"relative" }}>
          {/* Track */}
          <div style={{ height:3, background:"#1F4D34", width:"100%" }}>
            {/* Fill */}
            <div style={{
              height:"100%",
              background: extractionStatus==='done' ? "#3ae0a2" : extractionStatus==='error' ? "#e05c5c" : "#2E7D52",
              width: extractionStatus==='running' ? "85%" : extractionStatus==='done' ? "100%" : "100%",
              transition: extractionStatus==='running' ? "width 45s cubic-bezier(0.1,0,0.2,1)" : "width 0.4s ease",
              opacity: extractionStatus==='done' ? 0 : 1,
              transitionProperty: extractionStatus==='done' ? "width 0.4s ease, opacity 1s ease 0.5s" : "width",
            }}/>
          </div>
          {/* Label */}
          <div style={{
            padding:"5px 20px",
            background: extractionStatus==='done' ? "rgba(58,224,162,0.08)" : extractionStatus==='error' ? "rgba(224,92,92,0.08)" : "rgba(46,125,82,0.08)",
            borderBottom:`1px solid ${extractionStatus==='done' ? "#2E7D52" : extractionStatus==='error' ? "#e05c5c" : "#1F4D34"}`,
            fontSize:11, fontWeight:600,
            color: extractionStatus==='done' ? "#3ae0a2" : extractionStatus==='error' ? "#e05c5c" : "#8aac96",
            display:"flex", alignItems:"center", gap:8,
          }}>
            {extractionStatus==='running' && (
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#2E7D52", animation:"pulse 1.2s ease-in-out infinite" }}/>
            )}
            {extractionStatus==='done'    && <span>✓</span>}
            {extractionStatus==='error'   && <span>⚠</span>}
            {extractionMsg}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        {state.activeLayer === 'L1' && (
          <DocumentIntelligenceLayer
            onStartExtraction={handleL1StartExtraction}
            onSendToPersonalisation={handleL1Complete}
            onExtractionError={handleL1Error}/>
        )}
        {state.activeLayer === 'L2' && state.l2.currentSheet === 'setup' && (
          <ProjectSetup project={state.project} l1Charter={state.l1.charter} onComplete={handleSetupComplete}/>
        )}
        {state.activeLayer === 'L2' && state.l2.currentSheet !== 'setup' && (
          <PersonalisationLayer
            state={state}
            onSheetUpdate={handleSheetUpdate}
            onSheetApprove={handleSheetApprove}
            onSheetUnlock={handleSheetUnlock}
            onSheetNav={handleSheetNav}/>
        )}
        {state.activeLayer === 'L3' && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
            flex:1, flexDirection:"column", gap:12, color:C.muted }}>
            <div style={{ fontSize:40, opacity:.3 }}>⚙️</div>
            <div style={{ fontSize:15, fontWeight:600, color:C.dim }}>Operational Layer</div>
            <div style={{ fontSize:12 }}>Coming in the next build — {approvedCount} sheet{approvedCount!==1?"s":""} approved and ready.</div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:.3; transform:scale(0.8); } 50% { opacity:1; transform:scale(1.2); } }
      `}</style>
    </div>
  );
}
