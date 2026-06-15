import * as XLSX from "xlsx";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", activity:"#3ae0a2", milestone:"#e0a23a" };

function buildWorkbook(state) {
  const wb   = XLSX.utils.book_new();
  const proj = state.project || {};
  const l2   = state.l2 || {};
  const charter = l2.sheets?.["01"]?.data?.charter || {};

  // Sheet 01 — Charter
  const charterData = [
    ["NorCon Projects — Project Charter"],
    [""],
    ["Project Name",    charter.projectName||proj.name||""],
    ["Project Code",    proj.code||""],
    ["Project Manager", charter.projectManager||""],
    ["Project Sponsor", charter.projectSponsor||""],
    ["Organisation",    charter.organisation||""],
    ["Start Date",      charter.startDate||""],
    ["End Date",        charter.endDate||""],
    ["Budget",          charter.budget||""],
    [""],
    ["Purpose",         charter.purpose||""],
    ["Problem Statement", charter.problemStatement||""],
    ["Strategic Alignment", charter.strategicAlignment||""],
    [""],
    ["WITHIN SCOPE"],
    ...(charter.withinScope||[]).map((s,i)=>[`${i+1}.`,s]),
    [""],
    ["OUT OF SCOPE"],
    ...(charter.outOfScope||[]).map((s,i)=>[`${i+1}.`,s]),
    [""],
    ["OBJECTIVES"],
    ["#","Objective","Success Criterion","Target Date"],
    ...(charter.objectives||[]).map((o,i)=>[i+1,o.objective,o.successCriterion,o.targetDate||""]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(charterData), "01 Charter");

  // Sheet 02 — Team
  const teamData = [
    ["NorCon Projects — Team & Governance"],[""],
    ["#","Full Name","Login Code","PM Role","Delivery Role","Availability","Location"],
    ...(l2.loginCodes||[]).map((m,i)=>[i+1,m.name||"",m.loginCode||"",m.role||"",m.deliveryRole||"",m.availability||"",m.location||""]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(teamData), "02 Team");

  // Sheet 03 — Schedule
  const acts = l2.sheets?.["03"]?.data?.activities||[];
  const mils = l2.sheets?.["03"]?.data?.milestones||[];
  const schedData = [
    ["NorCon Projects — Master Schedule"],[""],
    ["ACTIVITIES"],
    ["ID","Activity Name","Phase","Responsible","Start Date","End Date","Status"],
    ...acts.map(a=>[a._id,a.name||"",a.phase||"",a.responsible||"",a.startDate||"",a.endDate||"",a.status||"Not Started"]),
    [""],
    ["MILESTONES"],
    ["ID","Milestone Name","Phase","Target Date","Status"],
    ...mils.map(m=>[m._id,m.name||"",m.phase||"",m.targetDate||"",m.status||"Pending"]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(schedData), "03 Schedule");

  // Sheet 04 — RACI
  const raciRows = l2.sheets?.["04"]?.data?.raciRows||[];
  const members  = (l2.loginCodes||[]).filter(m=>m.name&&m.role);
  const raciData = [
    ["NorCon Projects — RACI Matrix"],[""],
    ["ID","Activity","Phase",...members.map(m=>`${m.loginCode} (${m.name})`),"Status"],
    ...raciRows.map(r=>[r.taskId,r.label||"",r.phase||"",...members.map(m=>r.assignments?.[m.loginCode]||""),acts.find(a=>a._id===r.taskId)?.status||"Not Started"]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(raciData), "04 RACI");

  // Sheet 05 — Risks
  const risks = l2.sheets?.["05"]?.data?.risks||[];
  const riskData = [
    ["NorCon Projects — Risk Register"],[""],
    ["Risk ID","Name","Category","Cause","Potential Impact","Likelihood","Impact","Score","Response","Mitigation","Owner","Status"],
    ...risks.map(r=>[r._id,r.name||"",r.category||"",r.cause||"",r.potentialImpact||"",r.likelihood||"",r.impact||"",(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1),r.response||"",r.mitigation||"",r._suggestedOwner||"","Open"]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(riskData), "05 Risk Register");

  // Sheet 06 — Change Control
  const changes = l2.sheets?.["06"]?.data?.changes||[];
  const changeData = [
    ["NorCon Projects — Change Control Log"],[""],
    ["ID","Date","Requested By","Type","Description","Justification","Impact","Decision"],
    ...changes.map(c=>[c.id,c.date||"",c.requestedBy||"",c.type||"",c.description||"",c.justification||"",c.impact||"",c.decision||"Pending"]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(changeData), "06 Change Control");

  // Sheet 07 — KD Tracker
  const dels = l2.sheets?.["07"]?.data?.deliverables||[];
  const kdData = [
    ["NorCon Projects — KPI-Deliverable Tracker"],[""],
    ["#","Deliverable","KPI Metric","Target","Actual","Achievement %","Deadline","Notes"],
    ...dels.map((d,i)=>[i+1,d.name||"",d.kpi||"",d.target||"",d.actual||"",d.target&&d.actual?Math.round((parseFloat(d.actual)/parseFloat(d.target))*100)+"%":"",d.deadlineV1||"",d.notes||""]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kdData), "07 KD Tracker");

  // Sheet 08 — Stakeholders
  const stks = l2.sheets?.["08"]?.data?.stakeholders||[];
  const stkData = [
    ["NorCon Projects — Stakeholder Matrix"],[""],
    ["SH ID","Name","Category","Contact","Power","Interest","Influence","Ease","Priority Score","Engagement Strategy","Status"],
    ...stks.map(s=>[s._id,s.name||"",s.category||"",s.contact||"",s.power||5,s.interest||5,s.influence||5,s.ease||5,(((parseInt(s.power)||5)+(parseInt(s.influence)||5))/2*(parseInt(s.interest)||5)/10).toFixed(1),s.engagementStrategy||"",s.status||"Identified"]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stkData), "08 Stakeholders");

  // Sheet 09 — Comms Plan
  const comms = l2.sheets?.["09"]?.data?.comms||[];
  const commsData = [
    ["NorCon Projects — Communications Plan"],[""],
    ["Stakeholder","Category","Contact","Format","Frequency","Key Content","Next Date","Escalation Path","Status"],
    ...comms.map(c=>[c.stakeholderName||"",c.category||"",c.contact||"",c.format||"",c.frequency||"",c.keyContent||"",c.nextDate||"",c.escalationPath||"",c.status||"Planned"]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(commsData), "09 Comms Plan");

  return wb;
}

export default function ReportTab({ state }) {
  const proj = state.project || {};

  const handleExport = () => {
    const wb  = buildWorkbook(state);
    const filename = `NorCon_${proj.code||"Project"}_Workbook_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const acts = state.l2?.sheets?.["03"]?.data?.activities||[];
  const done = acts.filter(a=>a.status==="complete").length;
  const pct  = acts.length>0?Math.round((done/acts.length)*100):0;
  const risks = state.l2?.sheets?.["05"]?.data?.risks||[];
  const stks  = state.l2?.sheets?.["08"]?.data?.stakeholders||[];
  const dels  = state.l2?.sheets?.["07"]?.data?.deliverables||[];

  return (
    <div style={{flex:1,overflowY:"auto",padding:20}}>
      <div style={{maxWidth:600}}>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"20px 24px",marginBottom:16}}>
          <div style={{fontSize:16,fontWeight:700,color:C.sage,marginBottom:4}}>Project Report</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:20}}>Exports the full NC Project Workbook with all 9 sheets populated from the current project state.</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
            {[["Activities",`${done}/${acts.length}`,C.activity],["Risks",risks.length,C.milestone],["Stakeholders",stks.length,C.accentL],["Deliverables",dels.length,"#3a9ce0"]].map(([l,v,c])=>(
              <div key={l} style={{background:C.surface2,borderRadius:6,padding:"10px 12px",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:700,color:c,marginBottom:2}}>{v}</div>
                <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:".4px"}}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:5}}>
              <span>Overall Progress</span><span style={{color:C.activity,fontWeight:700}}>{pct}%</span>
            </div>
            <div style={{height:6,background:C.border,borderRadius:3,overflow:"hidden"}}>
              <div style={{width:`${pct}%`,height:"100%",background:pct>=70?C.activity:pct>=40?C.milestone:C.risk,transition:"width .5s"}}/>
            </div>
          </div>
          <button onClick={handleExport}
            style={{width:"100%",padding:"12px",background:C.accent,color:"#fff",border:"none",borderRadius:6,fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            ⬇ Download Full Workbook (.xlsx)
          </button>
          <div style={{fontSize:11,color:C.muted,textAlign:"center",marginTop:8}}>
            Includes all 9 sheets: Charter, Team, Schedule, RACI, Risks, Change Control, KD Tracker, Stakeholders, Comms Plan
          </div>
        </div>
      </div>
    </div>
  );
}
