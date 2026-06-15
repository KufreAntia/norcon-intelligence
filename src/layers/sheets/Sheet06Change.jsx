import { useState } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };
const inp = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:5, color:C.sage, fontSize:12, padding:"6px 9px", outline:"none", boxSizing:"border-box", fontFamily:"inherit", width:"100%" };
const Lbl = ({c})=><div style={{fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".4px",marginBottom:3}}>{c}</div>;

const CHANGE_TYPES  = ["Scope Change","Schedule Change","Budget Change","Quality Change","Resource Change","Process Change","Technical Change","Custom..."];
const DECISIONS     = ["Pending","Approved","Rejected","Deferred"];
const APPROVAL_TIERS = [
  { tier:"Tier 1 — Sponsor",        desc:"Baseline changes — scope, budget, major schedule", color:"#e0a23a" },
  { tier:"Tier 3 — Project Manager", desc:"Minor changes within approved tolerances",         color:"#3a9962" },
];
const decColor = { Approved:C.activity, Rejected:C.risk, Pending:C.milestone, Deferred:C.muted };

export default function Sheet06Change({ data, locked, loginCodes, allSheets, onUpdate }) {
  const [changes,  setChanges]  = useState(data.changes  || []);
  const [approvers,setApprovers]= useState(data.approvers|| []);
  const [activeTab,setActiveTab]= useState("log");

  // Build approver list from team + sponsor from charter
  const charter   = allSheets?.["01"]?.data?.charter || {};
  const teamMembers = loginCodes || [];

  const initApprovers = () => {
    const list = [];
    // Project Sponsor from charter
    if (charter.projectSponsor) {
      list.push({ name:charter.projectSponsor, role:"Project Sponsor", tier:"Tier 1 — Sponsor", rights:["baseline","scope","budget"], loginCode:"SPONSOR" });
    }
    // PM from team
    const pm = teamMembers.find(m=>m.role==="Project Manager");
    if (pm) list.push({ name:pm.name, role:"Project Manager", tier:"Tier 3 — Project Manager", rights:["minor","schedule","quality"], loginCode:pm.loginCode });
    // Other team members
    teamMembers.filter(m=>m.role!=="Project Manager").forEach(m=>{
      list.push({ name:m.name, role:m.role, tier:"Tier 4 — Project Team", rights:[], loginCode:m.loginCode });
    });
    return list;
  };

  const effectiveApprovers = approvers.length > 0 ? approvers : initApprovers();

  const updateApprover = (idx, field, value) => {
    const base = approvers.length > 0 ? approvers : initApprovers();
    const next = base.map((a,i)=> i===idx ? {...a,[field]:value} : a);
    setApprovers(next);
    onUpdate({ changes, approvers:next }, 'in-progress');
  };

  const toggleRight = (idx, right) => {
    const base = approvers.length > 0 ? approvers : initApprovers();
    const cur  = base[idx]?.rights || [];
    const next = base.map((a,i)=> i===idx ? {...a, rights: cur.includes(right) ? cur.filter(r=>r!==right) : [...cur,right]} : a);
    setApprovers(next);
    onUpdate({ changes, approvers:next }, 'in-progress');
  };

  const RIGHTS_OPTIONS = ["scope","budget","schedule","quality","resource","minor","baseline"];

  const update = (idx, field, value) => {
    const next = changes.map((c,i)=> i===idx ? {...c,[field]:value} : c);
    setChanges(next);
    onUpdate({ changes:next, approvers:effectiveApprovers }, 'in-progress');
  };

  const addChange = () => {
    const id   = `CCR-${String(changes.length+1).padStart(3,"0")}`;
    const next = [...changes, { id, date:new Date().toISOString().split("T")[0], requestedBy:"", type:"", description:"", justification:"", impact:"", decision:"Pending", approvedBy:"" }];
    setChanges(next);
    onUpdate({ changes:next, approvers:effectiveApprovers }, 'in-progress');
  };

  const removeChange = (idx) => {
    const next = changes.filter((_,i)=>i!==idx);
    setChanges(next);
    onUpdate({ changes:next, approvers:effectiveApprovers }, 'in-progress');
  };

  const teamNames = teamMembers.map(m=>m.name).filter(Boolean);
  if (charter.projectSponsor && !teamNames.includes(charter.projectSponsor)) teamNames.unshift(charter.projectSponsor);

  return (
    <div style={{maxWidth:900}}>
      {/* Sub tabs */}
      <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:`1px solid ${C.border}`,paddingBottom:8}}>
        {[["log","Change Log"],["approvers","Approval Rights"]].map(([t,l])=>(
          <button key={t} onClick={()=>setActiveTab(t)}
            style={{padding:"5px 14px",borderRadius:5,border:"none",fontSize:12,fontWeight:600,background:activeTab===t?C.accent:"none",color:activeTab===t?"#fff":C.muted,cursor:"pointer"}}>
            {l}
          </button>
        ))}
      </div>

      {activeTab==="approvers" && (
        <div>
          {/* Approval tiers reference */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            {APPROVAL_TIERS.map(({tier,desc,color})=>(
              <div key={tier} style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${color}`,borderRadius:6,padding:"10px 12px"}}>
                <div style={{fontSize:11,fontWeight:700,color,marginBottom:3}}>{tier}</div>
                <div style={{fontSize:11,color:C.muted,lineHeight:1.4}}>{desc}</div>
              </div>
            ))}
          </div>

          {/* Approver list */}
          <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".5px",marginBottom:10}}>
            Team Members & Approval Rights
          </div>
          {effectiveApprovers.map((a,i)=>(
            <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"12px 14px",marginBottom:8}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
                <div>
                  <Lbl c="Name"/>
                  <input style={inp} value={a.name||""} disabled={locked} onChange={e=>updateApprover(i,"name",e.target.value)} placeholder="Full name"/>
                </div>
                <div>
                  <Lbl c="Role"/>
                  <input style={inp} value={a.role||""} disabled={locked} onChange={e=>updateApprover(i,"role",e.target.value)} placeholder="Role"/>
                </div>
                <div>
                  <Lbl c="Governance Tier"/>
                  <select style={inp} value={a.tier||""} disabled={locked} onChange={e=>updateApprover(i,"tier",e.target.value)}>
                    <option value="">Select...</option>
                    {["Tier 1 — Sponsor","Tier 2 — Mentor / Assessor","Tier 3 — Project Manager","Tier 4 — Project Team"].map(t=>(
                      <option key={t} value={t} style={{background:C.surface2}}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Lbl c="Can approve changes to"/>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
                  {RIGHTS_OPTIONS.map(right=>{
                    const has = (a.rights||[]).includes(right);
                    return (
                      <button key={right} onClick={()=>!locked&&toggleRight(i,right)}
                        style={{padding:"3px 10px",borderRadius:20,border:`1px solid ${has?C.accent:C.border}`,background:has?"rgba(46,125,82,0.2)":"none",color:has?C.accentL:C.muted,fontSize:10,fontWeight:has?700:400,cursor:locked?"not-allowed":"pointer",textTransform:"capitalize"}}>
                        {right}
                      </button>
                    );
                  })}
                </div>
              </div>
              {a.loginCode&&(
                <div style={{marginTop:8,fontFamily:"monospace",fontSize:10,color:C.muted}}>
                  Login: {a.loginCode}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab==="log" && (
        <div>
          {/* Process steps */}
          <div style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto"}}>
            {[["1","Identify","Spot change"],["2","Log","Assign CCR ID"],["3","Assess","Impact analysis"],["4","PM Approve","Minor changes"],["5","Sponsor","Baseline changes"],["6","Notify","All team informed"]].map(([n,t,d])=>(
              <div key={n} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 10px",minWidth:100,flexShrink:0}}>
                <div style={{fontSize:9,color:C.accentL,fontWeight:700,marginBottom:2}}>Step {n}</div>
                <div style={{fontSize:11,color:C.sage,fontWeight:600,marginBottom:2}}>{t}</div>
                <div style={{fontSize:10,color:C.muted,lineHeight:1.4}}>{d}</div>
              </div>
            ))}
          </div>

          {changes.length===0&&<div style={{color:C.muted,fontSize:12,marginBottom:12}}>No change requests yet. This log populates during project delivery.</div>}

          {changes.map((c,i)=>(
            <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"12px 14px",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{fontFamily:"monospace",fontSize:12,color:C.accentL,fontWeight:700}}>{c.id}</span>
                <span style={{fontSize:10,color:C.muted}}>{c.date}</span>
                <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:(decColor[c.decision]||C.muted)+"22",color:decColor[c.decision]||C.muted,border:`1px solid ${decColor[c.decision]||C.muted}`}}>{c.decision}</span>
                {!locked&&<button onClick={()=>removeChange(i)} style={{marginLeft:"auto",background:"none",border:"none",color:C.risk,cursor:"pointer",fontSize:13}}>✕</button>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <Lbl c="Requested By"/>
                  <select style={inp} value={c.requestedBy||""} disabled={locked} onChange={e=>update(i,"requestedBy",e.target.value)}>
                    <option value="">Select...</option>
                    {teamNames.map(n=><option key={n} value={n} style={{background:C.surface2}}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <Lbl c="Change Type"/>
                  <select style={inp} value={c.type||""} disabled={locked} onChange={e=>update(i,"type",e.target.value)}>
                    <option value="">Select...</option>
                    {CHANGE_TYPES.map(t=><option key={t} value={t} style={{background:C.surface2}}>{t}</option>)}
                  </select>
                </div>
                <div style={{gridColumn:"1/-1"}}><Lbl c="Description"/><input style={inp} value={c.description||""} disabled={locked} onChange={e=>update(i,"description",e.target.value)} placeholder="What is being changed?"/></div>
                <div style={{gridColumn:"1/-1"}}><Lbl c="Justification"/><input style={inp} value={c.justification||""} disabled={locked} onChange={e=>update(i,"justification",e.target.value)} placeholder="Why is this change needed?"/></div>
                <div><Lbl c="Impact"/><input style={inp} value={c.impact||""} disabled={locked} onChange={e=>update(i,"impact",e.target.value)} placeholder="Impact on scope/time/cost/quality"/></div>
                <div>
                  <Lbl c="Decision"/>
                  <select style={inp} value={c.decision||"Pending"} disabled={locked} onChange={e=>update(i,"decision",e.target.value)}>
                    {DECISIONS.map(d=><option key={d} value={d} style={{background:C.surface2}}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <Lbl c="Approved By"/>
                  <select style={inp} value={c.approvedBy||""} disabled={locked} onChange={e=>update(i,"approvedBy",e.target.value)}>
                    <option value="">Select...</option>
                    {effectiveApprovers.filter(a=>a.name).map(a=><option key={a.loginCode} value={a.name} style={{background:C.surface2}}>{a.name} ({a.tier?.split("—")[1]?.trim()||a.role})</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
          {!locked&&<button onClick={addChange} style={{padding:"7px 14px",background:"none",border:`1px dashed ${C.border}`,borderRadius:6,color:C.dim,fontSize:12,cursor:"pointer",width:"100%"}}>+ Log Change Request</button>}
        </div>
      )}
    </div>
  );
}
