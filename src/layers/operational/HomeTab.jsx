import { useState } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", stakeholder:"#9c6ee0" };
const SUBS = ["Project Brief","Stakeholders","Project Team","Governance"];

const Section = ({title})=><div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".5px",borderBottom:`1px solid ${C.border}`,paddingBottom:6,marginBottom:14,marginTop:20}}>{title}</div>;
const Field  = ({label,value})=>value?<div style={{marginBottom:8}}><div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".4px",marginBottom:3}}>{label}</div><div style={{fontSize:13,color:C.sage,lineHeight:1.5}}>{value}</div></div>:null;

export default function HomeTab({ state, member, onGoToL2 }) {
  const [sub, setSub] = useState("Project Brief");
  const charter = state.l2?.sheets?.["01"]?.data?.charter || {};
  const team     = state.l2?.loginCodes || [];
  const stakeholders = state.l2?.sheets?.["08"]?.data?.stakeholders || [];
  const project  = state.project || {};

  return (
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
      {/* Sub-nav */}
      <div style={{background:C.surface2,borderBottom:`1px solid ${C.border}`,display:"flex",padding:"0 20px",gap:4,flexShrink:0}}>
        {SUBS.map(s=>(
          <button key={s} onClick={()=>setSub(s)} style={{fontSize:11,color:sub===s?C.accentL:C.muted,background:"none",border:"none",cursor:"pointer",padding:"7px 10px",borderRadius:4,margin:"4px 0",fontWeight:sub===s?700:400,background:sub===s?"rgba(46,125,82,0.15)":"none"}}>
            {s}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:20}}>

        {sub==="Project Brief" && (
          <div style={{maxWidth:720}}>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"16px 20px",marginBottom:16}}>
              <div style={{fontSize:20,fontWeight:700,color:C.sage,marginBottom:4}}>{charter.projectName||project.name||"Project"}</div>
              <div style={{fontFamily:"monospace",fontSize:12,color:C.accentL,marginBottom:12}}>{project.code}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:12}}>
                {[["Project Manager",charter.projectManager],["Sponsor",charter.projectSponsor],["Start Date",charter.startDate],["End Date",charter.endDate]].map(([l,v])=><Field key={l} label={l} value={v}/>)}
              </div>
              {charter.budget&&<Field label="Budget" value={charter.budget}/>}
            </div>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"16px 20px",marginBottom:16}}>
              <Section title="Purpose"/>
              <div style={{fontSize:13,color:C.sageDim,lineHeight:1.7}}>{charter.purpose||"Not defined."}</div>
              <Section title="Problem Statement"/>
              <div style={{fontSize:13,color:C.sageDim,lineHeight:1.7}}>{charter.problemStatement||"Not defined."}</div>
              <Section title="Strategic Alignment"/>
              <div style={{fontSize:13,color:C.sageDim,lineHeight:1.7}}>{charter.strategicAlignment||"Not defined."}</div>
            </div>
            {((charter.withinScope||[]).length>0||(charter.outOfScope||[]).length>0)&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                {(charter.withinScope||[]).length>0&&(
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px"}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.accentL,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Within Scope</div>
                    {(charter.withinScope||[]).map((s,i)=><div key={i} style={{fontSize:12,color:C.sageDim,marginBottom:4,paddingLeft:8,borderLeft:`2px solid ${C.accent}`}}>{i+1}. {s}</div>)}
                  </div>
                )}
                {(charter.outOfScope||[]).length>0&&(
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px"}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.risk,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Out of Scope</div>
                    {(charter.outOfScope||[]).map((s,i)=><div key={i} style={{fontSize:12,color:C.sageDim,marginBottom:4,paddingLeft:8,borderLeft:`2px solid ${C.risk}`}}>{i+1}. {s}</div>)}
                  </div>
                )}
              </div>
            )}
            {(charter.objectives||[]).length>0&&(
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",marginBottom:16}}>
                <Section title="Objectives & Success Criteria"/>
                {charter.objectives.map((o,i)=>(
                  <div key={i} style={{background:C.surface2,borderRadius:6,padding:"10px 12px",marginBottom:8}}>
                    <div style={{fontFamily:"monospace",fontSize:9,color:C.muted,marginBottom:3}}>OBJ-{String(i+1).padStart(3,"0")}</div>
                    <div style={{fontSize:13,fontWeight:700,color:C.sage,marginBottom:4}}>{o.objective}</div>
                    {o.successCriterion&&<div style={{fontSize:12,color:C.dim}}><span style={{color:C.muted,fontSize:10,fontWeight:700,textTransform:"uppercase",marginRight:6}}>KPI</span>{o.successCriterion}</div>}
                  </div>
                ))}
              </div>
            )}
            {member?.role==="Project Manager"&&(
              <button onClick={onGoToL2} style={{padding:"9px 18px",background:"none",border:`1px solid ${C.border}`,borderRadius:6,color:C.dim,fontSize:12,fontWeight:600,cursor:"pointer"}}>
                ← Go to Personalisation Layer
              </button>
            )}
          </div>
        )}

        {sub==="Stakeholders" && (
          <div style={{maxWidth:800}}>
            {stakeholders.length===0?<div style={{color:C.muted,fontSize:13}}>No stakeholders defined yet.</div>:
            stakeholders.map((s,i)=>{
              const ps=(((parseInt(s.power)||5)+(parseInt(s.influence)||5))/2*(parseInt(s.interest)||5)/10).toFixed(1);
              return(
                <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.stakeholder}`,borderRadius:7,padding:"12px 14px",marginBottom:8,display:"flex",gap:16,alignItems:"center"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.sage,marginBottom:2}}>{s.name}</div>
                    <div style={{fontSize:11,color:C.muted}}>{s.category} · {s.contact||"—"}</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    {[["Power",s.power],["Interest",s.interest],["Influence",s.influence],["Ease",s.ease]].map(([l,v])=>(
                      <div key={l} style={{textAlign:"center"}}>
                        <div style={{fontSize:9,color:C.muted,marginBottom:2}}>{l}</div>
                        <div style={{fontSize:14,fontWeight:700,color:C.sage}}>{v||5}</div>
                      </div>
                    ))}
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:9,color:C.muted,marginBottom:2}}>Priority</div>
                      <div style={{fontSize:14,fontWeight:700,color:C.stakeholder}}>★{ps}</div>
                    </div>
                  </div>
                  <div style={{fontSize:11,color:C.dim,maxWidth:200}}>{s.engagementStrategy||"—"}</div>
                  <div style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"rgba(156,110,224,0.15)",color:C.stakeholder,border:`1px solid ${C.stakeholder}`,whiteSpace:"nowrap"}}>{s.status||"Identified"}</div>
                </div>
              );
            })}
          </div>
        )}

        {sub==="Project Team" && (
          <div style={{maxWidth:800}}>
            {team.map((m,i)=>(
              <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:i===0?`3px solid ${C.accentL}`:`3px solid ${C.border}`,borderRadius:7,padding:"12px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:16}}>
                <div style={{width:40,height:40,background:C.surface2,borderRadius:"50%",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.accentL,flexShrink:0}}>
                  {(m.name||"?").split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.sage}}>{m.name||"Unnamed"}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{m.role}{m.deliveryRole?` · ${m.deliveryRole}`:""}</div>
                </div>
                <div style={{fontFamily:"monospace",fontSize:12,color:C.accentL,background:"rgba(46,125,82,0.12)",padding:"4px 10px",borderRadius:5,border:`1px solid ${C.border}`}}>{m.loginCode}</div>
                {m.loginCode===member?.loginCode&&<div style={{fontSize:10,color:C.accentL,background:"rgba(46,125,82,0.15)",padding:"2px 8px",borderRadius:20,border:`1px solid ${C.accentL}`}}>You</div>}
              </div>
            ))}
          </div>
        )}

        {sub==="Governance" && (
          <div style={{maxWidth:720}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[["Tier 1 — Sponsor","Final authority — approves charter, scope changes, gate sign-offs","#e0a23a"],["Tier 2 — Mentor / Assessor","Independent assurance — reviews documents, approves major changes","#3a9ce0"],["Tier 3 — Project Manager","Day-to-day authority — manages schedule, risk, comms, budget","#3ae0a2"],["Tier 4 — Project Team","Deliver agreed tasks within scope — escalate issues to PM","#8aac96"]].map(([t,d,col])=>(
                <div key={t} style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${col}`,borderRadius:7,padding:"12px 14px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:col,marginBottom:4}}>{t}</div>
                  <div style={{fontSize:12,color:C.dim,lineHeight:1.5}}>{d}</div>
                </div>
              ))}
            </div>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px"}}>
              <Section title="Change Control Process"/>
              {[["Identify","Any team member identifies a potential change"],["Log","PM assigns Change ID and logs the request"],["Assess","PM assesses impact on scope, schedule, cost, quality"],["Approve","Minor = PM. Baseline/scope = Sponsor sign-off required"],["Implement","Approved changes applied, documents version-incremented"],["Notify","All team members notified of approved change"]].map(([step,desc],i)=>(
                <div key={step} style={{display:"flex",gap:10,marginBottom:8,alignItems:"flex-start"}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:C.surface2,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:C.accentL,flexShrink:0}}>{i+1}</div>
                  <div><div style={{fontSize:12,fontWeight:700,color:C.sage}}>{step}</div><div style={{fontSize:11,color:C.muted}}>{desc}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
