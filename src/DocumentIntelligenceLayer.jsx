import { useState, useRef } from "react";
import mammoth from "mammoth";

const COLORS = {
  bg: "#0D2B1B", surface: "#122E1E", surface2: "#183D28", border: "#1F4D34",
  accent: "#2E7D52", accentLight: "#3a9962",
  sage: "#E5F0E8", sageDim: "#b8d4c0", textDim: "#8aac96", textMuted: "#5a7a66",
  risk: "#e05c5c", milestone: "#e0a23a", deliverable: "#3a9ce0",
  stakeholder: "#9c6ee0", activity: "#3ae0a2", issue: "#e06e3a", charter: "#f0c060",
};

const S = {
  page: { background: COLORS.bg, color: COLORS.sage, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: 13, minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" },
  header: { background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  logo: { width: 28, height: 28, background: COLORS.accent, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 },
  pipeline: { background: COLORS.surface2, borderBottom: `1px solid ${COLORS.border}`, padding: "8px 20px", display: "flex", alignItems: "center", gap: 4, flexShrink: 0, overflowX: "auto" },
  body: { display: "flex", flex: 1, overflow: "hidden", position: "relative" },
  left: { width: 300, minWidth: 260, borderRight: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", flexShrink: 0 },
  right: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  panelHdr: { padding: "10px 14px 8px", fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: ".8px", borderBottom: `1px solid ${COLORS.border}` },
  tabRow: { display: "flex", borderBottom: `1px solid ${COLORS.border}` },
  tabContent: { display: "flex", flex: 1, flexDirection: "column", padding: 14, overflowY: "auto", gap: 10 },
  dropZone: { border: `2px dashed ${COLORS.border}`, borderRadius: 7, padding: "24px 12px", textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  fieldLabel: { fontSize: 10, fontWeight: 700, color: COLORS.textDim, display: "block", marginBottom: 4 },
  fieldInput: { width: "100%", background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.sage, fontSize: 11, padding: "7px 9px", outline: "none", boxSizing: "border-box" },
  analyseBtn: { margin: "12px 14px", padding: 10, background: COLORS.accent, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, flexShrink: 0 },
  regTabs: { display: "flex", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface2, overflowX: "auto", flexShrink: 0 },
  toolbar: { padding: "8px 14px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" },
  scroll: { flex: 1, overflowY: "auto", padding: 14 },
  statsBar: { padding: "7px 14px", background: COLORS.surface2, borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: 16, fontSize: 10, color: COLORS.textMuted, flexShrink: 0, flexWrap: "wrap" },
  card: { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "11px 13px", marginBottom: 8, display: "flex", gap: 10, alignItems: "flex-start" },
  charterGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 },
  charterField: { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "10px 12px" },
  loadingOverlay: { position: "absolute", inset: 0, background: "rgba(13,43,27,0.92)", zIndex: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 },
};

const REG_KEYS = ["charter","risk","stakeholder","deliverable","activity","milestone","issue","constraint"];
const REG_LABELS = { charter:"Charter", risk:"Risks", stakeholder:"Stakeholders", deliverable:"Deliverables", activity:"Activities", milestone:"Milestones", issue:"Issues", constraint:"Constraints" };
const REG_ICONS = { charter:"📋", risk:"⚠️", stakeholder:"👤", deliverable:"📦", activity:"⚙️", milestone:"🏁", issue:"🚨", constraint:"🔒" };
const LIST_KEY = { risk:"risks", stakeholder:"stakeholders", deliverable:"deliverables", activity:"activities", milestone:"milestones", issue:"issues", constraint:"constraints" };
const STAGE_ORDER = ["ingest","analyse","classify","map","review"];

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function fmtBytes(b){ if(b<1024)return b+"B"; if(b<1048576)return(b/1024).toFixed(1)+"KB"; return(b/1048576).toFixed(1)+"MB"; }
function csvRow(arr){ return arr.map(v=>`"${String(v==null?"":v).replace(/"/g,'""')}"`).join(","); }

function PStage({ id, label, active, done }) {
  const color = done ? COLORS.sageDim : active ? COLORS.accentLight : COLORS.textMuted;
  const bg = active ? "rgba(46,125,82,0.15)" : "transparent";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, fontWeight:700, color, background:bg, padding:"3px 8px", borderRadius:4, whiteSpace:"nowrap", transition:"all .3s", textTransform:"uppercase", letterSpacing:".5px" }}>
      <div style={{ width:5, height:5, borderRadius:"50%", background:"currentColor" }}/>
      {label}
    </div>
  );
}

function TabBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ flex:1, padding:"7px 4px", fontSize:10, fontWeight:700, color: active ? COLORS.accentLight : COLORS.textMuted, background:"none", border:"none", cursor:"pointer", borderBottom: active ? `2px solid ${COLORS.accentLight}` : "2px solid transparent", textTransform:"uppercase", letterSpacing:".4px" }}>
      {label}
    </button>
  );
}

function RegTab({ reg, active, count, onClick }) {
  return (
    <button onClick={onClick} style={{ padding:"8px 12px", fontSize:10, fontWeight:700, color: active ? COLORS.sage : COLORS.textMuted, background:"none", border:"none", cursor:"pointer", borderBottom: active ? `2px solid ${COLORS.sage}` : "2px solid transparent", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5, textTransform:"uppercase", letterSpacing:".4px" }}>
      {REG_ICONS[reg]} {REG_LABELS[reg]}
      <span style={{ background: active ? COLORS.accent : COLORS.border, color: active ? "#fff" : COLORS.textDim, fontSize:9, padding:"1px 5px", borderRadius:10, fontWeight:700 }}>{count}</span>
    </button>
  );
}

function CardField({ label, value }) {
  return (
    <div style={{ fontSize:11, color: COLORS.textDim, display:"flex", gap:6, marginBottom:2 }}>
      <span style={{ color: COLORS.textMuted, whiteSpace:"nowrap", minWidth:80, fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:".3px", flexShrink:0 }}>{label}</span>
      <span>{value||"—"}</span>
    </div>
  );
}

function Tag({ children, color }) {
  return <span style={{ fontSize:9, padding:"2px 6px", borderRadius:3, background: color ? color+"22" : COLORS.surface2, border:`1px solid ${color || COLORS.border}`, color: color || COLORS.textDim, fontWeight:600 }}>{children}</span>;
}

function ActionBtns({ id, state, onSet }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
      <button onClick={()=>onSet(id, state==="accepted"?"pending":"accepted")} style={{ width:27, height:27, borderRadius:4, border:`1px solid ${state==="accepted" ? COLORS.activity : COLORS.border}`, background: state==="accepted" ? "rgba(58,224,162,0.15)" : "none", cursor:"pointer", fontSize:12, color: state==="accepted" ? COLORS.activity : COLORS.textMuted }}>✓</button>
      <button onClick={()=>onSet(id, state==="rejected"?"pending":"rejected")} style={{ width:27, height:27, borderRadius:4, border:`1px solid ${state==="rejected" ? COLORS.risk : COLORS.border}`, background: state==="rejected" ? "rgba(224,92,92,0.15)" : "none", cursor:"pointer", fontSize:12, color: state==="rejected" ? COLORS.risk : COLORS.textMuted }}>✕</button>
    </div>
  );
}

