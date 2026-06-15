import { useState } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };

const DIM_META = {
  environmental: { label:"Environmental", icon:"🌱", color:"#3ae0a2", weight:0.25,
    areas: ["Carbon & Emissions","Energy Use","Waste Reduction","Water Management","Biodiversity","Sustainable Materials","Transport & Logistics","Pollution Prevention"],
    guidance: "Track environmental impacts and mitigations across project activities. Evidence can be collected at activity completion." },
  social: { label:"Social", icon:"🤝", color:"#5d8aff", weight:0.35,
    areas: ["Community Engagement","Health & Safety","Equality & Inclusion","Local Employment","Skills & Training","Stakeholder Wellbeing","Accessibility","Ethical Supply Chain"],
    guidance: "Track social value and impacts. Consider who is affected by project decisions and how benefits are distributed." },
  governance: { label:"Governance", icon:"⚖️", color:"#e0a23a", weight:0.20,
    areas: [] }, // auto-scored from system
  legacy: { label:"Legacy", icon:"🏛️", color:"#b87aff", weight:0.20,
    areas: ["Knowledge Transfer","Capacity Building","Lasting Infrastructure","Organisational Learning","Replicability","Community Assets","Long-term Relationships","Documentation"],
    guidance: "Consider what lasting value the project leaves behind beyond its immediate outputs." },
};

function scoreLabel(s) {
  if(s===null||s===undefined) return { label:"No data", color:C.muted };
  if(s>=4) return { label:"Excellent", color:C.activity };
  if(s>=3) return { label:"Good",      color:"#5d8aff" };
  if(s>=2) return { label:"Fair",      color:C.milestone };
  return       { label:"Poor",         color:C.risk };
}

// ── Nuanced governance scoring ────────────────────────────────────────────
function computeGovernanceScore(state) {
  const sheets  = state?.l2?.sheets || {};
  const changes = sheets["06"]?.data?.changes || [];
  const risks   = sheets["05"]?.data?.risks   || [];
  const raciRows= sheets["04"]?.data?.raciRows|| [];
  const team    = state?.l2?.loginCodes       || [];

  const majorChanges   = changes.filter(c=>c.type==="major");
  const hasChanges     = majorChanges.length > 0;
  const allApproved    = hasChanges && majorChanges.every(c=>c.status==="approved");
  const anyUnapproved  = hasChanges && majorChanges.some(c=>c.status==="pending"||c.status==="reviewed");
  const anyRejected    = hasChanges && majorChanges.some(c=>c.status==="rejected");

  // Delayed: submitted >7 days ago and still pending
  const now = Date.now();
  const hasDelayed = hasChanges && majorChanges.some(c => {
    if(c.status !== "pending" && c.status !== "reviewed") return false;
    const d = c.date ? new Date(c.date.split("/").reverse().join("-")) : null;
    return d && (now - d.getTime()) > 7*24*60*60*1000;
  });

  // Change control score (nuanced):
  //  - No changes ever logged → this check is NEUTRAL (excluded, not penalised)
  //  - Changes logged + all approved → passes
  //  - Changes logged + unapproved/delayed → penalised
  const changeControlCheck = !hasChanges
    ? null  // null = not applicable
    : allApproved ? { label:"Changes logged & all approved", pass:true }
    : hasDelayed  ? { label:"Changes pending approval (delayed)", pass:false }
    : anyUnapproved ? { label:"Changes logged — awaiting approval", pass:false }
    : { label:"Change control process followed", pass:true };

  const checks = [
    { label:"Roles & responsibilities assigned",  pass: team.length > 0 && raciRows.length > 0 },
    { label:"RACI matrix completed",              pass: raciRows.length > 0 },
    { label:"Risks logged",                       pass: risks.length > 0 },
    { label:"Risks have mitigations",             pass: risks.length > 0 && risks.every(r=>r.mitigation) },
    ...(changeControlCheck ? [changeControlCheck] : []),
    { label:"Team has governance tiers",          pass: team.some(m=>m.role==="Project Manager") },
    { label:"Project charter documented",         pass: !!(sheets["01"]?.data?.charter?.purpose) },
    { label:"Stakeholders identified",            pass: (sheets["08"]?.data?.stakeholders||[]).length > 0 },
    { label:"Communications plan exists",         pass: (sheets["09"]?.data?.comms||[]).length > 0 || (sheets["08"]?.data?.stakeholders||[]).some(s=>s.commsPlan) },
  ];

  // Only count applicable checks (non-null pass)
  const applicable = checks.filter(c=>c.pass!==undefined);
  const passed = applicable.filter(c=>c.pass).length;
  const score  = applicable.length > 0 ? (passed / applicable.length) * 5 : null;
  return { score: score!==null ? parseFloat(score.toFixed(2)) : null, checks };
}

