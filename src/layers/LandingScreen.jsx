import { useState } from "react";

const C = {
  bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c",
};

const inp = {
  width:"100%", background:C.surface2, border:`1px solid ${C.border}`,
  borderRadius:6, color:C.sage, fontSize:14, padding:"11px 14px",
  outline:"none", boxSizing:"border-box", fontFamily:"monospace",
  letterSpacing:".08em", textTransform:"uppercase",
};

export default function LandingScreen({ onCreateProject, onLoginProject }) {
  const [mode,        setMode]        = useState(null); // null | 'login' | 'create'
  const [projectCode, setProjectCode] = useState("");
  const [memberCode,  setMemberCode]  = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  const handleLogin = async () => {
    if (!projectCode.trim() || !memberCode.trim()) {
      setError("Please enter both your project code and member code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/project?projectCode=${encodeURIComponent(projectCode.trim())}&memberCode=${encodeURIComponent(memberCode.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === "Project not found"
          ? "Project not found. Check your project code and try again."
          : data.error === "Invalid member code"
          ? "Member code not recognised. Check your code and try again."
          : "Login failed. Please try again.");
        setLoading(false);
        return;
      }
      onLoginProject(data.project, data.member);
    } catch(e) {
      setError("Connection error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:24, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* Logo + title */}
      <div style={{ textAlign:"center", marginBottom:40 }}>
        <div style={{ width:56, height:56, background:C.accent, borderRadius:12,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:26, margin:"0 auto 16px" }}>🏗️</div>
        <div style={{ fontSize:26, fontWeight:700, color:C.sage, marginBottom:6 }}>NorCon Projects</div>
        <div style={{ fontSize:14, color:C.muted }}>Governance-driven project management</div>
      </div>

      {/* Mode selector */}
      {!mode && (
        <div style={{ width:"100%", maxWidth:420, display:"flex", flexDirection:"column", gap:12 }}>
          <button onClick={() => setMode("login")}
            style={{ padding:"16px", background:C.accent, color:"#fff", border:"none",
              borderRadius:8, fontSize:15, fontWeight:700, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            🔑 Login to existing project
          </button>
          <button onClick={onCreateProject}
            style={{ padding:"16px", background:"none", color:C.sage,
              border:`1px solid ${C.border}`, borderRadius:8, fontSize:15,
              fontWeight:700, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            ✦ Create new project
          </button>
          <div style={{ textAlign:"center", fontSize:12, color:C.muted, marginTop:8 }}>
            New to NorCon Projects? Click "Create new project" to get started.
          </div>
        </div>
      )}

      {/* Login form */}
      {mode === "login" && (
        <div style={{ width:"100%", maxWidth:420, background:C.surface,
          border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden" }}>

          <div style={{ background:C.surface2, borderBottom:`1px solid ${C.border}`,
            padding:"14px 20px", display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={() => { setMode(null); setError(""); }}
              style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:18, lineHeight:1 }}>←</button>
            <div style={{ fontSize:14, fontWeight:700, color:C.sage }}>Login to existing project</div>
          </div>

          <div style={{ padding:24, display:"flex", flexDirection:"column", gap:16 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:C.dim, display:"block",
                marginBottom:6, textTransform:"uppercase", letterSpacing:".4px" }}>
                Project Code
              </label>
              <input style={inp} value={projectCode}
                onChange={e => setProjectCode(e.target.value.toUpperCase())}
                placeholder="e.g. WF"
                onKeyDown={e => e.key==="Enter" && handleLogin()}/>
              <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
                Your project manager will have shared this with you.
              </div>
            </div>

            <div>
              <label style={{ fontSize:11, fontWeight:700, color:C.dim, display:"block",
                marginBottom:6, textTransform:"uppercase", letterSpacing:".4px" }}>
                Your Member Code
              </label>
              <input style={inp} value={memberCode}
                onChange={e => setMemberCode(e.target.value.toUpperCase())}
                placeholder="e.g. WF-4821"
                onKeyDown={e => e.key==="Enter" && handleLogin()}/>
              <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
                This was generated when you were added to the team.
              </div>
            </div>

            {error && (
              <div style={{ background:"rgba(224,92,92,0.1)", border:`1px solid ${C.risk}`,
                borderRadius:6, padding:"10px 14px", fontSize:12, color:"#ff9e9e" }}>
                {error}
              </div>
            )}

            <button onClick={handleLogin} disabled={loading}
              style={{ padding:"12px", background: loading ? C.surface2 : C.accent,
                color:"#fff", border:"none", borderRadius:6, fontSize:14,
                fontWeight:700, cursor: loading ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              {loading ? (
                <>
                  <div style={{ width:14, height:14, border:"2px solid #fff",
                    borderTopColor:"transparent", borderRadius:"50%",
                    animation:"spin .8s linear infinite" }}/>
                  Logging in...
                </>
              ) : "Enter Project →"}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
