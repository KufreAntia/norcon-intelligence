import { useState } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", stakeholder:"#9c6ee0" };
const inp = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:5, color:C.sage, fontSize:12, padding:"6px 9px", outline:"none", boxSizing:"border-box", fontFamily:"inherit", width:"100%" };
const Lbl = ({c})=><div style={{fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".4px",marginBottom:3}}>{c}</div>;
const CATEGORIES = ["Sponsor","Professional Body","Education","Industry Partner","Community","Media","Regulator","Funder","End User","Other"];
const STATUSES   = ["Identified","Contacted","Engaged","Active","Lapsed"];
const FORMATS    = ["Email","Microsoft Teams","Video Call","Report","Meeting","Newsletter","Social Media","Presentation","Letter"];
const FREQS      = ["Daily","Weekly","Fortnightly","Monthly","At each gate","Ad hoc"];

function priorityScore(p,i,inf){ return (((parseInt(p)||5)+(parseInt(inf)||5))/2*(parseInt(i)||5)/10).toFixed(1); }

const Slider = ({label,value,onChange,disabled}) => (
  <div>
    <Lbl c={`${label} (${value}/10)`}/>
    <input type="range" min="1" max="10" value={value||5} disabled={disabled} onChange={e=>onChange(parseInt(e.target.value))}
      style={{width:"100%",accentColor:"#9c6ee0",cursor:disabled?"not-allowed":"pointer"}}/>
  </div>
);