function CharterView({ charter }) {
  const c = charter || {};
  const F = ({ label, value, full }) => (
    <div style={{ ...S.charterField, gridColumn: full ? "1/-1" : undefined }}>
      <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".5px", color: COLORS.textMuted, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:12, color: (value && value !== "null") ? COLORS.sage : COLORS.textMuted, fontStyle: (!value||value==="null") ? "italic" : "normal", lineHeight:1.5 }}>{(value && value !== "null") ? value : "Not found in document"}</div>
    </div>
  );
  return (
    <div>
      <div style={S.charterGrid}>
        <F label="Project Name" value={c.projectName}/>
        <F label="Project Code" value={c.projectCode}/>
        <F label="Project Manager" value={c.projectManager}/>
        <F label="Project Sponsor" value={c.projectSponsor}/>
        <F label="Organisation" value={c.organisation}/>
        <F label="Start Date" value={c.startDate}/>
        <F label="End Date" value={c.endDate}/>
        <F label="Budget" value={c.budget}/>
      </div>
      <div style={S.charterGrid}><F label="Purpose" value={c.purpose} full/></div>
      <div style={S.charterGrid}><F label="Problem Statement" value={c.problemStatement} full/></div>
      <div style={S.charterGrid}><F label="Strategic Alignment" value={c.strategicAlignment} full/></div>
      {(c.withinScope||[]).length > 0 && <div style={S.charterGrid}><F label="Within Scope" value={(c.withinScope||[]).map((s,i)=>`${i+1}. ${s}`).join("\n")} full/></div>}
      {(c.outOfScope||[]).length > 0 && <div style={S.charterGrid}><F label="Out of Scope" value={(c.outOfScope||[]).map((s,i)=>`${i+1}. ${s}`).join("\n")} full/></div>}
      {(c.objectives||[]).length > 0 && <>
        <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".8px", color: COLORS.textMuted, padding:"6px 0", borderBottom:`1px solid ${COLORS.border}`, marginBottom:8, marginTop:12 }}>Objectives & Success Criteria</div>
        {c.objectives.map((o,i) => (
          <div key={i} style={{ ...S.card, borderColor: COLORS.border }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:9, fontFamily:"monospace", color: COLORS.textMuted, marginBottom:3 }}>OBJ-{String(i+1).padStart(3,"0")}</div>
              <div style={{ fontSize:12, fontWeight:700, color: COLORS.sage, marginBottom:4 }}>{o.objective||"Objective"}</div>
              <CardField label="Success KPI" value={o.successCriterion}/>
              {o.targetDate && <CardField label="Target Date" value={o.targetDate}/>}
            </div>
          </div>
        ))}
      </>}
    </div>
  );
}

function RegisterCard({ item, reg, state, onSet }) {
  const ragColor = (l, i) => { const s=(parseInt(l)||1)*(parseInt(i)||1); return s>=9?"#e05c5c":s>=4?"#e0a23a":"#3ae0a2"; };
  const priColor = p => p==="high"||p==="High" ? COLORS.risk : p==="low"||p==="Low" ? COLORS.activity : COLORS.milestone;

  let name = item.name || item.description || "—";
  let fields = null;
  let tags = null;

  if (reg === "risk") {
    const sc = (parseInt(item.likelihood)||1)*(parseInt(item.impact)||1);
    const rc = ragColor(item.likelihood, item.impact);
    fields = <><CardField label="Category" value={item.category}/><CardField label="Cause" value={item.cause}/><CardField label="Impact" value={item.potentialImpact}/><CardField label="Mitigation" value={item.mitigation}/></>;
    tags = <><span style={{ width:8, height:8, borderRadius:"50%", background:rc, display:"inline-block", marginRight:4 }}/><Tag>L: {item.likelihood||"—"}</Tag><Tag>I: {item.impact||"—"}</Tag><Tag>Score: {sc}</Tag><Tag>{item.response||"—"}</Tag></>;
  } else if (reg === "stakeholder") {
    const ps = (((parseInt(item.power)||5)+(parseInt(item.influence)||5))/2*(parseInt(item.interest)||5)/10).toFixed(1);
    fields = <><CardField label="Category" value={item.category}/><CardField label="Contact" value={item.contact}/><CardField label="Strategy" value={item.engagementStrategy}/></>;
    tags = <><Tag>Power: {item.power||5}</Tag><Tag>Interest: {item.interest||5}</Tag><Tag>Influence: {item.influence||5}</Tag><Tag>Ease: {item.ease||5}</Tag><Tag color={COLORS.accentLight}>★ {ps}</Tag></>;
  } else if (reg === "deliverable") {
    fields = <><CardField label="Description" value={item.description}/><CardField label="Owner" value={item.suggestedOwner}/><CardField label="Source" value={item.source}/></>;
    tags = <><Tag>{item.phase||"—"}</Tag><Tag color={priColor(item.priority)}>{item.priority||"medium"}</Tag></>;
  } else if (reg === "activity") {
    fields = <><CardField label="Description" value={item.description}/><CardField label="Responsible" value={item.responsible}/><CardField label="Source" value={item.source}/></>;
    tags = <Tag>{item.phase||"—"}</Tag>;
  } else if (reg === "milestone") {
    fields = <><CardField label="Description" value={item.description}/><CardField label="Target Date" value={item.targetDate||"TBC"}/><CardField label="Source" value={item.source}/></>;
    tags = <Tag>{item.phase||"—"}</Tag>;
  } else if (reg === "issue") {
    fields = <><CardField label="Impact" value={item.impact}/><CardField label="Owner" value={item.suggestedOwner}/><CardField label="Source" value={item.source}/></>;
    tags = <Tag color={priColor(item.priority)}>{item.priority||"Medium"}</Tag>;
  } else if (reg === "constraint") {
    fields = <><CardField label="Description" value={item.description}/><CardField label="Risk if Breached" value={item.riskIfBreached}/><CardField label="Owner" value={item.owner}/></>;
    tags = <Tag>{item.type||"Constraint"}</Tag>;
  }

  const cardStyle = { ...S.card, borderColor: state==="accepted" ? COLORS.activity : state==="rejected" ? COLORS.border : COLORS.border, background: state==="accepted" ? "rgba(58,224,162,0.04)" : COLORS.surface, opacity: state==="rejected" ? 0.3 : 1 };

  return (
    <div style={cardStyle}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:9, fontFamily:"monospace", color: COLORS.textMuted, marginBottom:3 }}>{item._id}</div>
        <div style={{ fontSize:12, fontWeight:700, color: COLORS.sage, marginBottom:4 }}>{name}</div>
        {fields}
        <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:6 }}>{tags}</div>
      </div>
      <ActionBtns id={item._id} state={state} onSet={onSet}/>
    </div>
  );
}

