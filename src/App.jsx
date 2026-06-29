import { useState, useCallback, useEffect, useRef } from "react";
import ProjectSetup   from "./layers/ProjectSetup.jsx";
import OperatingLayer from "./layers/OperatingLayer.jsx";
import LandingScreen  from "./layers/LandingScreen.jsx";
import { INITIAL_STATE }         from "./store/appStore.js";
import { buildSnapshot }         from "./store/baselineUtils.js";
import { useProjectPersistence } from "./store/useProjectPersistence.js";

const C = { bg:"#0D2B1B", surface:"#122E1E", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c" };

const SESSION_KEY    = "norcon_session_v1";
const LAST_LOGIN_KEY = "norcon_last_login";

export default function App() {
  const [screen,    setScreen]    = useState("landing");
  const [state,     setState]     = useState(INITIAL_STATE);
  const [member,    setMember]    = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [lastLogin, setLastLogin] = useState(null); // { projectCode, memberCode, memberName, lastUsed }
  const { saveState, authenticate } = useProjectPersistence();
  const saveTimer = useRef(null);

  // ── Restore session + read last login ─────────────────────────────────────
  useEffect(() => {
    // Last login — persists across sessions via localStorage
    try {
      const raw = localStorage.getItem(LAST_LOGIN_KEY);
      if (raw) setLastLogin(JSON.parse(raw));
    } catch(e) { /* ignore */ }
    // Active session — sessionStorage (cleared on tab close)
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const { savedState, savedMember, savedScreen } = JSON.parse(raw);
        if (savedState && savedScreen === "app") {
          setState(savedState);
          setMember(savedMember || null);
          setScreen("app");
        }
      }
    } catch(e) { /* ignore */ }
    setRestoring(false);
  }, []);

  // ── Persist session ────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "app") return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ savedState:state, savedMember:member, savedScreen:screen }));
    } catch(e) { /* ignore */ }
  }, [state, member, screen]);

  // ── Auto-save to Redis ─────────────────────────────────────────────────────
  useEffect(() => {
    const code = state.project?.code;
    if (!code || screen !== "app") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveState(code, state); }, 2000);
  }, [state, screen, saveState]);

  // ── Auth ───────────────────────────────────────────────────────────────────
  const handleCreateNew = useCallback(() => {
    setState(INITIAL_STATE);
    setMember(null);
    setScreen("app");
  }, []);

  const handleLogin = useCallback(async (projectCode, memberCode) => {
    const result = await authenticate(projectCode, memberCode);
    setState({ ...result.state, activeLayer:"L3" });
    setMember(result.member);
    setScreen("app");
    // Remember for next visit
    try {
      const entry = {
        projectCode,
        memberCode,
        memberName: result.member?.name || "",
        lastUsed:   new Date().toISOString(),
      };
      localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify(entry));
      setLastLogin(entry);
    } catch(e) { /* ignore */ }
  }, [authenticate]);

  // ── Sheet handlers (passed into ProjectSetup) ──────────────────────────────
  const handleSheetUpdate = useCallback((sheetId, data, status, tierOverride) => {
    // Special key "__tier__" — writes chosen tier into state
    if (sheetId === "__tier__") {
      setState(prev => ({ ...prev, projectTier: tierOverride, activeLayer:"setup" }));
      return;
    }
    // Special key "__projectMeta__" — writes project name and code into state.project
    if (sheetId === "__projectMeta__") {
      const { projectName, projectCode } = tierOverride;
      setState(prev => ({
        ...prev,
        project: {
          ...prev.project,
          name: projectName,
          code: projectCode,
        },
      }));
      // Remember last project code for login pre-fill
      try {
        const existing = JSON.parse(localStorage.getItem("norcon_last_login") || "{}");
        localStorage.setItem("norcon_last_login", JSON.stringify({
          ...existing,
          projectCode,
          lastUsed: new Date().toISOString(),
        }));
      } catch(e) { /* ignore */ }
      return;
    }
    // Special key "__loginCode__" — adds PM login code into l2.loginCodes
    if (sheetId === "__loginCode__") {
      const loginEntry = tierOverride;
      setState(prev => ({
        ...prev,
        l2: {
          ...prev.l2,
          loginCodes: [
            ...(prev.l2.loginCodes || []).filter(m => !m.isPM),
            loginEntry,
          ],
        },
      }));
      // Remember last login code for pre-fill
      try {
        const existing = JSON.parse(localStorage.getItem("norcon_last_login") || "{}");
        localStorage.setItem("norcon_last_login", JSON.stringify({
          ...existing,
          memberCode: loginEntry.loginCode,
          memberName: loginEntry.name,
          lastUsed:   new Date().toISOString(),
        }));
      } catch(e) { /* ignore */ }
      return;
    }
    setState(prev => ({
      ...prev,
      l2: {
        ...prev.l2,
        sheets: {
          ...prev.l2.sheets,
          [sheetId]: {
            ...prev.l2.sheets[sheetId],
            data: { ...prev.l2.sheets[sheetId]?.data, ...data },
            status: status || prev.l2.sheets[sheetId]?.status || "in-progress",
          },
        },
      },
    }));
  }, []);

  const handleSheetApprove = useCallback((sheetId) => {
    setState(prev => ({
      ...prev,
      l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
        [sheetId]: { ...prev.l2.sheets[sheetId], locked:true, status:"approved" }
      }},
    }));
  }, []);

  const handleSheetUnlock = useCallback((sheetId) => {
    setState(prev => ({
      ...prev,
      l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
        [sheetId]: { ...prev.l2.sheets[sheetId], locked:false, status:"in-progress" }
      }},
    }));
  }, []);

  const handleSheetNav = useCallback((sheetId) => {
    setState(prev => ({ ...prev, l2: { ...prev.l2, currentSheet: sheetId } }));
  }, []);

  // ── L3 handlers ────────────────────────────────────────────────────────────
  const handleMarkComplete = useCallback((taskId, itemType, complete=true) => {
    setState(prev => {
      const sheetData = prev.l2.sheets["03"]?.data || {};
      const tryUpdate = (key) => {
        const items = sheetData[key] || [];
        const idx   = items.findIndex(a => a._id === taskId || a.taskId === taskId);
        if (idx === -1) return null;
        return items.map((a,i) => i===idx ? {...a, _complete:complete} : a);
      };
      const updatedActivities = tryUpdate("activities");
      const updatedMilestones = tryUpdate("milestones");
      const newData = {
        ...sheetData,
        ...(updatedActivities ? { activities: updatedActivities } : {}),
        ...(updatedMilestones ? { milestones: updatedMilestones } : {}),
      };
      const prevEvidence = prev.sustainData?.evidence || [];
      const newEvidence  = complete ? prevEvidence : prevEvidence.filter(e => e.activityId !== taskId);
      return {
        ...prev,
        sustainData: { ...(prev.sustainData||{}), evidence: newEvidence },
        l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
          "03": { ...prev.l2.sheets["03"], data: newData }
        }},
      };
    });
  }, []);

  const handleGoToL2 = useCallback(() => {
    setState(prev => ({ ...prev, activeLayer:"setup" }));
  }, []);

  const handleGoToL3 = useCallback(() => {
    setState(prev => ({ ...prev, activeLayer:"L3" }));
  }, []);

  const handleConfirmBaseline = useCallback((loginCode) => {
    setState(prev => {
      const sheets   = prev.l2.sheets;
      const snapshot = buildSnapshot(sheets);
      const today    = new Date().toISOString().slice(0,10);
      return {
        ...prev,
        project: { ...prev.project, status:"active" },
        baseline: { version:1, confirmedDate:today, confirmedBy:loginCode, snapshot },
        currentPlan: { version:1, lastUpdated:today, lastCCR:null, snapshot },
      };
    });
  }, []);

  const handleApplyCCRToPlan = useCallback((ccrId) => {
    setState(prev => {
      if (!prev.currentPlan) return prev;
      const snapshot = buildSnapshot(prev.l2.sheets);
      const today    = new Date().toISOString().slice(0,10);
      return {
        ...prev,
        currentPlan: { version:(prev.currentPlan.version||1)+1, lastUpdated:today, lastCCR:ccrId, snapshot },
      };
    });
  }, []);

  const handleLaunch = useCallback(() => {
    const code = state.project?.code;
    if (code) {
      fetch("/api/state", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ code, state }) });
    }
    setState(prev => ({ ...prev, activeLayer:"L3" }));
  }, [state]);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setState(INITIAL_STATE);
    setMember(null);
    setScreen("landing");
  }, []);

  // ── Restoring splash ───────────────────────────────────────────────────────
  if (restoring) {
    return (
      <div style={{ background:C.bg, color:C.sage, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ fontSize:13, color:C.muted }}>Loading…</div>
      </div>
    );
  }

  if (screen === "landing") {
    return <LandingScreen onCreateNew={handleCreateNew} onLogin={handleLogin} lastLogin={lastLogin}/>;
  }

  const approvedCount = Object.values(state.l2.sheets).filter(s => s.locked).length;
  const l3Unlocked    = approvedCount > 0 && state.l2.loginCodes.length > 0;

  return (
    <div style={{ background:C.bg, color:C.sage, height:"100vh", display:"flex", flexDirection:"column",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", fontSize:13, overflow:"hidden" }}>

      {/* ── L3 — full screen ── */}
      {state.activeLayer === "L3" && (
        <OperatingLayer
          state={state}
          member={member || { isPM:true, role:"Project Manager", loginCode:"PM", name:"Project Manager" }}
          onGoToL2={handleGoToL2}
          onMarkComplete={handleMarkComplete}
          onStateChange={setState}
          onLogout={handleLogout}
          baseline={state.baseline}
          currentPlan={state.currentPlan}
          onConfirmBaseline={handleConfirmBaseline}
          onApplyCCRToPlan={handleApplyCCRToPlan}/>
      )}

      {/* ── Project Setup (L1+L2 merged) ── */}
      {state.activeLayer !== "L3" && (
        <>
          {/* Top bar — only shown during setup */}
          <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 20px",
            display:"flex", alignItems:"center", gap:12, height:48, flexShrink:0 }}>
            <div style={{ width:28, height:28, background:C.accent, borderRadius:6,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🏗️</div>
            <div style={{ fontSize:14, fontWeight:700, color:C.sage }}>NorCon Projects</div>
            {state.project?.name && (
              <>
                <div style={{ color:C.border, fontSize:16 }}>·</div>
                <div style={{ fontSize:12, color:C.dim }}>
                  <span style={{ color:C.accentL, fontFamily:"monospace", marginRight:6 }}>{state.project.code}</span>
                  {state.project.name}
                </div>
              </>
            )}
            <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
              {/* Back — navigate to previous page within the app */}
              <button onClick={() => window.history.back()}
                style={{ padding:"5px 10px", fontSize:11, borderRadius:5,
                  border:`1px solid ${C.border}`, background:"none", color:C.muted, cursor:"pointer" }}>
                ← Back
              </button>
              {/* Show L3 button once enough sheets are saved */}
              {l3Unlocked && (
                <button onClick={handleGoToL3}
                  style={{ padding:"5px 12px", fontSize:11, fontWeight:700, borderRadius:5,
                    border:`1px solid ${C.accent}`, background:C.accent, color:"#fff", cursor:"pointer" }}>
                  L3 · Operational →
                </button>
              )}
              {state.projectTier && (
                <div style={{ fontSize:10, color:C.muted, padding:"3px 9px", borderRadius:5,
                  border:`1px solid ${C.border}` }}>
                  {state.projectTier === "light" ? "🌱 Light" : "🏗️ Full"}
                </div>
              )}
            </div>
          </div>

          {/* ProjectSetup — fills remaining height */}
          <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
            <ProjectSetup
              state={state}
              onSheetUpdate={handleSheetUpdate}
              onSheetApprove={handleSheetApprove}
              onSheetUnlock={handleSheetUnlock}
              onSheetNav={handleSheetNav}
              onLaunch={handleLaunch}
              onLogout={handleLogout}/>
          </div>
        </>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
    </div>
  );
}