// Merged Stakeholders + Communications Plan
export default function Sheet08Stakeholders({ data, locked, loginCodes, onUpdate }) {
  const [stakeholders, setStakeholders] = useState(data.stakeholders || []);
  const [activeTab, setActiveTab] = useState("stakeholders");

  const teamMembers = loginCodes || [];
  const teamNames   = teamMembers.map(m=>m.name).filter(Boolean);

  const updateSH = (idx, field, value) => {
    const next = stakeholders.map((s,i)=> i===idx ? {...s,[field]:value} : s);
    setStakeholders(next);
    onUpdate({ stakeholders:next, comms: buildComms(next) }, 'in-progress');
  };

  const addStakeholder = () => {
    const next = [...stakeholders, { _id:`SH-${String(stakeholders.length+1).padStart(3,"0")}`, name:"", category:"", contact:"", power:5, interest:5, influence:5, ease:5, engagementStrategy:"", status:"Identified", commsOwner:"", commsFormat:"", commsFreq:"", commsContent:"", commsNextDate:"", commsStatus:"Planned" }];
    setStakeholders(next);
    onUpdate({ stakeholders:next, comms: buildComms(next) }, 'in-progress');
  };

  const removeStakeholder = (idx) => {
    const next = stakeholders.filter((_,i)=>i!==idx);
    setStakeholders(next);
    onUpdate({ stakeholders:next, comms: buildComms(next) }, 'in-progress');
  };

  // Build comms plan from stakeholder data (for Sheet09 compatibility)
  const buildComms = (shs) => shs.map(s=>({
    stakeholderName: s.name||"",
    category: s.category||"",
    contact: s.contact||"",
    format: s.commsFormat||"",
    frequency: s.commsFreq||"",
    keyContent: s.commsContent||"",
    nextDate: s.commsNextDate||"",
    status: s.commsStatus||"Planned",
    owner: s.commsOwner||"",
    priorityScore: parseFloat(priorityScore(s.power,s.interest,s.influence)),
  }));

  return (
    <div style={{maxWidth:1000}}>
      {/* Sub tabs */}
      <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:`1px solid ${C.border}`,paddingBottom:8}}>
        {[["stakeholders","Stakeholder Register"],["comms","Communications Plan"]].map(([t,l])=>(
          <button key={t} onClick={()=>setActiveTab(t)}
            style={{padding:"5px 14px",borderRadius:5,border:"none",fontSize:12,fontWeight:600,background:activeTab===t?C.accent:"none",color:activeTab===t?"#fff":C.muted,cursor:"pointer"}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Stakeholder Register ── */}
      {activeTab==="stakeholders" && (
        <div>
          {stakeholders.length===0&&<div style={{color:C.muted,fontSize:12,marginBottom:12}}>No stakeholders yet. Add below or extract from Layer 1.</div>}
          {stakeholders.map((s,i)=>{
            const score = priorityScore(s.power,s.interest,s.influence);
            const scoreCol = parseFloat(score)>=6?C.risk:parseFloat(score)>=4?C.milestone:C.accentL;
            return (
              <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${scoreCol}`,borderRadius:7,padding:"12px 14px",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <span style={{fontFamily:"monospace",fontSize:11,color:C.stakeholder}}>{s._id}</span>
                  <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:scoreCol+"22",color:scoreCol,border:`1px solid ${scoreCol}`}}>Priority: {score}</span>
                  {!locked&&<button onClick={()=>removeStakeholder(i)} style={{marginLeft:"auto",background:"none",border:"none",color:C.risk,cursor:"pointer",fontSize:13}}>✕</button>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 2fr 1fr",gap:10,marginBottom:10}}>
                  <div><Lbl c="Name"/><input style={inp} value={s.name||""} disabled={locked} onChange={e=>updateSH(i,"name",e.target.value)} placeholder="Stakeholder name"/></div>
                  <div><Lbl c="Category"/>
                    <select style={inp} value={s.category||""} disabled={locked} onChange={e=>updateSH(i,"category",e.target.value)}>
                      <option value="">Select…</option>
                      {CATEGORIES.map(c=><option key={c} value={c} style={{background:C.surface2}}>{c}</option>)}
                    </select>
                  </div>
                  <div><Lbl c="Contact / Email"/><input style={inp} value={s.contact||""} disabled={locked} onChange={e=>updateSH(i,"contact",e.target.value)} placeholder="email or contact detail"/></div>
                  <div><Lbl c="Status"/>
                    <select style={inp} value={s.status||"Identified"} disabled={locked} onChange={e=>updateSH(i,"status",e.target.value)}>
                      {STATUSES.map(st=><option key={st} value={st} style={{background:C.surface2}}>{st}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:10}}>
                  <Slider label="Power"     value={s.power||5}    onChange={v=>updateSH(i,"power",v)}    disabled={locked}/>
                  <Slider label="Interest"  value={s.interest||5} onChange={v=>updateSH(i,"interest",v)} disabled={locked}/>
                  <Slider label="Influence" value={s.influence||5} onChange={v=>updateSH(i,"influence",v)} disabled={locked}/>
                  <Slider label="Ease"      value={s.ease||5}     onChange={v=>updateSH(i,"ease",v)}      disabled={locked}/>
                </div>
                <div><Lbl c="Engagement Strategy"/><input style={inp} value={s.engagementStrategy||""} disabled={locked} onChange={e=>updateSH(i,"engagementStrategy",e.target.value)} placeholder="How will you engage this stakeholder?"/></div>
              </div>
            );
          })}
          {!locked&&<button onClick={addStakeholder} style={{padding:"7px 14px",background:"none",border:`1px dashed ${C.border}`,borderRadius:6,color:C.dim,fontSize:12,cursor:"pointer",width:"100%",marginTop:4}}>+ Add Stakeholder</button>}
        </div>
      )}

      {/* ── Communications Plan ── */}
      {activeTab==="comms" && (
        <div>
          <div style={{fontSize:12,color:C.dim,marginBottom:14,lineHeight:1.6}}>
            Communications plan is linked to your stakeholder register. Set format, frequency, owner and content for each stakeholder's communications.
          </div>
          {stakeholders.length===0&&<div style={{color:C.muted,fontSize:12}}>Add stakeholders first, then configure their communications here.</div>}
          {stakeholders.sort((a,b)=>parseFloat(priorityScore(b.power,b.interest,b.influence))-parseFloat(priorityScore(a.power,a.interest,a.influence))).map((s,i)=>{
            const score = priorityScore(s.power,s.interest,s.influence);
            const scoreCol = parseFloat(score)>=6?C.risk:parseFloat(score)>=4?C.milestone:C.accentL;
            return (
              <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${scoreCol}`,borderRadius:7,padding:"12px 14px",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <span style={{fontFamily:"monospace",fontSize:11,color:C.stakeholder}}>{s._id}</span>
                  <span style={{fontSize:13,fontWeight:700,color:C.sage}}>{s.name||"Unnamed stakeholder"}</span>
                  <span style={{fontSize:10,color:C.muted}}>{s.category}</span>
                  <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:scoreCol+"22",color:scoreCol,border:`1px solid ${scoreCol}`,marginLeft:"auto"}}>Priority: {score}</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
                  <div><Lbl c="Owner (leads comms)"/>
                    <select style={inp} value={s.commsOwner||""} disabled={locked} onChange={e=>updateSH(i,"commsOwner",e.target.value)}>
                      <option value="">Select owner…</option>
                      {teamNames.map(n=><option key={n} value={n} style={{background:C.surface2}}>{n}</option>)}
                      <option value="Project Manager">Project Manager</option>
                      <option value="Project Sponsor">Project Sponsor</option>
                    </select>
                  </div>
                  <div><Lbl c="Format"/>
                    <select style={inp} value={s.commsFormat||""} disabled={locked} onChange={e=>updateSH(i,"commsFormat",e.target.value)}>
                      <option value="">Select…</option>
                      {FORMATS.map(f=><option key={f} value={f} style={{background:C.surface2}}>{f}</option>)}
                    </select>
                  </div>
                  <div><Lbl c="Frequency"/>
                    <select style={inp} value={s.commsFreq||""} disabled={locked} onChange={e=>updateSH(i,"commsFreq",e.target.value)}>
                      <option value="">Select…</option>
                      {FREQS.map(f=><option key={f} value={f} style={{background:C.surface2}}>{f}</option>)}
                    </select>
                  </div>
                  <div><Lbl c="Next Date"/>
                    <input type="date" style={inp} value={s.commsNextDate||""} disabled={locked} onChange={e=>updateSH(i,"commsNextDate",e.target.value)}/>
                  </div>
                  <div style={{gridColumn:"span 3"}}><Lbl c="Key Content / Message"/><input style={inp} value={s.commsContent||""} disabled={locked} onChange={e=>updateSH(i,"commsContent",e.target.value)} placeholder="What will be communicated?"/></div>
                  <div><Lbl c="Status"/>
                    <select style={inp} value={s.commsStatus||"Planned"} disabled={locked} onChange={e=>updateSH(i,"commsStatus",e.target.value)}>
                      {["Planned","Active","Paused","Complete"].map(st=><option key={st} value={st} style={{background:C.surface2}}>{st}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