export default function DocumentIntelligenceLayer() {
  const [inputTab, setInputTab] = useState("upload");
  const [regTab, setRegTab] = useState("charter");
  const [file, setFile] = useState(null);
  const [pasteText, setPasteText] = useState("");
  const [projName, setProjName] = useState("");
  const [docType, setDocType] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(null);
  const [loadMsg, setLoadMsg] = useState("");
  const [extracted, setExtracted] = useState(null);
  const [states, setStates] = useState({});
  const [toast, setToast] = useState(null);
  const fileRef = useRef();
  const [dragover, setDragover] = useState(false);

  const isReady = (inputTab==="upload" && file) || (inputTab==="paste" && pasteText.trim().length>20);

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(null), 5000); };

  const setStageStep = (s, msg) => { setStage(s); setLoadMsg(msg); };

  const handleFile = (f) => { if(f) setFile(f); };

  const setState = (id, newState) => {
    setStates(prev => ({ ...prev, [id]: newState }));
  };

  const counts = extracted ? {
    charter: extracted.charter?.projectName ? "✓" : "—",
    risk: (extracted.risks||[]).length,
    stakeholder: (extracted.stakeholders||[]).length,
    deliverable: (extracted.deliverables||[]).length,
    activity: (extracted.activities||[]).length,
    milestone: (extracted.milestones||[]).length,
    issue: (extracted.issues||[]).length,
    constraint: (extracted.constraints||[]).length,
  } : {};

  const allIds = Object.keys(states);
  const accepted = allIds.filter(id=>states[id]==="accepted").length;
  const rejected = allIds.filter(id=>states[id]==="rejected").length;

  const runAnalysis = async () => {
    setLoading(true);
    setStageStep("ingest", "Reading document...");

    let docText = "";
    if (inputTab==="upload") {
      const ext = file.name.split(".").pop().toLowerCase();
      try {
        if (ext === "docx" || ext === "doc") {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          docText = result.value;
        } else {
          docText = await file.text();
        }
      } catch(e) {
        setLoading(false); setStage(null);
        showToast("Could not read file: " + e.message + ". Try pasting the text instead.");
        return;
      }
      if (!docText || docText.trim().length < 10) {
        setLoading(false); setStage(null);
        showToast("No readable text found. Try pasting the text content directly.");
        return;
      }
    } else {
      docText = pasteText.trim();
    }

    await sleep(500); setStageStep("analyse", "Analysing project context...");
    await sleep(600); setStageStep("classify", "Classifying elements...");
    await sleep(400); setStageStep("map", "Mapping to registers...");

    const maxDoc = docText.length > 5500 ? docText.slice(0,5500)+"\n[... truncated ...]" : docText;
    const hint = docType!=="auto" ? `Document type: ${docType}. ` : "";
    const pn = projName ? `Project name: "${projName}". ` : "";

    const prompt = `You are the Document Intelligence Engine for NorCon Projects. ${pn}${hint}

Extract ALL project data from this document and return ONLY a single valid JSON object — no markdown, no backticks, no explanation.

{
  "charter": {
    "projectName": null, "projectCode": null, "purpose": null, "problemStatement": null,
    "strategicAlignment": null, "withinScope": [], "outOfScope": [],
    "objectives": [{"objective":"","successCriterion":"","targetDate":null}],
    "startDate": null, "endDate": null, "budget": null,
    "projectManager": null, "projectSponsor": null, "organisation": null, "documentSummary": ""
  },
  "risks": [{"_id":"R-101","name":"","category":"","cause":"","potentialImpact":"","likelihood":"1 - Low","impact":"1 - Low","mitigation":"","response":"Avoid"}],
  "stakeholders": [{"_id":"SH-001","name":"","category":"","contact":"","power":5,"interest":5,"influence":5,"ease":5,"engagementStrategy":""}],
  "deliverables": [{"_id":"D-001","name":"","description":"","suggestedOwner":"","phase":"","priority":"medium","source":""}],
  "activities": [{"_id":"ACT-001","name":"","description":"","phase":"","responsible":"","source":""}],
  "milestones": [{"_id":"MS-001","name":"","description":"","targetDate":null,"phase":"","source":""}],
  "issues": [{"_id":"I-101","description":"","impact":"","priority":"Medium","suggestedOwner":"","source":""}],
  "constraints": [{"_id":"CON-001","type":"Constraint","description":"","riskIfBreached":"","owner":""}]
}

IDs: R-101,R-102... | I-101... | SH-001,SH-002... | D-001... | ACT-001... | MS-001... | CON-001...
Only extract what is genuinely present. Return [] for registers with nothing found.

DOCUMENT:
${maxDoc}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 4000, messages: [{ role: "user", content: prompt }] })
      });
     
      if (!res.ok) { const t = await res.text(); throw new Error(`API ${res.status}: ${t.slice(0,200)}`); }

      const data = await res.json();
      const raw = (data.content||[]).map(b=>b.text||"").join("");
      const clean = raw.replace(/^```[a-z]*\n?/,"").replace(/```$/,"").trim();
      const start = clean.indexOf("{"), end = clean.lastIndexOf("}");
      if (start===-1||end===-1) throw new Error("No JSON in response: "+raw.slice(0,200));
      const parsed = JSON.parse(clean.slice(start, end+1));

      const newStates = {};
      ["risks","stakeholders","deliverables","activities","milestones","issues","constraints"].forEach(k=>{
        (parsed[k]||[]).forEach(el=>{ if(el._id) newStates[el._id]="pending"; });
      });

      setExtracted(parsed);
      setStates(newStates);
      setStage("review");
      setLoading(false);
    } catch(err) {
      setLoading(false);
      setStage(null);
      showToast("Error: "+err.message);
    }
  };

  const exportCSV = () => {
    if (!extracted) return;
    const lines = [];
    const c = extracted.charter||{};
    lines.push("CHARTER"); lines.push(csvRow(["Field","Value"]));
    [["Project Name",c.projectName],["Project Code",c.projectCode],["Purpose",c.purpose],["Problem Statement",c.problemStatement],["Strategic Alignment",c.strategicAlignment],["Start Date",c.startDate],["End Date",c.endDate],["Budget",c.budget],["Project Manager",c.projectManager],["Project Sponsor",c.projectSponsor],["Organisation",c.organisation]]
      .forEach(([k,v])=>lines.push(csvRow([k,v||""])));
    lines.push("");
    if((c.objectives||[]).length){
      lines.push("OBJECTIVES"); lines.push(csvRow(["#","Objective","Success Criterion","Target Date"]));
      c.objectives.forEach((o,i)=>lines.push(csvRow([i+1,o.objective,o.successCriterion,o.targetDate||""])));
      lines.push("");
    }
    [
      {key:"risks",label:"RISK REGISTER",hdrs:["Risk ID","Name","Category","Cause","Potential Impact","Likelihood","Impact","Mitigation","Response","Status"],row:r=>[r._id,r.name,r.category,r.cause,r.potentialImpact,r.likelihood,r.impact,r.mitigation,r.response,"Open"]},
      {key:"stakeholders",label:"STAKEHOLDER MATRIX",hdrs:["SH ID","Name","Category","Contact","Power","Interest","Influence","Ease","Priority Score","Engagement Strategy","Status"],row:s=>[s._id,s.name,s.category,s.contact,s.power,s.interest,s.influence,s.ease,(((parseInt(s.power)||5)+(parseInt(s.influence)||5))/2*(parseInt(s.interest)||5)/10).toFixed(1),s.engagementStrategy,"Identified"]},
      {key:"deliverables",label:"DELIVERABLE REGISTER",hdrs:["Del ID","Name","Description","Suggested Owner","Phase","Priority","Source","Status"],row:d=>[d._id,d.name,d.description,d.suggestedOwner,d.phase,d.priority,d.source,"Not Started"]},
      {key:"activities",label:"ACTIVITY REGISTER",hdrs:["Act ID","Name","Description","Phase","Responsible","Source"],row:a=>[a._id,a.name,a.description,a.phase,a.responsible,a.source]},
      {key:"milestones",label:"MILESTONE REGISTER",hdrs:["MS ID","Name","Description","Target Date","Phase","Source"],row:m=>[m._id,m.name,m.description,m.targetDate||"TBC",m.phase,m.source]},
      {key:"issues",label:"ISSUE REGISTER",hdrs:["Issue ID","Description","Impact","Priority","Suggested Owner","Source","Status"],row:i=>[i._id,i.description,i.impact,i.priority,i.suggestedOwner,i.source,"Open"]},
      {key:"constraints",label:"CONSTRAINTS & ASSUMPTIONS",hdrs:["Con ID","Type","Description","Risk if Breached","Owner"],row:c=>[c._id,c.type,c.description,c.riskIfBreached,c.owner]},
    ].forEach(({key,label,hdrs,row})=>{
      const items=(extracted[key]||[]).filter(el=>states[el._id]!=="rejected");
      if(!items.length)return;
      lines.push(label); lines.push(csvRow(hdrs)); items.forEach(el=>lines.push(csvRow(row(el)))); lines.push("");
    });
    const blob = new Blob([lines.join("\n")],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`NorCon_Registers_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const renderRegContent = () => {
    if (!extracted) return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:10, color: COLORS.textMuted, textAlign:"center", padding:32 }}>
        <div style={{ fontSize:40, opacity:.25 }}>🗂️</div>
        <div style={{ fontSize:14, fontWeight:600, color: COLORS.textDim }}>No data extracted yet</div>
        <div style={{ fontSize:11, maxWidth:280, lineHeight:1.6 }}>Upload or paste a project document — the engine extracts structured data into each register, ready for the Personalisation Layer.</div>
      </div>
    );
    if (regTab === "charter") return <CharterView charter={extracted.charter}/>;
    const key = LIST_KEY[regTab];
    const items = extracted[key]||[];
    if (!items.length) return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:260, gap:10, color: COLORS.textMuted, textAlign:"center" }}>
        <div style={{ fontSize:36, opacity:.25 }}>📭</div>
        <div style={{ fontSize:13, fontWeight:600, color: COLORS.textDim }}>No {REG_LABELS[regTab]} found</div>
        <div style={{ fontSize:11 }}>None were identified in this document.</div>
      </div>
    );
    return items.map((item,i) => <RegisterCard key={item._id||i} item={item} reg={regTab} state={states[item._id]||"pending"} onSet={setState}/>);
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logo}>🧠</div>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color: COLORS.sage }}>Document Intelligence Engine</div>
          <div style={{ fontSize:11, color: COLORS.textMuted }}>Layer 1 — Extracts structured data for the Personalisation Layer</div>
        </div>
        <span style={{ marginLeft:"auto", background: COLORS.accent, color:"#fff", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20, letterSpacing:".5px", textTransform:"uppercase" }}>Layer 1</span>
      </div>

      {/* Pipeline */}
      <div style={S.pipeline}>
        {STAGE_ORDER.map((s,i) => (
          <div key={s} style={{ display:"flex", alignItems:"center" }}>
            {i>0 && <div style={{ color: COLORS.border, fontSize:14, padding:"0 2px" }}>›</div>}
            <PStage label={s==="map"?"Map to Registers":s==="review"?"Review & Approve":s.charAt(0).toUpperCase()+s.slice(1)} active={stage===s} done={stage && STAGE_ORDER.indexOf(stage)>i}/>
          </div>
        ))}
      </div>

      {/* Body */}
      <div style={S.body}>
        {/* Loading overlay */}
        {loading && (
          <div style={S.loadingOverlay}>
            <div style={{ width:26, height:26, border:`2px solid ${COLORS.border}`, borderTopColor: COLORS.accentLight, borderRadius:"50%", animation:"spin .8s linear infinite" }}/>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {["ingest","analyse","classify","map"].map((s,i)=>(
                <div key={s} style={{ display:"flex", alignItems:"center" }}>
                  {i>0 && <div style={{ color: COLORS.border, fontSize:14 }}>›</div>}
                  <div style={{ padding:"5px 12px", borderRadius:4, border:`1px solid ${stage===s ? COLORS.accentLight : COLORS.border}`, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".5px", color: stage===s ? COLORS.accentLight : COLORS.textMuted, background: stage===s ? "rgba(46,125,82,0.2)" : "transparent", boxShadow: stage===s ? "0 0 10px rgba(46,125,82,0.3)" : "none", transition:"all .4s" }}>{s}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:12, color: COLORS.textDim }}>{loadMsg}</div>
          </div>
        )}

        {/* Left panel */}
        <div style={S.left}>
          <div style={S.panelHdr}>Document Input</div>
          <div style={S.tabRow}>
            <TabBtn label="📎 Upload" active={inputTab==="upload"} onClick={()=>setInputTab("upload")}/>
            <TabBtn label="📋 Paste" active={inputTab==="paste"} onClick={()=>setInputTab("paste")}/>
          </div>

          {inputTab==="upload" ? (
            <div style={S.tabContent}>
              {file ? (
                <div style={{ background: COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius:6, padding:10, display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:18 }}>{file.name.endsWith(".pdf")?"📕":file.name.endsWith(".docx")||file.name.endsWith(".doc")?"📘":"📄"}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, color: COLORS.sage, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", fontSize:12 }}>{file.name}</div>
                    <div style={{ color: COLORS.textMuted, fontSize:10 }}>{fmtBytes(file.size)}</div>
                  </div>
                  <button onClick={()=>setFile(null)} style={{ background:"none", border:"none", color: COLORS.textMuted, cursor:"pointer", fontSize:14 }}>✕</button>
                </div>
              ) : (
                <div style={{ ...S.dropZone, borderColor: dragover ? COLORS.accent : COLORS.border, background: dragover ? "rgba(46,125,82,0.07)" : "transparent" }}
                  onClick={()=>fileRef.current?.click()}
                  onDragOver={e=>{e.preventDefault();setDragover(true)}}
                  onDragLeave={()=>setDragover(false)}
                  onDrop={e=>{e.preventDefault();setDragover(false);handleFile(e.dataTransfer.files[0])}}>
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display:"none" }} onChange={e=>handleFile(e.target.files[0])}/>
                  <div style={{ fontSize:28, opacity:.6 }}>📂</div>
                  <div style={{ fontSize:12, fontWeight:600, color: COLORS.sageDim }}>Drop project document</div>
                  <div style={{ fontSize:10, color: COLORS.textMuted }}>or click to browse</div>
                  <div style={{ display:"flex", gap:4 }}>
                    {[".PDF",".DOCX",".TXT"].map(t=><span key={t} style={{ fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:3, border:`1px solid ${COLORS.border}`, color: COLORS.textMuted, fontFamily:"monospace" }}>{t}</span>)}
                  </div>
                </div>
              )}
              <div>
                <label style={S.fieldLabel}>Project Name (optional)</label>
                <input style={S.fieldInput} value={projName} onChange={e=>setProjName(e.target.value)} placeholder="e.g. Waterfront Phase 2"/>
              </div>
              <div>
                <label style={S.fieldLabel}>Document Type</label>
                <select style={S.fieldInput} value={docType} onChange={e=>setDocType(e.target.value)}>
                  {["auto","brief","contract","scope","specification","schedule","minutes","report"].map(v=><option key={v} value={v} style={{ background: COLORS.surface2 }}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div style={S.tabContent}>
              <textarea style={{ ...S.fieldInput, resize:"none", fontFamily:"monospace", lineHeight:1.6, minHeight:160, flex:1 }} value={pasteText} onChange={e=>setPasteText(e.target.value)} placeholder={"Paste project document text here...\n\nExamples:\n• Project brief\n• Contract clauses\n• Scope of works\n• Meeting minutes"}/>
              <div>
                <label style={S.fieldLabel}>Project Name (optional)</label>
                <input style={S.fieldInput} value={projName} onChange={e=>setProjName(e.target.value)} placeholder="e.g. Waterfront Phase 2"/>
              </div>
            </div>
          )}

          <button style={{ ...S.analyseBtn, opacity: isReady?1:.35, cursor: isReady?"pointer":"not-allowed" }} onClick={runAnalysis} disabled={!isReady || loading}>
            ⚡ Extract &amp; Map to Registers
          </button>
        </div>

        {/* Right panel */}
        <div style={S.right}>
          <div style={S.regTabs}>
            {REG_KEYS.map(r=><RegTab key={r} reg={r} active={regTab===r} count={counts[r]??0} onClick={()=>setRegTab(r)}/>)}
          </div>
          <div style={S.toolbar}>
            <div style={{ fontSize:12, fontWeight:700, color: COLORS.sage, flex:1 }}>
              {extracted ? `${REG_LABELS[regTab]} Register${regTab!=="charter"?" — "+(extracted[LIST_KEY[regTab]]||[]).length+" element(s)":""}` : "Project Element Registers"}
            </div>
            <button onClick={exportCSV} disabled={!extracted} style={{ padding:"5px 12px", background:"none", border:`1px solid ${COLORS.accent}`, borderRadius:4, color: COLORS.accentLight, fontSize:10, fontWeight:700, cursor: extracted?"pointer":"not-allowed", opacity: extracted?1:.3, textTransform:"uppercase", letterSpacing:".4px" }}>
              ⬇ Export Register
            </button>
          </div>
          <div style={S.scroll}>{renderRegContent()}</div>
          {extracted && (
            <div style={S.statsBar}>
              <span className="stat">Elements: <strong style={{ color: COLORS.sageDim }}>{allIds.length}</strong></span>
              <span>Accepted: <strong style={{ color: COLORS.sageDim }}>{accepted}</strong></span>
              <span>Pending: <strong style={{ color: COLORS.sageDim }}>{allIds.length-accepted-rejected}</strong></span>
              <span>Rejected: <strong style={{ color: COLORS.sageDim }}>{rejected}</strong></span>
              {projName && <span style={{ marginLeft:"auto", color: COLORS.sageDim }}>📋 {projName}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && <div style={{ position:"fixed", bottom:16, right:16, background:"#2a1515", border:`1px solid ${COLORS.risk}`, borderRadius:6, padding:"10px 14px", fontSize:11, color:"#ff9e9e", maxWidth:340, zIndex:100, lineHeight:1.5 }}>{toast}</div>}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
