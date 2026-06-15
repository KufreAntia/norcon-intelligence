const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };

const DIM_META = {
  environmental:{ label:"Environmental", icon:"🌿", color:"#3ae0a2", weight:0.25 },
  social:       { label:"Social",        icon:"👥", color:"#3a9ce0", weight:0.35 },
  governance:   { label:"Governance",    icon:"⚖️", color:"#e0a23a", weight:0.20 },
  legacy:       { label:"Legacy",        icon:"🏛️", color:"#9c6ee0", weight:0.20 },
};

const SCORE_LABELS = [
  { min:4.5, label:"Excellent",         color:"#3ae0a2" },
  { min:3.5, label:"Good",              color:"#3a9962" },
  { min:2.5, label:"Moderate",          color:"#e0a23a" },
  { min:1.5, label:"Needs Improvement", color:"#e0a23a" },
  { min:0,   label:"Poor",              color:"#e05c5c" },
];

function scoreLabel(s) {
  return SCORE_LABELS.find(l => s >= l.min) || SCORE_LABELS[SCORE_LABELS.length-1];
}

// Auto-compute governance score from system behaviour
function computeGovernanceScore(state) {
  const sheets  = state?.l2?.sheets || {};
  const changes = sheets["06"]?.data?.changes || [];
  const risks   = sheets["05"]?.data?.risks   || [];
  const raciRows= sheets["04"]?.data?.raciRows|| [];
  const team    = state?.l2?.loginCodes       || [];

  const checks = [
    { label:"Roles & responsibilities assigned",   pass: team.length > 0 && raciRows.length > 0 },
    { label:"RACI matrix completed",               pass: raciRows.length > 0 },
    { label:"Risks logged",                        pass: risks.length > 0 },
    { label:"Risks have mitigations",              pass: risks.length > 0 && risks.every(r=>r.mitigation) },
    { label:"Change control used",                 pass: changes.filter(c=>c.type==="major").length > 0 },
    { label:"Changes have approvals",              pass: changes.filter(c=>c.status==="approved").length > 0 },
    { label:"Team has governance tiers",           pass: team.some(m=>m.role==="Project Manager") },
    { label:"Project charter documented",          pass: !!(sheets["01"]?.data?.charter?.purpose) },
    { label:"Stakeholders identified",             pass: (sheets["08"]?.data?.stakeholders||[]).length > 0 },
    { label:"Communications plan exists",          pass: (sheets["09"]?.data?.comms||[]).length > 0 },
  ];

  const passed = checks.filter(c=>c.pass).length;
  const score  = (passed / checks.length) * 5;
  return { score: parseFloat(score.toFixed(2)), checks };
}

// Aggregate sustainability scores from recorded evidence
function computeDimScores(sustainData, governanceScore) {
  const evidence = sustainData?.evidence || [];
  const scores   = {};

  for (const dimId of ["environmental","social","legacy"]) {
    const dimEv = evidence.filter(e=>e.dimId===dimId);
    if (dimEv.length === 0) { scores[dimId] = null; continue; }
    const avg = dimEv.reduce((s,e)=>s+e.score,0) / dimEv.length;
    scores[dimId] = parseFloat((avg * 5).toFixed(2));
  }
  scores.governance = governanceScore;
  return scores;
}

function OverallScore({ scores }) {
  const available = Object.entries(DIM_META).filter(([id])=>scores[id]!==null&&scores[id]!==undefined);
  if (available.length === 0) return null;
  const overall = available.reduce((s,[id])=>s + scores[id]*DIM_META[id].weight, 0) /
    available.reduce((s,[id])=>s+DIM_META[id].weight,0) * 5;
  const sl = scoreLabel(overall);
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:48, fontWeight:700, color:sl.color }}>{overall.toFixed(1)}</div>
      <div style={{ fontSize:14, fontWeight:700, color:sl.color }}>{sl.label}</div>
      <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>Overall Sustainability Score</div>
    </div>
  );
}

function DimCard({ dimId, score, checks }) {
  const meta = DIM_META[dimId];
  const sl   = score !== null ? scoreLabel(score) : null;
  const pct  = score !== null ? (score/5)*100 : 0;

  return (
    <div style={{ background:C.surface, border:`1px solid ${score!==null?meta.color+"44":C.border}`,
      borderRadius:8, padding:"14px 16px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <span style={{ fontSize:20 }}>{meta.icon}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:700, color:meta.color }}>{meta.label}</div>
          <div style={{ fontSize:10, color:C.muted }}>Weight: {meta.weight*100}%</div>
        </div>
        {sl && (
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:22, fontWeight:700, color:sl.color }}>{score}</div>
            <div style={{ fontSize:9, color:sl.color }}>{sl.label}</div>
          </div>
        )}
        {score === null && <div style={{ fontSize:11, color:C.muted }}>No data yet</div>}
      </div>

      {/* Score bar */}
      <div style={{ height:6, background:C.surface2, borderRadius:3, overflow:"hidden", marginBottom:10 }}>
        <div style={{ width:`${pct}%`, height:"100%", background:meta.color, borderRadius:3, transition:"width .5s ease" }}/>
      </div>

      {/* Governance checks */}
      {checks && (
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase",
            letterSpacing:".4px", marginBottom:6 }}>Auto-captured from system</div>
          {checks.map((c,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3, fontSize:11 }}>
              <span style={{ color: c.pass ? C.activity : C.risk, fontSize:10 }}>{c.pass?"✓":"✕"}</span>
              <span style={{ color: c.pass ? C.dim : C.muted }}>{c.label}</span>
            </div>
          ))}
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
    <div style={{ padding:20 }}>
      {/* Overall score */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8,
        padding:"20px 24px", marginBottom:16, display:"flex", alignItems:"center", gap:24 }}>
        <OverallScore scores={dimScores}/>
        <div style={{ flex:1, borderLeft:`1px solid ${C.border}`, paddingLeft:24 }}>
          <div style={{ fontSize:12, color:C.dim, lineHeight:1.7 }}>
            <div style={{ fontWeight:700, color:C.sage, marginBottom:6 }}>Sustainability Score Breakdown</div>
            {Object.entries(DIM_META).filter(([id])=>enabledDims.includes(id)).map(([id,meta])=>(
              <div key={id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <span>{meta.icon}</span>
                <span style={{ color:C.muted, minWidth:100 }}>{meta.label}</span>
                <span style={{ color:meta.color, fontWeight:700 }}>{dimScores[id]!==null?dimScores[id]?.toFixed(1):"—"}</span>
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
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:12 }}>
        {enabledDims.map(dimId => (
          <DimCard key={dimId} dimId={dimId}
            score={dimScores[dimId]??null}
            checks={dimId==="governance" ? govResult.checks : null}/>
        ))}
      </div>

      {/* Recent evidence */}
      {evidence.length > 0 && (
        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase",
            letterSpacing:".5px", marginBottom:8 }}>Recent Evidence</div>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
            {evidence.slice(-10).reverse().map((ev,i)=>{
              const meta = DIM_META[ev.dimId];
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 14px",
                  borderBottom:`1px solid ${C.border}`, background:i%2===0?C.surface:"transparent" }}>
                  <span style={{ fontSize:14 }}>{meta?.icon||"•"}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:C.sage }}>{ev.activityName}</div>
                    <div style={{ fontSize:10, color:C.muted }}>{ev.area}</div>
                  </div>
                  <div style={{ fontSize:11, fontWeight:700,
                    color: ev.answer==="yes"?C.activity:ev.answer==="partially"?C.milestone:C.risk }}>
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