function computeDimScores(sustainData, governanceScore) {
  const evidence = sustainData?.evidence || [];
  const scores   = {};
  Object.keys(DIM_META).forEach(dimId => {
    if(dimId === "governance") { scores.governance = governanceScore; return; }
    const dimEv = evidence.filter(e=>e.dimId===dimId);
    if(dimEv.length === 0) { scores[dimId] = null; return; }
    const avg = dimEv.reduce((s,e)=>s+e.score,0) / dimEv.length;
    scores[dimId] = parseFloat((avg * 5).toFixed(2));
  });
  return scores;
}

function OverallScore({ scores }) {
  const available = Object.entries(DIM_META).filter(([id])=>scores[id]!==null&&scores[id]!==undefined);
  if(available.length===0) return <div style={{ fontSize:13, color:C.muted }}>No scored dimensions yet</div>;
  const totalWeight = available.reduce((s,[id])=>s+DIM_META[id].weight,0);
  const overall = available.reduce((s,[id])=>s + scores[id]*DIM_META[id].weight, 0) / totalWeight;
  const sl = scoreLabel(overall);
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:48, fontWeight:700, color:sl.color }}>{overall.toFixed(1)}</div>
      <div style={{ fontSize:11, color:sl.color, fontWeight:700 }}>{sl.label}</div>
      <div style={{ fontSize:10, color:C.muted }}>out of 5.0</div>
    </div>
  );
}

