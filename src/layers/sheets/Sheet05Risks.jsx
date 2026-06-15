import React, { useState } from "react";
function EditableSelect({ value, onChange, options, disabled, placeholder }) {
  const [custom, setCustom] = React.useState(false);
  const [customVal, setCustomVal] = React.useState("");
  if (custom) {
    return <input autoFocus value={customVal} onChange={e=>setCustomVal(e.target.value)}
      onBlur={()=>{ if(customVal.trim()) onChange(customVal.trim()); setCustom(false); }}
      onKeyDown={e=>{ if(e.key==="Enter"){ onChange(customVal.trim()||value); setCustom(false); } if(e.key==="Escape") setCustom(false); }}
      style={{...inp, borderColor:"#3a9962"}}/>;
  }
  return (
    <select style={inp} value={value||""} disabled={disabled}
      onChange={e=>{ if(e.target.value==="Custom..."){setCustom(true);setCustomVal("");} else onChange(e.target.value); }}>
      <option value="">{placeholder||"Select..."}</option>
      {options.map(o=><option key={o} value={o} style={{background:"#183D28"}}>{o}</option>)}
      <option value="Custom...">Custom...</option>
    </select>
  );
}


const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };
const inp = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:5, color:C.sage, fontSize:12, padding:"6px 9px", outline:"none", boxSizing:"border-box", fontFamily:"inherit", width:"100%" };
const Lbl = ({c})=><div style={{fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".4px",marginBottom:3}}>{c}</div>;
const CATEGORIES = ["Planning & Coordination","Data & Analysis","Team Dynamics","Stakeholder Management","Financial","Technical","External"];
const RESPONSES  = ["Avoid","Reduce","Transfer","Accept","Exploit","Enhance","Share"];
const LEVELS     = ["1 - Low","2 - Medium","3 - High"];

function ragColor(l,i){ const s=(parseInt(l)||1)*(parseInt(i)||1); return s>=9?C.risk:s>=4?C.milestone:C.activity; }

