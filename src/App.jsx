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
  const [screen,     setScreen]     = useState("landing");
  const [state,      setState]      = useState(INITIAL_STATE);
  const [member,     setMember]     = useState(null);
  const [restoring,  setRestoring]  = useState(true);
  const [lastLogin,  setLastLogin]  = useState(null); // { projectCode, memberCode, memberName, lastUsed }
  const [saveStatus, setSaveStatus] = useState(null); // null | "saved" | "error"
  const { saveState, authenticate } = useProjectPersistence();
  const saveTimer      = useRef(null);
  const saveStatusTimer = useRef(null);

  // ── Restore session + read last login ─────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_LOGIN_KEY);
      if (raw) setLastLogin(JSON.parse(raw));
    } catch(e) { /* ignore */ }
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

  // ── Persist session to sessionStorage ────────────────────────────────────
  useEffect(() => {
    if (screen !== "app") return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ savedState:state, savedMember:member, savedScreen:screen }));
    } catch(e) { /* ignore */ }
  }, [state, member, screen]);

  // ── Auto-save to Redis (debounced 2s) with status feedback ────────────────
  useEffect(() => {
    const code = state.project?.code;
    if (!code || screen !== "app") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveState(code, state);
        setSaveStatus("saved");
      } catch(e) {
        setSaveStatus("error");
      }
      // Clear badge after 3 seconds
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
      saveStatusTimer.current = setTimeout(() => setSaveStatus(null), 3000);
    }, 2000);
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

    // ── Special keys ─────────────────────────────────────────────────────────

    if (sheetId === "__tier__") {
      setState(prev => ({ ...prev, projectTier: tierOverride ?? null }));
      return;
    }

    if (sheetId === "__projectMeta__") {
      const { projectName, projectCode } = tierOverride;
      setState(prev => ({
        ...prev,
        project: { ...prev.project, name: projectName, code: projectCode },
      }));
      try {
        const existing = JSON.parse(localStorage.getItem(LAST_LOGIN_KEY) || "{}");
        localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify({
          ...existing, projectCode, lastUsed: new Date().toISOString(),
        }));
      } catch(e) { /* ignore */ }
      return;
    }

    if (sheetId === "__loginCode__") {
      const entry = tierOverride;
      setState(prev => {
        const existing = prev.l2.loginCodes || [];
        if (existing.some(m => m.loginCode === entry.loginCode)) return prev;
        return { ...prev, l2: { ...prev.l2, loginCodes: [...existing, entry] } };
      });
      try {
        if (entry.isPM) {
          const existing = JSON.parse(localStorage.getItem(LAST_LOGIN_KEY) || "{}");
          localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify({
            ...existing, memberCode: entry.loginCode, memberName: entry.name,
            lastUsed: new Date().toISOString(),
          }));
        }
      } catch(e) { /* ignore */ }
      return;
    }

    if (sheetId === "__removeLoginCode__") {
      const codeToRemove = tierOverride;
      setState(prev => ({
        ...prev,
        l2: { ...prev.l2, loginCodes: (prev.l2.loginCodes||[]).filter(m => m.loginCode !== codeToRemove) },
      }));
      return;
    }

    if (sheetId === "__updateLoginCodeName__") {
      const { loginCode, name } = tierOverride;
      setState(prev => ({
        ...prev,
        l2: {
          ...prev.l2,
          loginCodes: (prev.l2.loginCodes||[]).map(m =>
            m.loginCode === loginCode ? { ...m, name } : m
          ),
        },
      }));
      return;
    }

    // ── Normal sheet update ───────────────────────────────────────────────────
    setState(prev => {
      const prevSheet = prev.l2.sheets[sheetId] || { data:{}, locked:false, status:"empty" };
      const nextData  = { ...prevSheet.data, ...data };
      let nextCodes   = prev.l2.loginCodes || [];

      // ── Team sync (H1 fix) ────────────────────────────────────────────────
      // When Sheet02 writes teamMembers, automatically upsert every member that
      // has both a name and loginCode into l2.loginCodes so all downstream
      // consumers (RACI, Risks, Change Control, L3 auth) see the full roster.
      if (sheetId === "02" && Array.isArray(data.teamMembers)) {
        data.teamMembers.forEach(member => {
          if (!member.loginCode || !member.name) return; // skip unnamed/codeless rows
          const existingIdx = nextCodes.findIndex(lc => lc.loginCode === member.loginCode);
          const entry = {
            loginCode:    member.loginCode,
            name:         member.name,
            role:         member.role || "",
            deliveryRole: member.deliveryRole || "",
            isPM:         member.isPM || member.role === "Project Manager",
          };
          if (existingIdx === -1) {
            nextCodes = [...nextCodes, entry];
          } else {
            nextCodes = nextCodes.map((lc, i) => i === existingIdx ? { ...lc, ...entry } : lc);
          }
        });
      }

      return {
        ...prev,
        l2: {
          ...prev.l2,
          loginCodes: nextCodes,
          sheets: {
            ...prev.l2.sheets,
            [sheetId]: {
              ...prevSheet,
              data:   nextData,
              status: status || prevSheet.status || "in-progress",
            },
          },
        },
      };
    });
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
        return items.map((a,i) => i===idx ? {...a, _complete:complete, _state: complete ? "complete" : "pending"} : a);
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
        baseline:    { version:1, confirmedDate:today, confirmedBy:loginCode, snapshot },
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

      {/* ── Project Setup ── */}
      {state.activeLayer !== "L3" && (
        <>
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
              {/* Save status badge */}
              {saveStatus === "saved" && (
                <span style={{ fontSize:10, color:"#3ae0a2" }}>✓ Saved</span>
              )}
              {saveStatus === "error" && (
                <span style={{ fontSize:10, color:C.risk }}>⚠ Save failed — check connection</span>
              )}
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