function DimCard({ dimId, score, checks, evidence }) {
  const [expanded, setExpanded] = useState(false);
  const meta = DIM_META[dimId];
  const sl   = score !== null && score !== undefined ? scoreLabel(score) : null;
  const pct  = score !== null && score !== undefined ? (score/5)*100 : 0;
  const dimEvidence = evidence.filter(e=>e.dimId===dimId);
  const isGov = dimId === "governance";

  return (
    <div style={{ background:C.surface, border:`1px solid ${score!==null&&score!==undefined?meta.color+"44":C.border}`, borderRadius:8, padding:"14px 16px" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <span style={{ fontSize:20 }}>{meta.icon}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:700, color:meta.color }}>{meta.label}</div>
          <div style={{ fontSize:10, color:C.muted }}>Weight: {meta.weight*100}%</div>
        </div>
        {sl && (
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:22, fontWeight:700, color:sl.color }}>{score?.toFixed(1)}</div>
            <div style={{ fontSize:9, color:sl.color }}>{sl.label}</div>
          </div>
        )}
        {(!sl) && <div style={{ fontSize:11, color:C.muted }}>No data yet</div>}
      </div>

      {/* Score bar */}
      <div style={{ height:6, background:C.surface2, borderRadius:3, overflow:"hidden", marginBottom:10 }}>
        <div style={{ width:`${pct}%`, height:"100%", background:meta.color, borderRadius:3, transition:"width .5s ease" }}/>
      </div>

      {/* Guidance */}
      {!isGov && meta.guidance && (
        <div style={{ fontSize:10, color:C.muted, lineHeight:1.5, marginBottom:8, fontStyle:"italic" }}>{meta.guidance}</div>
      )}

      {/* Governance checks — always shown */}
      {isGov && checks && (
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:6 }}>Auto-captured from system</div>
          {checks.map((c,i) => {
            const isNA = c.pass === null || c.pass === undefined;
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3, fontSize:11 }}>
                <span style={{ color: isNA ? C.muted : c.pass ? C.activity : C.risk, fontSize:10 }}>
                  {isNA ? "—" : c.pass ? "✓" : "✕"}
                </span>
                <span style={{ color: isNA ? C.muted+"99" : c.pass ? C.dim : C.muted }}>{c.label}</span>
                {isNA && <span style={{ fontSize:9, color:C.muted, fontStyle:"italic" }}>(N/A — no changes logged)</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Non-governance: areas + evidence */}
      {!isGov && meta.areas.length > 0 && (
        <div style={{ marginTop:8 }}>
          <button onClick={()=>setExpanded(e=>!e)} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:5, color:C.dim, fontSize:10, cursor:"pointer", padding:"3px 8px", marginBottom:6 }}>
            {expanded ? "▲ Hide areas" : "▼ Show coverage areas"}
          </button>
          {expanded && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
              {meta.areas.map(area => {
                const covered = dimEvidence.some(e=>e.area===area);
                return (
                  <span key={area} style={{ fontSize:9, padding:"2px 7px", borderRadius:12, background:covered?meta.color+"22":C.surface2, color:covered?meta.color:C.muted, border:`1px solid ${covered?meta.color+"44":C.border}` }}>
                    {covered?"✓ ":""}{area}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Evidence count */}
      {!isGov && (
        <div style={{ fontSize:10, color:C.muted, marginTop:6 }}>
          {dimEvidence.length} evidence point{dimEvidence.length!==1?"s":""} recorded
          {dimEvidence.length > 0 && (
            <span style={{ marginLeft:8 }}>
              · {dimEvidence.filter(e=>e.answer==="yes").length} yes · {dimEvidence.filter(e=>e.answer==="partially").length} partial · {dimEvidence.filter(e=>e.answer==="no").length} no
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function L3Sustainability({ state, sustainData }) {
  const sustainConfig  = state?.l2?.sheets?.["10"]?.data || {};
  const enabled        = sustainConfig.enabled || {};
  const anyEnabled     = Object.values(enabled).some(Boolean);
  const govResult      = computeGovernanceScore(state);
  const dimScores      = computeDimScores(sustainData, govResult.score);
  const evidence       = sustainData?.evidence || [];

  if (!anyEnabled) {
    return (
      <div style={{ padding:40, textAlign:"center" }}>
        <div style={{ fontSize:32, opacity:.3, marginBottom:12 }}>🌿</div>
        <div style={{ fontSize:14, fontWeight:700, color:C.dim, marginBottom:6 }}>Sustainability tracking not configured</div>
        <div style={{ fontSize:12, color:C.muted, maxWidth:360, margin:"0 auto" }}>
          Go to the Personalisation Layer → Sheet 10 to enable sustainability dimensions for this project.
        </div>
      </div>
    );
  }

  const enabledDims = Object.keys(enabled).filter(id=>enabled[id]);

  return (
    <div style={{ padding:20, overflowY:"auto", height:"100%" }}>
      {/* Overall score */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"20px 24px", marginBottom:16, display:"flex", alignItems:"center", gap:24 }}>
        <OverallScore scores={dimScores}/>
        <div style={{ flex:1, borderLeft:`1px solid ${C.border}`, paddingLeft:24 }}>
          <div style={{ fontSize:12, color:C.dim, lineHeight:1.7 }}>
            <div style={{ fontWeight:700, color:C.sage, marginBottom:6 }}>Sustainability Score Breakdown</div>
            {Object.entries(DIM_META).filter(([id])=>enabledDims.includes(id)).map(([id,meta])=>(
              <div key={id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <span>{meta.icon}</span>
                <span style={{ color:C.muted, minWidth:100 }}>{meta.label}</span>
                <span style={{ color:meta.color, fontWeight:700 }}>{dimScores[id]!==null&&dimScores[id]!==undefined?dimScores[id]?.toFixed(1):"—"}</span>
                <span style={{ color:C.muted, fontSize:10 }}>/ 5 · {meta.weight*100}%</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop:10, fontSize:11, color:C.muted }}>
            Evidence collected: {evidence.length} data point{evidence.length!==1?"s":""}
          </div>
        </div>
      </div>

      {/* Dimension cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:12 }}>
        {enabledDims.map(dimId => (
          <DimCard key={dimId} dimId={dimId}
            score={dimScores[dimId]??null}
            checks={dimId==="governance" ? govResult.checks : null}
            evidence={evidence}/>
        ))}
      </div>

      {/* Recent evidence */}
      {evidence.length > 0 && (
        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>Recent Evidence</div>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
            {evidence.slice(-10).reverse().map((ev,i)=>{
              const meta = DIM_META[ev.dimId];
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 14px", borderBottom:`1px solid ${C.border}`, background:i%2===0?C.surface:"transparent" }}>
                  <span style={{ fontSize:14 }}>{meta?.icon||"•"}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:C.sage }}>{ev.activityName}</div>
                    <div style={{ fontSize:10, color:C.muted }}>{ev.area}</div>
                  </div>
                  <div style={{ fontSize:11, fontWeight:700, color: ev.answer==="yes"?C.activity:ev.answer==="partially"?C.milestone:C.risk }}>
                    {ev.answer==="yes"?"✓ Yes":ev.answer==="partially"?"⚬ Partially":"✕ No"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