export default function Sheet05Risks({ data, locked, loginCodes, onUpdate }) {
  const [risks, setRisks] = useState(data.risks || []);

  const update = (idx, field, value) => {
    const next = risks.map((r,i)=> i===idx ? {...r,[field]:value} : r);
    setRisks(next);
    onUpdate({ risks:next }, 'in-progress');
  };

  const addRisk = () => {
    const next = [...risks, { _id:`R-${String(101+risks.length).padStart(3,"0")}`, name:"", category:"", cause:"", potentialImpact:"", likelihood:"1 - Low", impact:"1 - Low", mitigation:"", response:"Avoid", _suggestedOwner:"", _suggestedApprover:"Project Manager" }];
    setRisks(next);
    onUpdate({ risks:next }, 'in-progress');
  };

  const removeRisk = (idx) => {
    const next = risks.filter((_,i)=>i!==idx);
    setRisks(next);
    onUpdate({ risks:next }, 'in-progress');
  };

  const PM_ROLES = [
    "Project Manager","Project Sponsor","Project Director","Programme Manager",
    "Portfolio Manager","Risk Manager","Change Manager","Quality Manager",
    "Project Support","PMO Analyst",
  ];
  const DELIVERY_ROLES = [
    "Lead Engineer","Site Manager","Quantity Surveyor","Design Manager",
    "Commercial Manager","Health & Safety Manager","Environmental Manager",
    "Procurement Manager","Logistics Coordinator","Contracts Manager",
  ];
  const teamRoles = [
    ...new Set([
      ...loginCodes.map(lc=>lc.role).filter(Boolean),
      ...PM_ROLES,
      ...DELIVERY_ROLES,
    ])
  ];

  return (
    <div style={{maxWidth:900}}>
      {/* RAG legend */}
      <div style={{display:"flex",gap:16,marginBottom:16,flexWrap:"wrap"}}>
        {[[C.activity,"1–3 · Low — monitor passively"],[C.milestone,"4–8 · Amber — active mitigation"],[C.risk,"9 · Red — immediate escalation"]].map(([col,label])=>(
          <div key={label} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:C.dim}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:col}}/>
            {label}
          </div>
        ))}
      </div>

      {risks.length===0&&<div style={{color:C.muted,fontSize:12,marginBottom:12}}>No risks identified yet. Add one below or extract from a document in Layer 1.</div>}

      {risks.map((r,i)=>{
        const score = (parseInt(r.likelihood)||1)*(parseInt(r.impact)||1);
        const rag   = ragColor(r.likelihood,r.impact);
        return (
          <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${rag}`,borderRadius:7,padding:"12px 14px",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <span style={{fontFamily:"monospace",fontSize:11,color:C.muted}}>{r._id}</span>
              <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:rag+"22",color:rag,border:`1px solid ${rag}`}}>Score: {score}</span>
              {r.category&&<span style={{fontSize:10,color:C.muted}}>{r.category}</span>}
              {!locked&&<button onClick={()=>removeRisk(i)} style={{marginLeft:"auto",background:"none",border:"none",color:C.risk,cursor:"pointer",fontSize:13}}>✕</button>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div style={{gridColumn:"1/-1"}}><Lbl c="Risk Name"/><input style={inp} value={r.name||""} disabled={locked} onChange={e=>update(i,"name",e.target.value)} placeholder="Short risk name"/></div>
              <div><Lbl c="Category"/>
                <EditableSelect value={r.category||""} disabled={locked} onChange={v=>update(i,"category",v)} options={CATEGORIES} placeholder="Select..."/>
              </div>
              <div><Lbl c="Response"/>
                <EditableSelect value={r.response||"Avoid"} disabled={locked} onChange={v=>update(i,"response",v)} options={RESPONSES} placeholder="Select..."/>
              </div>
              <div><Lbl c="Cause / Trigger"/><input style={inp} value={r.cause||""} disabled={locked} onChange={e=>update(i,"cause",e.target.value)} placeholder="What would trigger this?"/></div>
              <div><Lbl c="Potential Impact"/><input style={inp} value={r.potentialImpact||""} disabled={locked} onChange={e=>update(i,"potentialImpact",e.target.value)} placeholder="Consequence if it occurs"/></div>
              <div><Lbl c="Likelihood"/>
                <select style={inp} value={r.likelihood||"1 - Low"} disabled={locked} onChange={e=>update(i,"likelihood",e.target.value)}>
                  {LEVELS.map(l=><option key={l} value={l} style={{background:C.surface2}}>{l}</option>)}
                </select>
              </div>
              <div><Lbl c="Impact"/>
                <select style={inp} value={r.impact||"1 - Low"} disabled={locked} onChange={e=>update(i,"impact",e.target.value)}>
                  {LEVELS.map(l=><option key={l} value={l} style={{background:C.surface2}}>{l}</option>)}
                </select>
              </div>
              <div style={{gridColumn:"1/-1"}}><Lbl c="Mitigation / Response Strategy"/><input style={inp} value={r.mitigation||""} disabled={locked} onChange={e=>update(i,"mitigation",e.target.value)} placeholder="How will this risk be managed?"/></div>
              <div><Lbl c="Risk Owner"/>
                <select style={inp} value={r._suggestedOwner||""} disabled={locked} onChange={e=>update(i,"_suggestedOwner",e.target.value)}>
                  <option value="">Select owner...</option>
                  {teamRoles.map(r=><option key={r} value={r} style={{background:C.surface2}}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>
        );
      })}
      {!locked&&<button onClick={addRisk} style={{padding:"7px 14px",background:"none",border:`1px dashed ${C.border}`,borderRadius:6,color:C.dim,fontSize:12,cursor:"pointer",width:"100%"}}>+ Add Risk</button>}
    </div>
  );
}
