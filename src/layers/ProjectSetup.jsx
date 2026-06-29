import { useState, useCallback, useRef, useEffect } from "react";
import mammoth from "mammoth";
import { SHEETS, isSheetAccessible } from "../store/appStore.js";
import Sheet01Charter      from "./sheets/Sheet01Charter.jsx";
import Sheet02Team         from "./sheets/Sheet02Team.jsx";
import Sheet03Schedule     from "./sheets/Sheet03Schedule.jsx";
import Sheet04RACI         from "./sheets/Sheet04RACI.jsx";
import Sheet05Risks        from "./sheets/Sheet05Risks.jsx";
import Sheet06Change       from "./sheets/Sheet06Change.jsx";
import Sheet07KDTracker    from "./sheets/Sheet07KDTracker.jsx";
import Sheet08Stakeholders from "./sheets/Sheet08Stakeholders.jsx";
import Sheet10Sustainability from "./sheets/Sheet10Sustainability.jsx";

const C = {
  bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2",
};

// ── Tier definitions ──────────────────────────────────────────────────────────
const TIERS = {
  light: {
    label: "Light",
    icon: "🌱",
    desc: "Essentials for simple projects — events, community initiatives, birthday planning.",
    sheets: ["01","02","03","04","05","10"],
    l3Tabs: ["home","dashboard","baseline","raci","risks","sustain","report"],
    questions: [
      { id:"q1", text:"What is this project trying to achieve, and by when?",   fields:["projectName","purpose","endDate"] },
      { id:"q2", text:"Who is leading this project and who is the sponsor?",     fields:["projectManager","projectSponsor"] },
      { id:"q3", text:"What is the total budget available?",                     fields:["budget"] },
      { id:"q4", text:"What are the two or three biggest risks you foresee?",    fields:["risks"] },
      { id:"q5", text:"Who are the key people involved and what are their roles?", fields:["team"] },
      { id:"q6", text:"What does success look like — how will you know it worked?", fields:["successCriteria"] },
    ],
  },
  full: {
    label: "Full",
    icon: "🏗️",
    desc: "Complete governance suite for complex or professional projects.",
    sheets: ["01","02","03","04","05","06","07","08","10"],
    l3Tabs: ["home","dashboard","baseline","raci","benefits","risks","stakeholders","sustain","report"],
    questions: [
      { id:"q1", text:"What is this project trying to achieve, and by when?",          fields:["projectName","purpose","endDate"] },
      { id:"q2", text:"Who is leading this project, who sponsors it, and which organisation?", fields:["projectManager","projectSponsor","organisation"] },
      { id:"q3", text:"What is the total budget and how is it allocated by phase?",    fields:["budget","schedule"] },
      { id:"q4", text:"What are the key deliverables and their target dates?",         fields:["deliverables","schedule"] },
      { id:"q5", text:"Who are the team members, their roles and availability?",       fields:["team"] },
      { id:"q6", text:"Who are the key stakeholders and what is their interest?",      fields:["stakeholders"] },
      { id:"q7", text:"What are the main risks and how will you respond to them?",     fields:["risks"] },
      { id:"q8", text:"What are the strategic benefits and how will you measure them?", fields:["benefits"] },
      { id:"q9", text:"What change control or approval thresholds apply?",             fields:["changeControl"] },
    ],
  },
};

const SHEET_COMPONENTS = {
  "01": Sheet01Charter,
  "02": Sheet02Team,
  "03": Sheet03Schedule,
  "04": Sheet04RACI,
  "05": Sheet05Risks,
  "06": Sheet06Change,
  "07": Sheet07KDTracker,
  "08": Sheet08Stakeholders,
  "10": Sheet10Sustainability,
};

const SHEET_LABELS = {
  "01":"Charter", "02":"Team", "03":"Schedule", "04":"RACI",
  "05":"Risks", "06":"Change Control", "07":"Benefits & KPIs",
  "08":"Stakeholders", "10":"Sustainability",
};

// ── JSON sanitiser — strips markdown fences, recovers truncated arrays ─────────
function safeParseJSON(raw) {
  if (!raw || typeof raw !== "string") throw new Error("Empty response");
  // Strip markdown code fences
  let clean = raw.replace(/^```(?:json)?\s*/i,"").replace(/\s*```\s*$/,"").trim();
  try {
    return JSON.parse(clean);
  } catch(e1) {
    // Attempt to recover truncated JSON by closing open structures
    let attempt = clean;
    // Count unclosed braces/brackets
    let braces = 0, brackets = 0, inStr = false, escape = false;
    for (let i = 0; i < attempt.length; i++) {
      const ch = attempt[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\" && inStr) { escape = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") braces++;
      if (ch === "}") braces--;
      if (ch === "[") brackets++;
      if (ch === "]") brackets--;
    }
    // Remove trailing comma before attempting close
    attempt = attempt.replace(/,\s*$/, "");
    // Close open strings
    if (inStr) attempt += '"';
    // Close open brackets/braces
    while (brackets > 0) { attempt += "]"; brackets--; }
    while (braces > 0)   { attempt += "}"; braces--; }
    try {
      return JSON.parse(attempt);
    } catch(e2) {
      throw new Error("JSON parse failed after recovery attempt: " + e1.message);
    }
  }
}

