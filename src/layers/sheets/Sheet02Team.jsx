import { useState } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c" };
const inp = { width:"100%", background:C.surface2, border:`1px solid ${C.border}`, borderRadius:5, color:C.sage, fontSize:12, padding:"7px 10px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" };

const PM_ROLES = ["Project Manager","Project Sponsor","Project Director","Assistant Project Manager","Project Scheduler","Project Controller","Risk Owner","Communications Lead","Technical Lead 1","Technical Lead 2","Research Coordinator","Marketing Lead","Document Controller"];
const DEL_ROLES = ["Content Curator","Research Coordinator","Communications Coordinator","Marketing Lead","Data Analyst","Design Lead","Outreach Lead","Technical Specialist","Partnership Lead","Editorial Lead"];

const GOV_TIERS = {
  "Project Sponsor":  "Tier 1 — Sponsor",
  "Project Director": "Tier 1 — Sponsor",
  "Project Manager": "Tier 3 — Project Manager",
  "Assistant Project Manager": "Tier 3 — Project Manager",
  "Project Scheduler": "Tier 4 — Project Team",
  "Project Controller": "Tier 3 — Project Manager",
  "Risk Owner": "Tier 4 — Project Team",
  "Communications Lead": "Tier 4 — Project Team",
};

export default function Sheet02Team({ data, locked, loginCodes, onUpdate }) {
  const [members, setMembers] = useState(() => {
    if (data.teamMembers && data.teamMembers.length > 0) return data.teamMembers;
    return loginCodes.map(lc => ({
      loginCode: lc.loginCode, name: lc.name||'', role: lc.role||'',
      deliveryRole:'', availability:'80%', responsibilities:'', location:'',
    }));
  });

  const update = (idx, field, value) => {
    const next = members.map((m,i) => i===idx ? {...m,[field]:value} : m);
    setMembers(next);
    onUpdate({ teamMembers: next }, 'in-progress');
  };

  const Lbl = ({children}) => <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:3 }}>{children}</div>;

  return (
    <div style={{ maxWidth:900 }}>
      {/* Governance hierarchy info */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:7, padding:"12px 16px", marginBottom:20 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>Governance Hierarchy</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {[["Tier 1","Sponsor","Final authority — approves charter, scope changes, gate sign-offs"],
            ["Tier 2","Mentor / Assessor","Independent assurance — reviews documents"],
            ["Tier 3","Project Manager","Day-to-day authority — manages schedule, risk, comms"],
            ["Tier 4","Project Team","Deliver agreed tasks within scope — escalate issues to PM"]].map(([t,r,d])=>(
            <div key={t} style={{ background:C.surface2, borderRadius:6, padding:"8px 10px" }}>
              <div style={{ fontSize:9, color:C.accentL, fontWeight:700, marginBottom:2 }}>{t}</div>
              <div style={{ fontSize:11, color:C.sage, fontWeight:600, marginBottom:3 }}>{r}</div>
              <div style={{ fontSize:10, color:C.muted, lineHeight:1.4 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Team register table */}
      <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:12 }}>
        Team Register — Dual-Capacity Model
      </div>

      {members.map((m,i)=>(
        <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:7, padding:"12px 14px", marginBottom:8,
          borderLeft: i===0 ? `3px solid ${C.accentL}` : m.role==='Project Sponsor'||m.role==='Project Director' ? `3px solid ${C.milestone}` : `3px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <div style={{ fontFamily:"monospace", fontSize:12, color:C.accentL, fontWeight:700, background:C.surface2, padding:"4px 10px", borderRadius:5, border:`1px solid ${C.border}` }}>{m.loginCode}</div>
            {i===0 && <div style={{ fontSize:10, color:C.accentL }}>Project Manager · Full Access</div>}
            {(m.role==='Project Sponsor'||m.role==='Project Director') && <div style={{ fontSize:10, color:C.milestone }}>Sponsor · Full Governance Access</div>}
            {m.role && GOV_TIERS[m.role] && <div style={{ fontSize:10, color:C.muted, marginLeft:"auto" }}>{GOV_TIERS[m.role]}</div>}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            <div>
              <Lbl>Full Name</Lbl>
              <input style={{...inp}} value={m.name} disabled={locked||i===0} onChange={e=>update(i,'name',e.target.value)} placeholder="Full name"/>
            </div>
            <div>
              <Lbl>PM / Governance Role</Lbl>
              <select style={{...inp}} value={m.role} disabled={locked||i===0} onChange={e=>update(i,'role',e.target.value)}>
                <option value="">Select...</option>
                {PM_ROLES.map(r=><option key={r} value={r} style={{background:C.surface2}}>{r}</option>)}
              </select>
            </div>
            <div>
              <Lbl>Delivery / Technical Role</Lbl>
              <select style={{...inp}} value={m.deliveryRole||''} disabled={locked} onChange={e=>update(i,'deliveryRole',e.target.value)}>
                <option value="">Select...</option>
                {DEL_ROLES.map(r=><option key={r} value={r} style={{background:C.surface2}}>{r}</option>)}
              </select>
            </div>
            <div>
              <Lbl>Availability</Lbl>
              <select style={{...inp}} value={m.availability||'80%'} disabled={locked} onChange={e=>update(i,'availability',e.target.value)}>
                {["100%","80%","60%","50%","Part-time","Ad hoc"].map(v=><option key={v} value={v} style={{background:C.surface2}}>{v}</option>)}
              </select>
            </div>
            <div>
              <Lbl>Location</Lbl>
              <input style={{...inp}} value={m.location||''} disabled={locked} onChange={e=>update(i,'location',e.target.value)} placeholder="City / Remote"/>
            </div>
            <div>
              <Lbl>Primary Responsibilities</Lbl>
              <input style={{...inp}} value={m.responsibilities||''} disabled={locked} onChange={e=>update(i,'responsibilities',e.target.value)} placeholder="Brief summary"/>
            </div>
          </div>
        </div>
      ))}

      <div style={{ marginTop:16, background:C.surface, border:`1px solid ${C.border}`, borderRadius:7, padding:"12px 16px" }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>
          Rights Model
        </div>
        <div style={{ fontSize:12, color:C.dim, lineHeight:1.6 }}>
          Rights are tied to Element IDs via the RACI matrix — not to registers.
          Complete Sheet 04 (RACI) to assign element-level permissions per team member.
          The Project Manager and Project Sponsor share full governance access. Login as either to access all platform functions.
        </div>
      </div>
    </div>
  );
}