// ── Call extract API with robust error handling ───────────────────────────────
async function callExtract(messages, maxTokens = 2000) {
  const res = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error ${res.status}`);
  }
  const data = await res.json();
  const text = (data.content || []).map(b => b.text || "").join("").trim();
  if (!text) throw new Error("Empty response from AI");
  return text;
}

// ── Tier selection screen ────────────────────────────────────────────────────
function TierSelect({ onSelect, onBack }) {
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", background:C.bg }}>

      {/* Step nav bar */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 24px",
        borderBottom:`1px solid ${C.border}`, background:C.surface, flexShrink:0 }}>
        <button onClick={onBack}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px",
            background:"none", border:`1px solid ${C.border}`, borderRadius:6,
            color:C.muted, fontSize:12, cursor:"pointer" }}>
          ← Back
        </button>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:8 }}>
          {["Welcome","Tier","Project Details"].map((label, i) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:22, height:22, borderRadius:"50%", fontSize:10, fontWeight:700,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  background: i === 1 ? C.accent : i < 1 ? C.accentL+"33" : C.surface2,
                  color: i === 1 ? "#fff" : i < 1 ? C.accentL : C.muted,
                  border: `1px solid ${i === 1 ? C.accent : i < 1 ? C.accentL : C.border}` }}>
                  {i < 1 ? "✓" : i + 1}
                </div>
                <span style={{ fontSize:11, color: i === 1 ? C.sage : i < 1 ? C.accentL : C.muted,
                  fontWeight: i === 1 ? 700 : 400 }}>{label}</span>
              </div>
              {i < 2 && <span style={{ color:C.border, fontSize:14 }}>›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:32 }}>
        <div style={{ maxWidth:560, width:"100%" }}>
          <div style={{ fontSize:22, fontWeight:700, color:C.sage, marginBottom:6, textAlign:"center" }}>
            🏗️ NorCon Project Setup
          </div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:32, textAlign:"center", lineHeight:1.6 }}>
            Choose the governance level that fits your project. This determines which tools and modules are available.
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {Object.entries(TIERS).map(([key, tier]) => (
              <button key={key} onClick={() => onSelect(key)}
                style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
                  padding:"24px 20px", cursor:"pointer", textAlign:"left", transition:"border-color .15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accentL}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                <div style={{ fontSize:28, marginBottom:10 }}>{tier.icon}</div>
                <div style={{ fontSize:16, fontWeight:700, color:C.sage, marginBottom:6 }}>{tier.label}</div>
                <div style={{ fontSize:12, color:C.muted, lineHeight:1.6, marginBottom:14 }}>{tier.desc}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  {tier.sheets.map(id => (
                    <div key={id} style={{ fontSize:11, color:C.dim, display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ color:C.accentL, fontSize:9 }}>✓</span>
                      {SHEET_LABELS[id]}
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PM Setup screen — project name, code, PM name, login code ────────────────
function PMSetup({ tier, onConfirm, onBack }) {
  const [projectName, setProjectName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [pmName,      setPmName]      = useState("");
  const [pmCode,      setPmCode]      = useState("");
  const [codeReady,   setCodeReady]   = useState(false);
  const [errors,      setErrors]      = useState({});

  const tierCfg = TIERS[tier];

  const deriveCode = (name) => {
    // Auto-suggest a project code from first letters of project name words
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "";
    if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
    return words.map(w => w[0]).join("").slice(0, 5).toUpperCase();
  };

  const handleProjectNameChange = (val) => {
    setProjectName(val);
    setCodeReady(false);
    setPmCode("");
    // Auto-fill project code if it hasn't been manually edited
    if (!projectCode || projectCode === deriveCode(projectName)) {
      setProjectCode(deriveCode(val));
    }
  };

  const validate = () => {
    const e = {};
    if (!projectName.trim()) e.projectName = "Required";
    if (!projectCode.trim()) e.projectCode = "Required";
    if (!pmName.trim())      e.pmName      = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const generateCode = () => {
    if (!validate()) return;
    const prefix = (projectCode || "PM").toUpperCase().slice(0, 5);
    const num    = Math.floor(1000 + Math.random() * 9000);
    setPmCode(`${prefix}-${num}`);
    setCodeReady(true);
  };

  const handleConfirm = () => {
    if (!codeReady) { generateCode(); return; }
    if (!validate()) return;
    onConfirm({
      projectName: projectName.trim(),
      projectCode: projectCode.trim().toUpperCase(),
      pmName:      pmName.trim(),
      loginCode:   pmCode,
    });
  };

  const inp = {
    background:C.surface2, border:`1px solid ${C.border}`, borderRadius:6,
    color:C.sage, fontSize:13, padding:"10px 13px", outline:"none",
    width:"100%", boxSizing:"border-box", fontFamily:"inherit",
  };

  const fieldErr = (key) => errors[key]
    ? <div style={{ fontSize:10, color:C.risk, marginTop:4 }}>{errors[key]}</div>
    : null;

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", background:C.bg, overflowY:"auto" }}>

      {/* Step nav bar */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 24px",
        borderBottom:`1px solid ${C.border}`, background:C.surface, flexShrink:0 }}>
        <button onClick={onBack}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px",
            background:"none", border:`1px solid ${C.border}`, borderRadius:6,
            color:C.muted, fontSize:12, cursor:"pointer" }}>
          ← Back
        </button>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:8 }}>
          {["Welcome","Tier","Project Details"].map((label, i) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:22, height:22, borderRadius:"50%", fontSize:10, fontWeight:700,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  background: i === 2 ? C.accent : C.accentL+"33",
                  color: i === 2 ? "#fff" : C.accentL,
                  border: `1px solid ${i === 2 ? C.accent : C.accentL}` }}>
                  {i < 2 ? "✓" : 3}
                </div>
                <span style={{ fontSize:11, color: i === 2 ? C.sage : C.accentL,
                  fontWeight: i === 2 ? 700 : 400 }}>{label}</span>
              </div>
              {i < 2 && <span style={{ color:C.border, fontSize:14 }}>›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:32 }}>
      <div style={{ maxWidth:480, width:"100%" }}>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>{tierCfg.icon}</div>
          <div style={{ fontSize:18, fontWeight:700, color:C.sage, marginBottom:6 }}>
            {tierCfg.label} Project Setup
          </div>
          <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>
            Give your project a name and code, then register the Project Manager.
          </div>
        </div>

        {/* Card */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
          padding:"24px 28px" }}>

          {/* ── Project Details ── */}
          <div style={{ fontSize:10, fontWeight:700, color:C.accentL, textTransform:"uppercase",
            letterSpacing:".6px", marginBottom:12 }}>Project Details</div>

          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.dim,
              textTransform:"uppercase", letterSpacing:".5px", marginBottom:7 }}>
              Project Name
            </label>
            <input style={{ ...inp, borderColor: errors.projectName ? C.risk : C.border }}
              value={projectName}
              onChange={e => handleProjectNameChange(e.target.value)}
              placeholder="e.g. Northumbria Waterfront Regeneration"
              autoFocus/>
            {fieldErr("projectName")}
          </div>

          <div style={{ marginBottom:20 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.dim,
              textTransform:"uppercase", letterSpacing:".5px", marginBottom:7 }}>
              Project Code
              <span style={{ fontSize:9, color:C.muted, fontWeight:400, marginLeft:6, textTransform:"none" }}>
                (used as login code prefix)
              </span>
            </label>
            <input style={{ ...inp, borderColor: errors.projectCode ? C.risk : C.border,
              textTransform:"uppercase", fontFamily:"monospace", letterSpacing:".08em" }}
              value={projectCode}
              onChange={e => { setProjectCode(e.target.value.toUpperCase().slice(0,6)); setCodeReady(false); setPmCode(""); }}
              placeholder="e.g. NWR"/>
            {fieldErr("projectCode")}
            {!errors.projectCode && projectCode && (
              <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>
                Login codes will be formatted: <span style={{ color:C.accentL, fontFamily:"monospace" }}>{projectCode}-XXXX</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop:`1px solid ${C.border}`, margin:"4px 0 18px" }}/>

          {/* ── Project Manager ── */}
          <div style={{ fontSize:10, fontWeight:700, color:C.accentL, textTransform:"uppercase",
            letterSpacing:".6px", marginBottom:12 }}>Project Manager</div>

          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.dim,
              textTransform:"uppercase", letterSpacing:".5px", marginBottom:7 }}>
              Full Name
            </label>
            <input style={{ ...inp, borderColor: errors.pmName ? C.risk : C.border }}
              value={pmName}
              onChange={e => { setPmName(e.target.value); setCodeReady(false); setPmCode(""); setErrors(p => ({...p, pmName:""})); }}
              placeholder="e.g. Sarah Johnson"
              onKeyDown={e => e.key === "Enter" && generateCode()}/>
            {fieldErr("pmName")}
          </div>

          <div style={{ marginBottom:20 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.dim,
              textTransform:"uppercase", letterSpacing:".5px", marginBottom:7 }}>
              Login Code
            </label>
            {codeReady ? (
              <div>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <div style={{ flex:1, background:C.surface2, border:`1px solid ${C.accentL}66`,
                    borderRadius:6, padding:"10px 13px", fontFamily:"monospace", fontSize:16,
                    fontWeight:700, color:C.accentL, letterSpacing:".12em" }}>
                    {pmCode}
                  </div>
                  <button onClick={() => { setCodeReady(false); setPmCode(""); }}
                    style={{ padding:"10px 14px", background:"none", border:`1px solid ${C.border}`,
                      borderRadius:6, color:C.muted, fontSize:11, cursor:"pointer", whiteSpace:"nowrap" }}>
                    Regenerate
                  </button>
                </div>
                <div style={{ fontSize:10, color:C.muted, marginTop:6 }}>
                  Share this code with the Project Manager to log in later.
                </div>
              </div>
            ) : (
              <button onClick={generateCode}
                style={{ width:"100%", padding:"10px", background:C.surface2,
                  border:`1px solid ${C.accentL}55`,
                  borderRadius:6, color:C.accentL,
                  fontSize:12, fontWeight:700, cursor:"pointer" }}>
                Generate Login Code
              </button>
            )}
          </div>

          <button onClick={handleConfirm} disabled={!codeReady}
            style={{ width:"100%", padding:"12px",
              background: codeReady ? C.accent : "#1F4D34",
              border:"none", borderRadius:7, color:"#fff", fontSize:13, fontWeight:700,
              cursor: codeReady ? "pointer" : "not-allowed",
              boxShadow: codeReady ? `0 4px 16px ${C.accent}44` : "none",
              transition:"all .2s" }}>
            Enter Project Setup →
          </button>
        </div>

        {/* Tier note */}
        <div style={{ textAlign:"center", marginTop:14, fontSize:11, color:C.muted }}>
          <span style={{ color:C.dim }}>{tierCfg.label} tier</span>
          {" · "}{tierCfg.sheets.length} sheets active
          {" · "}<span style={{ color:C.accentL }}>PM · Full Access</span>
        </div>
      </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProjectSetup({ state, onSheetUpdate, onSheetApprove, onSheetUnlock, onSheetNav, onLaunch, onLogout, onL1Complete }) {
  const { l2, l1, project } = state;
  const tier     = state.projectTier; // "light" | "full" | null
  const tierCfg  = tier ? TIERS[tier] : null;

  const [activeSheet,   setActiveSheet]   = useState("01");
  const [dirtySheet,    setDirtySheet]    = useState(false);
  const [savingPrompt,  setSavingPrompt]  = useState(null);

  // ── AI status indicator ───────────────────────────────────────────────────
  const [aiStatus,      setAiStatus]      = useState("");

  // ── Document intelligence state ───────────────────────────────────────────
  const [uploadMode,    setUploadMode]    = useState("file");
  const [pasteText,     setPasteText]     = useState("");
  const [extracting,    setExtracting]    = useState(false);
  const [extractMsg,    setExtractMsg]    = useState("");
  const [fileList,      setFileList]      = useState([]);

  // ── Q&A state ─────────────────────────────────────────────────────────────
  const [qaMessages,    setQaMessages]    = useState([]);
  const [qaInput,       setQaInput]       = useState("");
  const [qaLoading,     setQaLoading]     = useState(false);
  const [currentQIdx,   setCurrentQIdx]   = useState(0);
  const qaBottomRef = useRef(null);

  const sheets   = l2?.sheets || {};

  // ── Blur / onboarding state — derived AFTER sheets is declared ────────────
  // isExisting: project already has data (returning login), blur never shown
  const isExisting = Object.values(sheets).some(s => s.status !== "empty") ||
                     (l2?.loginCodes||[]).length > 0;
  const [blurLifted,    setBlurLifted]    = useState(() => isExisting);
  const [showRolePopup, setShowRolePopup] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const questions = tierCfg?.questions || [];

  // Auto-scroll Q&A to bottom
  useEffect(() => {
    qaBottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [qaMessages]);

  // ── Start Q&A — ask first question with AI recommendation ─────────────────
  useEffect(() => {
    if (!tier || qaMessages.length > 0) return;
    askQuestion(0);
  }, [tier]);

  const askQuestion = async (idx) => {
    if (!tierCfg || idx >= questions.length) return;
    const q = questions[idx];
    setQaLoading(true);
    setAiStatus(`Preparing question ${idx + 1} of ${questions.length}…`);
    try {
      const context = buildSheetContext();
      const prompt = `You are a project management assistant helping set up a ${tierCfg.label} project.
Current project data: ${JSON.stringify(context)}
Question to ask: "${q.text}"
Fields this answer will populate: ${q.fields.join(", ")}

Respond in JSON only, no markdown fences, no preamble:
{"recommendation":"your specific recommended answer here based on any context available, or a helpful example if no context","rationale":"one sentence explaining why"}`;

      const raw = await callExtract([{ role:"user", content:prompt }], 500);
      let rec = { recommendation:"", rationale:"" };
      try { rec = safeParseJSON(raw); } catch(e) { rec = { recommendation: raw.slice(0,200), rationale:"" }; }

      setQaMessages(prev => [...prev, {
        role: "ai",
        qId: q.id,
        question: q.text,
        fields: q.fields,
        recommendation: rec.recommendation || "",
        rationale: rec.rationale || "",
        accepted: false,
        userEdit: "",
      }]);
    } catch(err) {
      setQaMessages(prev => [...prev, {
        role: "ai", qId: q.id, question: q.text, fields: q.fields,
        recommendation: "", rationale: "", accepted: false, userEdit: "",
        error: err.message,
      }]);
    }
    setQaLoading(false);
    setAiStatus("");
    setCurrentQIdx(idx);
  };

  const handleAccept = async (msgIdx) => {
    const msg = qaMessages[msgIdx];
    const answer = msg.userEdit || msg.recommendation;
    setQaMessages(prev => prev.map((m,i) => i===msgIdx ? {...m, accepted:true} : m));
    await applyAnswerToSheets(msg.fields, answer);
    // Ask next question
    if (currentQIdx + 1 < questions.length) {
      askQuestion(currentQIdx + 1);
    }
  };

  const handleEdit = (msgIdx, value) => {
    setQaMessages(prev => prev.map((m,i) => i===msgIdx ? {...m, userEdit:value} : m));
  };

  const handleSubmitEdit = async (msgIdx) => {
    const msg = qaMessages[msgIdx];
    const answer = msg.userEdit || msg.recommendation;
    setQaMessages(prev => prev.map((m,i) => i===msgIdx ? {...m, accepted:true} : m));
    await applyAnswerToSheets(msg.fields, answer);
    if (currentQIdx + 1 < questions.length) {
      askQuestion(currentQIdx + 1);
    }
  };

  // Free-form Q&A input
  const handleFreeInput = async () => {
    if (!qaInput.trim()) return;
    const userMsg = qaInput.trim();
    setQaInput("");
    setQaMessages(prev => [...prev, { role:"user", text:userMsg }]);
    setQaLoading(true);
    try {
      const context = buildSheetContext();
      const prompt = `You are a project management assistant. The PM has provided this information: "${userMsg}"
Current project context: ${JSON.stringify(context)}
Extract any useful project data from this input and recommend updates to the project sheets.
Respond in JSON only, no markdown fences:
{"recommendations":[{"sheet":"sheet name","field":"field name","value":"recommended value","reason":"brief reason"}],"reply":"brief conversational acknowledgement"}`;

      const raw = await callExtract([{ role:"user", content:prompt }], 800);
      let parsed = { recommendations:[], reply:"Got it." };
      try { parsed = safeParseJSON(raw); } catch(e) {}

      setQaMessages(prev => [...prev, {
        role:"ai", text: parsed.reply || "I've noted that information.",
        recommendations: parsed.recommendations || [],
      }]);
      // Apply recommendations
      if (parsed.recommendations?.length > 0) {
        applyRecommendationsList(parsed.recommendations);
      }
    } catch(err) {
      setQaMessages(prev => [...prev, { role:"ai", text:`Sorry, I couldn't process that: ${err.message}` }]);
    }
    setQaLoading(false);
  };

  // ── Build a compact summary of current sheet state for AI context ─────────
  const buildSheetContext = () => {
    const c = sheets["01"]?.data?.charter || {};
    return {
      projectName: c.projectName || "",
      purpose: c.purpose || "",
      startDate: c.startDate || "",
      endDate: c.endDate || "",
      budget: c.budget || "",
      projectManager: c.projectManager || "",
      projectSponsor: c.projectSponsor || "",
      teamCount: (sheets["02"]?.data?.teamMembers || []).length,
      activitiesCount: (sheets["03"]?.data?.activities || []).length,
      risksCount: (sheets["05"]?.data?.risks || []).length,
    };
  };

  // ── Apply a Q&A answer to the relevant sheet fields ───────────────────────
  const applyAnswerToSheets = async (fields, answer) => {
    if (!fields?.length || !answer) return;
    try {
      const context = buildSheetContext();
      const prompt = `You are mapping a project manager's answer to structured sheet fields.
Answer: "${answer}"
Fields to populate: ${JSON.stringify(fields)}
Current context: ${JSON.stringify(context)}
Tier: ${tier}

Respond in JSON only, no markdown fences. Map the answer to these possible fields:
- projectName, purpose, endDate, startDate, budget, projectManager, projectSponsor, organisation (go into sheet 01 charter)
- team (array of {name,role} objects, sheet 02)
- activities (array of {name,phase,targetDate}, sheet 03)
- risks (array of {name,likelihood,impact,response}, sheet 05)
- stakeholders (array of {name,category,interest}, sheet 08)
- benefits (objectives array for sheet 07)
- changeControl (thresholds for sheet 06)
- successCriteria (string, sheet 01)

Return only the fields that have data:
{"charter":{},"team":[],"activities":[],"risks":[],"stakeholders":[],"benefits":[],"successCriteria":""}`;

      const raw = await callExtract([{ role:"user", content:prompt }], 1000);
      let mapped = {};
      try { mapped = safeParseJSON(raw); } catch(e) { return; }

      // Apply to sheet 01 — charter
      if (mapped.charter && Object.keys(mapped.charter).length > 0) {
        const existing = sheets["01"]?.data?.charter || {};
        const merged   = { ...mapped.charter };
        // PM edits always win — don't overwrite non-empty fields
        Object.keys(merged).forEach(k => { if (existing[k]) merged[k] = existing[k]; });
        onSheetUpdate("01", { charter: { ...existing, ...merged } }, "ai-draft");
      }
      if (mapped.successCriteria && !sheets["01"]?.data?.charter?.successCriteria) {
        const existing = sheets["01"]?.data?.charter || {};
        onSheetUpdate("01", { charter: { ...existing, successCriteria: mapped.successCriteria } }, "ai-draft");
      }
      // Apply to sheet 02 — team
      if (mapped.team?.length > 0) {
        const existing = sheets["02"]?.data?.teamMembers || [];
        if (existing.length === 0) {
          const newMembers = mapped.team.map((m,i) => ({
            _id: `TM-${String(i+1).padStart(3,"0")}`, name:m.name||"", role:m.role||"",
            loginCode:"", deliveryRole:"", availability:"", location:"", responsibilities:"",
          }));
          onSheetUpdate("02", { teamMembers: newMembers }, "ai-draft");
        }
      }
      // Apply to sheet 03 — activities
      if (mapped.activities?.length > 0) {
        const existing = sheets["03"]?.data?.activities || [];
        if (existing.length === 0) {
          const acts = mapped.activities.map((a,i) => ({
            _id:`ACT-${String(i+1).padStart(3,"0")}`, name:a.name||"",
            phase:a.phase||"Definition", targetDate:a.targetDate||"", _complete:false,
          }));
          onSheetUpdate("03", { activities: acts }, "ai-draft");
        }
      }
      // Apply to sheet 05 — risks
      if (mapped.risks?.length > 0) {
        const existing = sheets["05"]?.data?.risks || [];
        if (existing.length === 0) {
          const risks = mapped.risks.map((r,i) => ({
            _id:`R-${String(101+i)}`, name:r.name||"", likelihood:r.likelihood||"2",
            impact:r.impact||"2", response:r.response||"Reduce", mitigation:"", category:"",
          }));
          onSheetUpdate("05", { risks }, "ai-draft");
        }
      }
      // Apply to sheet 08 — stakeholders (full tier only)
      if (tier === "full" && mapped.stakeholders?.length > 0) {
        const existing = sheets["08"]?.data?.stakeholders || [];
        if (existing.length === 0) {
          const shs = mapped.stakeholders.map((s,i) => ({
            _id:`SH-${String(i+1).padStart(3,"0")}`, name:s.name||"",
            category:s.category||"", interest:s.interest||"", power:5, influence:5, ease:5,
          }));
          onSheetUpdate("08", { stakeholders: shs }, "ai-draft");
        }
      }
    } catch(err) {
      console.error("applyAnswerToSheets:", err.message);
    }
  };

  const applyRecommendationsList = (recs) => {
    recs.forEach(rec => {
      if (!rec.sheet || !rec.field || !rec.value) return;
      // Simple field mapping — extend as needed
      if (rec.sheet.includes("charter") || rec.sheet === "01") {
        const existing = sheets["01"]?.data?.charter || {};
        if (!existing[rec.field]) {
          onSheetUpdate("01", { charter: { ...existing, [rec.field]: rec.value } }, "ai-draft");
        }
      }
    });
  };

  // ── Document extraction ───────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setExtracting(true);

    for (const file of files) {
      setExtractMsg(`Processing ${file.name}…`);
      setAiStatus(`Reading ${file.name}…`);
      try {
        let text = "";
        if (file.name.endsWith(".docx")) {
          const buf = await file.arrayBuffer();
          const res = await mammoth.extractRawText({ arrayBuffer: buf });
          text = res.value;
        } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
          // For Excel, read as text and pass to AI for interpretation
          text = `[Excel file: ${file.name}] — PM uploaded a spreadsheet. Extract schedule/cost/team data if present.`;
        } else {
          text = await file.text();
        }
        setFileList(prev => [...prev, file.name]);
        await runExtraction(text, file.name);
      } catch(err) {
        setExtractMsg(`⚠ Error reading ${file.name}: ${err.message}`);
      }
    }
    setExtracting(false);
    setAiStatus("");
    setExtractMsg("✓ Extraction complete. Recommendations applied to sheets.");
    e.target.value = "";
  };

  const handleTextExtract = async () => {
    if (!pasteText.trim()) return;
    setExtracting(true);
    setExtractMsg("Extracting from text…");
    try {
      await runExtraction(pasteText, "pasted text");
      setPasteText("");
      setExtractMsg("✓ Text processed. Recommendations applied.");
    } catch(err) {
      setExtractMsg(`⚠ ${err.message}`);
    }
    setExtracting(false);
  };

  const runExtraction = async (text, source) => {
    setAiStatus(`Extracting project data from ${source}…`);
    // Chunk large documents to avoid token limits
    const MAX_CHARS = 12000;
    const chunk = text.slice(0, MAX_CHARS);
    const truncated = text.length > MAX_CHARS;

    const tierSheets = tierCfg?.sheets || ["01","02","03","05"];
    const prompt = `You are an expert project manager extracting structured project data from a document.
Source: ${source}
Tier: ${tier} (${tierCfg?.label})
Active sheets: ${tierSheets.join(", ")}
${truncated ? "(Note: document was truncated for processing)" : ""}

Document:
${chunk}

Extract ALL project information and return ONLY valid JSON, no markdown fences, no preamble, no trailing text after the closing brace.
Return this exact structure (omit arrays that have no data, do not leave trailing commas):
{
  "charter":{"projectName":"","purpose":"","problemStatement":"","startDate":"","endDate":"","budget":"","projectManager":"","projectSponsor":"","organisation":"","strategicAlignment":"","withinScope":[],"outOfScope":[]},
  "team":[{"name":"","role":"","deliveryRole":"","availability":""}],
  "activities":[{"name":"","phase":"","targetDate":"","responsible":""}],
  "milestones":[{"name":"","phase":"","targetDate":""}],
  "risks":[{"name":"","cause":"","potentialImpact":"","likelihood":"","impact":"","response":"","mitigation":"","category":""}],
  "issues":[{"name":"","description":"","priority":"","owner":""}],
  "deliverables":[{"name":"","phase":"","targetDate":"","priority":""}],
  "stakeholders":[{"name":"","category":"","power":"","interest":"","influence":"","engagementStrategy":""}],
  "benefits":[{"name":"","category":"","owner":"","targetDate":""}]
}`;

    const raw = await callExtract([{ role:"user", content:prompt }], 3000);
    let extracted = {};
    try {
      extracted = safeParseJSON(raw);
    } catch(err) {
      throw new Error("Could not parse extraction response: " + err.message);
    }

    // Map into sheets — PM edits always win (only fill empty fields)
    const c = sheets["01"]?.data?.charter || {};
    if (extracted.charter) {
      const merged = { ...extracted.charter };
      Object.keys(merged).forEach(k => { if (c[k]) merged[k] = c[k]; });
      onSheetUpdate("01", { charter: { ...c, ...merged } }, "ai-draft");
    }

    const existingTeam = sheets["02"]?.data?.teamMembers || [];
    if (extracted.team?.length > 0 && existingTeam.length === 0) {
      onSheetUpdate("02", { teamMembers: extracted.team.map((m,i) => ({
        _id:`TM-${String(i+1).padStart(3,"0")}`, name:m.name||"", role:m.role||"",
        deliveryRole:m.deliveryRole||"", availability:m.availability||"",
        loginCode:"", location:"", responsibilities:"",
      }))}, "ai-draft");
    }

    const existingActs = sheets["03"]?.data?.activities || [];
    const existingMiles = sheets["03"]?.data?.milestones || [];
    const newActs  = (extracted.activities||[]).map((a,i) => ({ _id:`ACT-${String(i+1).padStart(3,"0")}`, name:a.name||"", phase:a.phase||"Definition", targetDate:a.targetDate||"", responsible:a.responsible||"", _complete:false }));
    const newMiles = (extracted.milestones||[]).map((m,i) => ({ _id:`MS-${String(i+1).padStart(3,"0")}`,  name:m.name||"", phase:m.phase||"Definition", targetDate:m.targetDate||"", _complete:false }));
    if ((newActs.length > 0 && existingActs.length === 0) || (newMiles.length > 0 && existingMiles.length === 0)) {
      onSheetUpdate("03", {
        activities: existingActs.length > 0 ? existingActs : newActs,
        milestones:  existingMiles.length > 0 ? existingMiles : newMiles,
      }, "ai-draft");
    }

    const existingRisks = sheets["05"]?.data?.risks || [];
    if (extracted.risks?.length > 0 && existingRisks.length === 0) {
      onSheetUpdate("05", { risks: extracted.risks.map((r,i) => ({
        _id:`R-${String(101+i)}`, name:r.name||"", cause:r.cause||"",
        potentialImpact:r.potentialImpact||"", likelihood:r.likelihood||"2",
        impact:r.impact||"2", response:r.response||"Reduce", mitigation:r.mitigation||"", category:r.category||"",
      }))}, "ai-draft");
    }

    if (tier === "full") {
      const existingSH = sheets["08"]?.data?.stakeholders || [];
      if (extracted.stakeholders?.length > 0 && existingSH.length === 0) {
        onSheetUpdate("08", { stakeholders: extracted.stakeholders.map((s,i) => ({
          _id:`SH-${String(i+1).padStart(3,"0")}`, name:s.name||"", category:s.category||"",
          power:parseInt(s.power)||5, interest:parseInt(s.interest)||5, influence:parseInt(s.influence)||5,
          ease:5, engagementStrategy:s.engagementStrategy||"",
        }))}, "ai-draft");
      }
      const existingDels = sheets["07"]?.data?.deliverables || [];
      if (extracted.deliverables?.length > 0 && existingDels.length === 0) {
        onSheetUpdate("07", { deliverables: extracted.deliverables.map((d,i) => ({
          _id:`D-${String(i+1).padStart(3,"0")}`, name:d.name||"", phase:d.phase||"",
          deadlineV1:d.targetDate||"", notes:"", kpis:[], linkedObjectiveId:"", priority:d.priority||"",
        }))}, "ai-draft");
      }
    }

    // Feed summary into Q&A context for smarter next questions
    setQaMessages(prev => [...prev, {
      role:"system",
      text:`✓ Extracted from ${source}: ${[
        extracted.charter?.projectName && `Project "${extracted.charter.projectName}"`,
        extracted.team?.length && `${extracted.team.length} team members`,
        extracted.activities?.length && `${extracted.activities.length} activities`,
        extracted.risks?.length && `${extracted.risks.length} risks`,
        extracted.stakeholders?.length && `${extracted.stakeholders.length} stakeholders`,
      ].filter(Boolean).join(", ")}`,
    }]);
  };

  // ── Sheet navigation with dirty check ────────────────────────────────────
  const navigateToSheet = (id) => {
    if (id === activeSheet) return;
    if (dirtySheet) {
      setSavingPrompt(id);
    } else {
      setActiveSheet(id);
      onSheetNav(id);
    }
  };

  const confirmSave = () => {
    if (savingPrompt) {
      onSheetApprove(activeSheet);
      setActiveSheet(savingPrompt);
      onSheetNav(savingPrompt);
    }
    setSavingPrompt(null);
    setDirtySheet(false);
  };

  const discardAndNav = () => {
    if (savingPrompt) {
      setActiveSheet(savingPrompt);
      onSheetNav(savingPrompt);
    }
    setSavingPrompt(null);
    setDirtySheet(false);
  };

  // ── Role popup ─────────────────────────────────────────────────────────────
  const ROLE_GROUPS = [
    { label:"Governance & Leadership", roles:[
      "Project Sponsor","Senior Responsible Owner","Executive Steering Committee Member",
      "Programme Manager","Portfolio Manager","Project Board Member","Client Representative",
      "Independent Assessor","Project Auditor",
    ]},
    { label:"Project Management", roles:[
      "Assistant Project Manager","Project Coordinator","Project Scheduler",
      "Project Controller","Planning Engineer","Project Administrator",
      "Document Controller","Configuration Manager","Project Support Officer",
    ]},
    { label:"Risk, Change & Quality", roles:[
      "Risk Owner","Risk Manager","Change Manager","Change Control Officer",
      "Quality Assurance Lead","Quality Manager","Compliance Officer",
      "Health & Safety Advisor","Environmental Advisor",
    ]},
    { label:"Technical & Delivery", roles:[
      "Technical Lead","Systems Engineer","Design Manager","Architect",
      "Software Developer","Data Analyst","IT Lead","Infrastructure Lead",
      "Construction Manager","Site Manager","Quantity Surveyor",
      "Structural Engineer","Civil Engineer","Mechanical Engineer",
      "Electrical Engineer","BIM Manager","Testing Lead",
    ]},
    { label:"Business & Finance", roles:[
      "Finance Lead","Budget Manager","Financial Analyst","Procurement Lead",
      "Commercial Manager","Contracts Manager","Business Analyst",
      "Benefits Realisation Manager","Business Change Manager",
    ]},
    { label:"People & Communications", roles:[
      "Communications Lead","Stakeholder Liaison","Public Relations Manager",
      "Community Engagement Officer","Marketing Lead","Training Lead",
      "Organisational Development Lead","HR Business Partner",
    ]},
    { label:"Research & Knowledge", roles:[
      "Research Coordinator","Research Lead","Knowledge Manager",
      "Subject Matter Expert","Academic Advisor","Data Manager",
      "Monitoring & Evaluation Lead","Impact Assessor",
    ]},
    { label:"Legal & External", roles:[
      "Legal Advisor","Legal Counsel","Contract Advisor","Regulatory Advisor",
      "Planning Consultant","External Consultant","Third Party Representative",
      "Supplier Manager","Partner Liaison",
    ]},
  ];

  const [customRoleInput, setCustomRoleInput] = useState("");
  const [customRoles,     setCustomRoles]     = useState([]);
  const [aiRoleSuggestions, setAiRoleSuggestions] = useState([]);
  const [rolesAiLoading,    setRolesAiLoading]    = useState(false);

  const allAvailableRoles = [
    ...ROLE_GROUPS.flatMap(g => g.roles),
    ...customRoles,
  ];

  const toggleRole = (role) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const addCustomRole = () => {
    const r = customRoleInput.trim();
    if (!r || allAvailableRoles.includes(r) || r === "Project Manager") return;
    setCustomRoles(prev => [...prev, r]);
    setSelectedRoles(prev => [...prev, r]);
    setCustomRoleInput("");
  };

  // Fire AI suggestions immediately when popup opens
  useEffect(() => {
    if (!showRolePopup) return;
    const ctx = buildSheetContext();
    const hasContext = ctx.projectName || ctx.purpose || (sheets["01"]?.data?.charter?.projectName);
    if (!hasContext) return;
    setRolesAiLoading(true);
    setAiStatus("Analysing project context for role suggestions…");
    callExtract([{ role:"user", content:
      `You are a project management expert. Based on this project context, suggest the most relevant team roles.
Project: ${ctx.projectName || "Unknown"}
Purpose: ${ctx.purpose || "Not specified"}
Tier: ${tier}

Return ONLY valid JSON, no markdown, no preamble:
{"suggestions":["Role 1","Role 2","Role 3","Role 4","Role 5"],"rationale":"one sentence explaining why these roles fit this project"}

Choose from roles typical for this type of project. Max 6 suggestions. Do not include Project Manager.`
    }], 400)
      .then(raw => {
        try {
          const parsed = safeParseJSON(raw);
          setAiRoleSuggestions(parsed.suggestions || []);
        } catch(e) { setAiRoleSuggestions([]); }
      })
      .catch(() => setAiRoleSuggestions([]))
      .finally(() => { setRolesAiLoading(false); setAiStatus(""); });
  }, [showRolePopup]);

  const confirmRoles = async () => {
    if (!selectedRoles.length) return;
    setShowRolePopup(false);
    setBlurLifted(true);
    setAiStatus("Generating team structure from selected roles…");

    // Build team members from selected roles — PM always first
    const ordered = ["Project Manager", ...selectedRoles.filter(r => r !== "Project Manager")];
    const { generateLoginCode } = await import("../store/appStore.js");
    const existingCodes = (l2?.loginCodes || []).map(m => m.loginCode);

    // Pre-fill names from any already-extracted charter context
    const charter = sheets["01"]?.data?.charter || {};
    const knownNames = {
      "Project Manager": charter.projectManager || "",
      "Project Sponsor":  charter.projectSponsor  || "",
    };

    const newMembers = ordered.map((role, i) => {
      const code = generateLoginCode(project?.code || "NC", [...existingCodes]);
      existingCodes.push(code);
      return {
        _id:              `TM-${String(i+1).padStart(3,"0")}`,
        loginCode:        code,
        name:             knownNames[role] || "",
        role,
        deliveryRole:     "",
        availability:     "",
        location:         "",
        responsibilities: "",
        isPM:             role === "Project Manager",
      };
    });

    // Write to sheet 02
    const existingTeam = sheets["02"]?.data?.teamMembers || [];
    if (existingTeam.length === 0) {
      onSheetUpdate("02", { teamMembers: newMembers }, "ai-draft");
    }

    // Write all generated login codes into l2.loginCodes so L3 can read them
    newMembers.forEach(m => {
      onSheetUpdate("__loginCode__", {}, "empty", {
        loginCode: m.loginCode,
        name:      m.name,
        role:      m.role,
        isPM:      m.isPM,
      });
    });

    // Write role list to charter as a hint
    const existingCharter = sheets["01"]?.data?.charter || {};
    if (!existingCharter.teamRoles) {
      onSheetUpdate("01", { charter: { ...existingCharter, teamRoles: ordered.join(", ") } }, "ai-draft");
    }

    // If document context exists, ask AI to suggest names for blank roles
    const hasDocContext = (sheets["03"]?.data?.activities||[]).length > 0 ||
                          (sheets["05"]?.data?.risks||[]).length > 0 ||
                          charter.purpose;
    const blankRoles = ordered.filter(r => !knownNames[r]);

    if (hasDocContext && blankRoles.length > 0) {
      setAiStatus("Checking document context for team name suggestions…");
      try {
        const prompt = `A project manager is setting up a project team. Based on the project context below, suggest realistic placeholder names or leave blank if truly unknown.
Project: ${charter.projectName || "Unknown"}
Purpose: ${charter.purpose || "Not specified"}
Known team: PM is ${charter.projectManager || "unknown"}, Sponsor is ${charter.projectSponsor || "unknown"}
Roles needing names: ${blankRoles.join(", ")}

Return ONLY valid JSON, no markdown:
{"names":{"Role Name":"Suggested Name or empty string"}}
Only suggest a name if you have reasonable context to infer it. Otherwise return empty string.`;

        const raw = await callExtract([{ role:"user", content:prompt }], 400);
        try {
          const parsed = safeParseJSON(raw);
          if (parsed.names) {
            const updatedTeam = newMembers.map(m => ({
              ...m,
              name: m.name || parsed.names[m.role] || "",
            }));
            onSheetUpdate("02", { teamMembers: updatedTeam }, "ai-draft");
          }
        } catch(e) { /* ignore parse failure — blank names are fine */ }
      } catch(e) { /* ignore AI failure */ }
    }

    setAiStatus("");
    // Navigate to Team sheet so PM sees the populated rows immediately
    setActiveSheet("02");
    onSheetNav("02");
    // Kick off Q&A now that roles are known
    if (qaMessages.length === 0) askQuestion(0);
  };
  if (!tier) return <TierSelect
    onSelect={(t) => onSheetUpdate("__tier__", {}, "empty", t)}
    onBack={onLogout}/>;

  // ── After tier: PM name + project details screen ──────────────────────────
  const pmAlreadySet = (l2?.loginCodes||[]).some(m => m.isPM || m.role === "Project Manager");
  if (!pmAlreadySet && !isExisting) {
    return (
      <PMSetup
        tier={tier}
        onBack={() => onSheetUpdate("__tier__", {}, "empty", null)}
        onConfirm={({ projectName, projectCode, pmName, loginCode }) => {
          // Write project meta
          onSheetUpdate("__projectMeta__", {}, "empty", { projectName, projectCode });
          // Write PM into Sheet 02 team members
          onSheetUpdate("02", {
            teamMembers: [{
              _id: "TM-001",
              loginCode,
              name: pmName,
              role: "Project Manager",
              deliveryRole: "",
              availability: "",
              location: "",
              responsibilities: "",
              isPM: true,
            }]
          }, "in-progress");
          // Write PM name + project details into Sheet 01 charter
          const charter = sheets["01"]?.data?.charter || {};
          onSheetUpdate("01", {
            charter: {
              ...charter,
              projectName,
              projectCode,
              projectManager: pmName,
            }
          }, sheets["01"]?.status || "in-progress");
          // Write login code into l2.loginCodes
          onSheetUpdate("__loginCode__", {}, "empty", { loginCode, name: pmName, role:"Project Manager", isPM:true });
        }}/>
    );
  }

  const activeSheets  = tierCfg.sheets;
  const SheetComp     = SHEET_COMPONENTS[activeSheet];
  const approvedCount = Object.values(sheets).filter(s => s.locked).length;
  const l3Unlocked    = approvedCount > 0 && (l2?.loginCodes||[]).length > 0;

  const inp = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:5,
    color:C.sage, fontSize:11, padding:"7px 9px", outline:"none", width:"100%",
    boxSizing:"border-box", fontFamily:"inherit" };

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden", height:"100%" }}>

      {/* ── Progress bar ── */}
      <div style={{ background:C.surface2, borderBottom:`1px solid ${C.border}`, padding:"8px 20px", flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, marginBottom:5 }}>
          <span>Project setup — <strong style={{ color:C.accentL }}>{tierCfg.label}</strong> tier</span>
          <span style={{ color:C.dim }}>{approvedCount} of {activeSheets.length} sheets saved</span>
        </div>
        <div style={{ display:"flex", gap:3 }}>
          {activeSheets.map(id => {
            const st = sheets[id]?.status || "empty";
            const col = st==="approved"?"#3ae0a2":st==="ai-draft"?"#3a9ce0":st==="in-progress"?"#e0a23a":C.border;
            return (
              <div key={id} onClick={() => navigateToSheet(id)}
                title={SHEET_LABELS[id]}
                style={{ flex:1, height:5, borderRadius:3, background:col, opacity: activeSheet===id?1:0.5,
                  outline: activeSheet===id?`2px solid ${C.accentL}`:"none", outlineOffset:1,
                  cursor:"pointer" }}/>
            );
          })}
        </div>
      </div>

      {/* ── Three-column body ── */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* ════════ LEFT SIDEBAR ════════ */}
        <div style={{ width:380, minWidth:360, borderRight:`1px solid ${C.border}`,
          display:"flex", flexDirection:"column", overflow:"hidden", flexShrink:0, background:C.surface }}>

          {/* Tier badge */}
          <div style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, flexShrink:0,
            display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:14 }}>{tierCfg.icon}</span>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:C.sage }}>{tierCfg.label} Project</div>
              <div style={{ fontSize:9, color:C.muted }}>Tier locked</div>
            </div>
          </div>

          {/* ── Document Intelligence (top half of sidebar) ── */}
          <div style={{ flexShrink:0, borderBottom:`1px solid ${C.border}`, padding:"10px 14px" }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase",
              letterSpacing:".6px", marginBottom:8 }}>Document Intelligence</div>

            {/* Upload / Paste toggle */}
            <div style={{ display:"flex", gap:4, marginBottom:8 }}>
              {["file","text"].map(m => (
                <button key={m} onClick={() => setUploadMode(m)}
                  style={{ flex:1, padding:"4px", fontSize:10, fontWeight:700, border:`1px solid ${uploadMode===m?C.accent:C.border}`,
                    borderRadius:4, background:uploadMode===m?C.accent+"22":"none", color:uploadMode===m?C.accentL:C.muted, cursor:"pointer" }}>
                  {m==="file" ? "📎 Upload" : "✏️ Paste"}
                </button>
              ))}
            </div>

            {uploadMode === "file" ? (
              <div>
                <label style={{ display:"block", padding:"10px", border:`1px dashed ${C.border}`,
                  borderRadius:6, cursor:"pointer", textAlign:"center", fontSize:11, color:C.muted,
                  background:C.surface2 }}>
                  <input type="file" multiple accept=".docx,.xlsx,.xls,.pdf,.txt,.csv"
                    onChange={handleFileUpload} style={{ display:"none" }}/>
                  {extracting ? <span style={{ color:C.accentL }}>⚡ Extracting…</span>
                    : "Drop files or click\n.docx .xlsx .pdf .txt"}
                </label>
                {fileList.length > 0 && (
                  <div style={{ marginTop:6 }}>
                    {fileList.map((f,i) => (
                      <div key={i} style={{ fontSize:10, color:C.accentL, padding:"2px 0",
                        display:"flex", alignItems:"center", gap:4 }}>
                        <span style={{ color:C.activity }}>✓</span>{f}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
                  placeholder="Paste project notes, brief, or any text…"
                  style={{ ...inp, minHeight:80, resize:"none", fontSize:11, lineHeight:1.5 }}/>
                <button onClick={handleTextExtract} disabled={!pasteText.trim()||extracting}
                  style={{ width:"100%", marginTop:6, padding:"6px", background:pasteText.trim()&&!extracting?C.accent:"#1F4D34",
                    border:"none", borderRadius:5, color:"#fff", fontSize:11, fontWeight:700,
                    cursor:pasteText.trim()&&!extracting?"pointer":"not-allowed" }}>
                  ⚡ Extract
                </button>
              </div>
            )}

            {extractMsg && (
              <div style={{ marginTop:6, fontSize:10, color:extractMsg.startsWith("⚠")?C.risk:C.accentL,
                lineHeight:1.4 }}>{extractMsg}</div>
            )}
          </div>

          {/* ── AI Q&A Engine (bottom half of sidebar) ── */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ padding:"8px 14px 4px", fontSize:10, fontWeight:700, color:C.muted,
              textTransform:"uppercase", letterSpacing:".6px", flexShrink:0 }}>
              AI Setup Assistant
            </div>

            {/* Message thread */}
            <div style={{ flex:1, overflowY:"auto", padding:"4px 14px" }}>
              {qaMessages.map((msg, i) => {
                if (msg.role === "system") return (
                  <div key={i} style={{ fontSize:10, color:C.accentL, padding:"4px 0",
                    borderBottom:`1px solid ${C.border}22`, marginBottom:4 }}>
                    {msg.text}
                  </div>
                );
                if (msg.role === "user") return (
                  <div key={i} style={{ background:C.surface2, borderRadius:6, padding:"7px 10px",
                    marginBottom:8, fontSize:11, color:C.dim }}>
                    {msg.text}
                  </div>
                );
                if (msg.text) return (
                  <div key={i} style={{ fontSize:11, color:C.dim, marginBottom:8, lineHeight:1.5 }}>
                    {msg.text}
                  </div>
                );
                // Structured Q&A message
                return (
                  <div key={i} style={{ background:C.surface2, border:`1px solid ${C.border}`,
                    borderRadius:7, padding:"10px 12px", marginBottom:10 }}>
                    <div style={{ fontSize:11, color:C.sage, fontWeight:600, marginBottom:6, lineHeight:1.4 }}>
                      {msg.question}
                    </div>
                    {msg.accepted ? (
                      <div style={{ fontSize:10, color:C.activity, display:"flex", gap:4, alignItems:"center" }}>
                        <span>✓</span>
                        <span style={{ color:C.dim }}>{msg.userEdit || msg.recommendation}</span>
                      </div>
                    ) : (
                      <>
                        {msg.recommendation && (
                          <div style={{ background:C.surface, borderRadius:5, padding:"6px 8px", marginBottom:6,
                            fontSize:10, color:C.dim, lineHeight:1.5, border:`1px solid ${C.border}` }}>
                            <span style={{ color:C.accentL, fontWeight:700, marginRight:4 }}>Suggestion:</span>
                            {msg.recommendation}
                          </div>
                        )}
                        {msg.rationale && (
                          <div style={{ fontSize:9, color:C.muted, marginBottom:6, fontStyle:"italic" }}>
                            {msg.rationale}
                          </div>
                        )}
                        {msg.error && (
                          <div style={{ fontSize:10, color:C.risk, marginBottom:6 }}>⚠ {msg.error}</div>
                        )}
                        <textarea
                          value={msg.userEdit}
                          onChange={e => handleEdit(i, e.target.value)}
                          placeholder="Accept or type your own answer…"
                          style={{ ...inp, minHeight:48, resize:"none", marginBottom:6, fontSize:10 }}/>
                        <div style={{ display:"flex", gap:5 }}>
                          <button onClick={() => handleAccept(i)}
                            style={{ flex:1, padding:"5px", background:C.accent, border:"none",
                              borderRadius:4, color:"#fff", fontSize:10, fontWeight:700, cursor:"pointer" }}>
                            ✓ Accept
                          </button>
                          {msg.userEdit && (
                            <button onClick={() => handleSubmitEdit(i)}
                              style={{ flex:1, padding:"5px", background:C.surface, border:`1px solid ${C.accentL}`,
                                borderRadius:4, color:C.accentL, fontSize:10, fontWeight:700, cursor:"pointer" }}>
                              ✎ Use mine
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {qaLoading && (
                <div style={{ fontSize:10, color:C.muted, padding:"6px 0", display:"flex", gap:6, alignItems:"center" }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:C.accentL,
                    animation:"pulse 1.2s ease-in-out infinite" }}/>
                  AI thinking…
                </div>
              )}
              <div ref={qaBottomRef}/>
            </div>

            {/* Free-text input */}
            <div style={{ padding:"8px 14px", borderTop:`1px solid ${C.border}`, flexShrink:0,
              display:"flex", gap:6 }}>
              <input value={qaInput} onChange={e => setQaInput(e.target.value)}
                onKeyDown={e => e.key==="Enter" && !e.shiftKey && handleFreeInput()}
                placeholder="Add more project info…"
                style={{ ...inp, flex:1 }}/>
              <button onClick={handleFreeInput} disabled={!qaInput.trim()||qaLoading}
                style={{ padding:"5px 10px", background:qaInput.trim()&&!qaLoading?C.accent:"#1F4D34",
                  border:"none", borderRadius:4, color:"#fff", fontSize:12, cursor:"pointer" }}>→</button>
            </div>
          </div>

          {/* Logout */}
          {onLogout && (
            <div style={{ padding:"10px 14px", borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
              <button onClick={onLogout}
                style={{ width:"100%", padding:"6px", background:"none", border:`1px solid ${C.border}`,
                  borderRadius:5, color:C.muted, fontSize:11, cursor:"pointer" }}>
                ← Log out
              </button>
            </div>
          )}
        </div>

        {/* ════════ MAIN AREA — L2 Sheets ════════ */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>

          {/* ── AI Status bar — always visible, passive when idle ── */}
          <div style={{ background: aiStatus ? "rgba(58,153,98,0.12)" : "rgba(18,46,30,0.6)",
            borderBottom:`1px solid ${aiStatus ? C.accentL+"44" : C.border}`,
            padding:"4px 16px", fontSize:10,
            color: aiStatus ? C.accentL : C.muted,
            display:"flex", alignItems:"center", gap:8, flexShrink:0,
            transition:"all .3s", minHeight:24 }}>
            <div style={{ width:6, height:6, borderRadius:"50%",
              background: aiStatus ? C.accentL : C.muted,
              animation: aiStatus ? "pulse 1.2s ease-in-out infinite" : "none",
              flexShrink:0, transition:"background .3s" }}/>
            {aiStatus || "AI assistant ready"}
          </div>

          {/* Sheet tabs */}
          <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`,
            background:C.surface2, overflowX:"auto", flexShrink:0 }}>
            {activeSheets.map(id => {
              const st  = sheets[id]?.status || "empty";
              const dot = st==="approved"?"#3ae0a2":st==="ai-draft"?"#3a9ce0":st==="in-progress"?"#e0a23a":C.border;
              const active = id === activeSheet;
              return (
                <button key={id} onClick={() => navigateToSheet(id)}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"0 14px", height:40,
                    fontSize:11, fontWeight:600, background:"none", border:"none",
                    borderBottom:`2px solid ${active?C.accentL:"transparent"}`,
                    color:active?C.sage:C.muted, cursor:"pointer", whiteSpace:"nowrap",
                    transition:"all .15s" }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:dot, flexShrink:0 }}/>
                  {SHEET_LABELS[id]}
                  {sheets[id]?.locked && <span style={{ fontSize:9, color:C.accentL }}>✓</span>}
                </button>
              );
            })}
          </div>

          {/* Sheet header */}
          <div style={{ padding:"10px 20px", borderBottom:`1px solid ${C.border}`,
            display:"flex", alignItems:"center", gap:10, flexShrink:0, background:C.surface }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.sage }}>{SHEET_LABELS[activeSheet]}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>
                {sheets[activeSheet]?.status === "ai-draft" && "✨ AI-populated — review and adjust"}
                {sheets[activeSheet]?.status === "approved" && "✓ Saved"}
                {(!sheets[activeSheet]?.status || sheets[activeSheet]?.status === "empty") && "Empty — fill in or use document upload"}
              </div>
            </div>
            {sheets[activeSheet]?.locked ? (
              <button onClick={() => onSheetUnlock(activeSheet)}
                style={{ padding:"6px 12px", background:"none", border:`1px solid ${C.border}`,
                  borderRadius:5, color:C.dim, fontSize:11, cursor:"pointer" }}>
                Unlock to Edit
              </button>
            ) : (
              <button onClick={() => { onSheetApprove(activeSheet); setDirtySheet(false); }}
                style={{ padding:"6px 14px", background:C.accent, border:"none",
                  borderRadius:5, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                Save Changes
              </button>
            )}
            {/* Launch only visible for existing projects */}
            {isExisting && (
              <button onClick={onLaunch}
                style={{ padding:"6px 14px", background:"#2E7D52", border:"none", borderRadius:5,
                  color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                Launch Project →
              </button>
            )}
          </div>

          {/* Sheet content */}
          <div style={{ flex:1, overflowY:"auto", padding:"20px" }}
            onChange={() => setDirtySheet(true)}>
            {SheetComp && (
              <SheetComp
                data={sheets[activeSheet]?.data || {}}
                locked={sheets[activeSheet]?.locked || false}
                l1={l1}
                project={project}
                loginCodes={l2?.loginCodes || []}
                allSheets={sheets}
                onUpdate={(data, status) => {
                  setDirtySheet(true);
                  onSheetUpdate(activeSheet, data, status);
                  // ── Charter → Team sync ──────────────────────────────────
                  // When PM name is set/changed in Sheet 01, mirror it into
                  // the Project Manager row in Sheet 02.
                  // PM edit on Sheet 02 always wins — only sync if the team
                  // row name is still blank or matches the previous charter value.
                  if (activeSheet === "01" && data?.charter?.projectManager !== undefined) {
                    const newPMName  = data.charter.projectManager;
                    const oldPMName  = sheets["01"]?.data?.charter?.projectManager || "";
                    const teamMembers = sheets["02"]?.data?.teamMembers || [];
                    const pmIdx      = teamMembers.findIndex(
                      m => m.isPM || m.role === "Project Manager"
                    );
                    if (pmIdx !== -1) {
                      const pmRow = teamMembers[pmIdx];
                      // Only overwrite if team name is blank or still equals old charter value
                      const canSync = !pmRow.name || pmRow.name === oldPMName;
                      if (canSync && newPMName) {
                        const updatedTeam = teamMembers.map((m, i) =>
                          i === pmIdx ? { ...m, name: newPMName } : m
                        );
                        onSheetUpdate("02", { teamMembers: updatedTeam }, sheets["02"]?.status || "ai-draft");
                      }
                    }
                  }
                  // ── Team PM name → Charter sync ──────────────────────────
                  // When PM name is edited directly in Sheet 02, mirror it
                  // back into charter.projectManager if charter field is blank
                  // or still matches the old team value.
                  if (activeSheet === "02" && data?.teamMembers) {
                    const pmRow      = data.teamMembers.find(m => m.isPM || m.role === "Project Manager");
                    const charter    = sheets["01"]?.data?.charter || {};
                    const oldTeamPM  = sheets["02"]?.data?.teamMembers?.find(m => m.isPM || m.role === "Project Manager")?.name || "";
                    if (pmRow?.name && (!charter.projectManager || charter.projectManager === oldTeamPM)) {
                      onSheetUpdate("01", { charter: { ...charter, projectManager: pmRow.name } }, sheets["01"]?.status || "in-progress");
                    }
                  }
                }}/>
            )}
          </div>

          {/* ── Blur overlay — new projects only, lifts after role selection ── */}
          {/* position:absolute covers only this right panel div, not the left sidebar */}
          {!blurLifted && (
            <div style={{ position:"absolute", inset:0, zIndex:10,
              backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)",
              background:"rgba(13,43,27,0.60)",
              display:"flex", alignItems:"center", justifyContent:"center",
              pointerEvents:"all" }}>
              <div onClick={e => e.stopPropagation()}
                style={{ background:C.surface, border:`1px solid ${C.accentL}44`, borderRadius:12,
                padding:"28px 32px", maxWidth:380, width:"90%", textAlign:"center",
                boxShadow:"0 12px 40px rgba(0,0,0,0.5)" }}>
                <div style={{ fontSize:28, marginBottom:12 }}>🏗️</div>
                <div style={{ fontSize:15, fontWeight:700, color:C.sage, marginBottom:8 }}>
                  Start your Project Setup
                </div>
                <div style={{ fontSize:12, color:C.muted, lineHeight:1.6, marginBottom:8 }}>
                  Use the left panel to upload documents or let AI guide you through setup.
                </div>
                <div style={{ fontSize:11, color:C.dim, lineHeight:1.5, marginBottom:20,
                  background:C.surface2, borderRadius:6, padding:"8px 12px",
                  border:`1px solid ${C.border}` }}>
                  First, tell us who's on your team — this will pre-populate the Team and Charter sheets.
                </div>
                <button onClick={() => setShowRolePopup(true)}
                  style={{ width:"100%", padding:"12px", background:C.accent, border:"none",
                    borderRadius:7, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer",
                    boxShadow:`0 4px 16px ${C.accent}44` }}>
                  Select Team Roles to Begin →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Save Changes prompt ── */}
      {savingPrompt && (
        <div onClick={discardAndNav}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200,
            display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
              padding:24, maxWidth:360, width:"90%", boxShadow:"0 8px 32px #0008" }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.sage, marginBottom:6 }}>Save Changes?</div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:18, lineHeight:1.6 }}>
              You have unsaved changes on <strong style={{ color:C.dim }}>{SHEET_LABELS[activeSheet]}</strong>.
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <button onClick={confirmSave}
                style={{ padding:"9px 14px", background:C.accent, border:"none", borderRadius:6,
                  color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                💾 Save Changes
              </button>
              <button onClick={discardAndNav}
                style={{ padding:"9px 14px", background:"none", border:`1px solid ${C.risk}22`,
                  borderRadius:6, color:C.muted, fontSize:12, cursor:"pointer" }}>
                Discard & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Role Selection Popup ── */}
      {showRolePopup && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:300,
          display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
            width:"100%", maxWidth:640, maxHeight:"88vh",
            display:"flex", flexDirection:"column", boxShadow:"0 12px 40px rgba(0,0,0,0.5)" }}>

            {/* Header */}
            <div style={{ padding:"20px 24px 14px", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
              <div style={{ fontSize:15, fontWeight:700, color:C.sage, marginBottom:4 }}>Who's on your team?</div>
              <div style={{ fontSize:12, color:C.muted, lineHeight:1.5 }}>
                Select all roles involved. One team member slot is created per role — you can add more people in the Team sheet.
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ flex:1, overflowY:"auto", padding:"14px 24px" }}>

              {/* AI Suggestions */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.accentL, textTransform:"uppercase",
                  letterSpacing:".5px", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:C.accentL,
                    display:"inline-block", animation: rolesAiLoading?"pulse 1.2s ease-in-out infinite":"none" }}/>
                  {rolesAiLoading ? "AI analysing your project…" : aiRoleSuggestions.length > 0 ? "✨ Suggested for this project" : "✨ AI Suggestions"}
                </div>
                {rolesAiLoading ? (
                  <div style={{ fontSize:11, color:C.muted, fontStyle:"italic", padding:"6px 0" }}>
                    Analysing project context…
                  </div>
                ) : aiRoleSuggestions.length > 0 ? (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                    {aiRoleSuggestions.map(role => {
                      const sel = selectedRoles.includes(role);
                      return (
                        <button key={role} onClick={() => toggleRole(role)}
                          style={{ padding:"6px 13px", borderRadius:20, fontSize:11, fontWeight:600,
                            border:`1px solid ${sel ? C.accentL : C.accentL+"66"}`,
                            background: sel ? C.accentL+"33" : C.accentL+"11",
                            color: sel ? C.accentL : C.dim,
                            cursor:"pointer", transition:"all .15s" }}>
                          {sel ? "✓ " : "✨ "}{role}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize:11, color:C.muted, fontStyle:"italic" }}>
                    Upload a document or enter project details to get AI role suggestions.
                  </div>
                )}
              </div>

              {/* Project Manager — always locked */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase",
                  letterSpacing:".5px", marginBottom:8 }}>Always Included</div>
                <div style={{ display:"inline-flex", alignItems:"center", padding:"6px 13px",
                  borderRadius:20, fontSize:11, fontWeight:600, border:`1px solid ${C.accentL}`,
                  background:C.accentL+"22", color:C.accentL }}>
                  🔒 Project Manager
                </div>
              </div>

              {/* Categorised role groups */}
              {ROLE_GROUPS.map(group => (
                <div key={group.label} style={{ marginBottom:14 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase",
                    letterSpacing:".5px", marginBottom:8 }}>{group.label}</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {group.roles.map(role => {
                      const sel = selectedRoles.includes(role);
                      return (
                        <button key={role} onClick={() => toggleRole(role)}
                          style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontWeight:600,
                            border:`1px solid ${sel ? C.accentL : C.border}`,
                            background: sel ? C.accentL+"22" : "none",
                            color: sel ? C.accentL : C.muted,
                            cursor:"pointer", transition:"all .15s" }}>
                          {sel ? "✓ " : "+ "}{role}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Custom roles */}
              {customRoles.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase",
                    letterSpacing:".5px", marginBottom:8 }}>Your Custom Roles</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {customRoles.map(role => {
                      const sel = selectedRoles.includes(role);
                      return (
                        <button key={role} onClick={() => toggleRole(role)}
                          style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontWeight:600,
                            border:`1px solid ${sel ? C.milestone : C.border}`,
                            background: sel ? C.milestone+"22" : "none",
                            color: sel ? C.milestone : C.muted,
                            cursor:"pointer", transition:"all .15s" }}>
                          {sel ? "✓ " : "+ "}{role}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add custom role */}
              <div style={{ marginBottom:4 }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase",
                  letterSpacing:".5px", marginBottom:8 }}>Add a Role Not Listed</div>
                <div style={{ display:"flex", gap:6 }}>
                  <input value={customRoleInput} onChange={e => setCustomRoleInput(e.target.value)}
                    onKeyDown={e => e.key==="Enter" && addCustomRole()}
                    placeholder="e.g. Community Health Worker, Watershed Engineer…"
                    style={{ flex:1, background:C.surface2, border:`1px solid ${C.border}`,
                      borderRadius:5, color:C.sage, fontSize:11, padding:"7px 10px",
                      outline:"none", fontFamily:"inherit" }}/>
                  <button onClick={addCustomRole} disabled={!customRoleInput.trim()}
                    style={{ padding:"7px 14px", background: customRoleInput.trim()?C.accent:"#1F4D34",
                      border:"none", borderRadius:5, color:"#fff", fontSize:11,
                      fontWeight:700, cursor: customRoleInput.trim()?"pointer":"not-allowed" }}>
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding:"14px 24px", borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:12 }}>
                <strong style={{ color:C.accentL }}>{selectedRoles.length + 1}</strong> role{selectedRoles.length !== 0 ? "s" : ""} selected
                {selectedRoles.length > 0 && (
                  <span style={{ color:C.dim }}> — Project Manager
                    {selectedRoles.slice(0,4).map(r => `, ${r}`)}
                    {selectedRoles.length > 4 ? ` +${selectedRoles.length - 4} more` : ""}
                  </span>
                )}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setShowRolePopup(false)}
                  style={{ flex:1, padding:"10px", background:"none", border:`1px solid ${C.border}`,
                    borderRadius:6, color:C.muted, fontSize:12, cursor:"pointer" }}>
                  Cancel
                </button>
                <button onClick={confirmRoles} disabled={selectedRoles.length === 0}
                  style={{ flex:2, padding:"10px",
                    background: selectedRoles.length > 0 ? C.accent : "#1F4D34",
                    border:"none", borderRadius:6, color:"#fff", fontSize:12, fontWeight:700,
                    cursor: selectedRoles.length > 0 ? "pointer" : "not-allowed" }}>
                  Confirm {selectedRoles.length + 1} Roles & Begin Setup →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
    </div>
  );
}
