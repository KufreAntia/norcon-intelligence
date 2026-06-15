import * as XLSX from "xlsx";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", activity:"#3ae0a2" };

export default function L3Report({ state, project, charter, activities, milestones, risks, deliverables, stakeholders, teamMembers, raciData }) {

  const generateExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 01 — Charter
    const c = charter || {};
    const s01 = [
      ["NorCon Projects — Project Workbook"],
      ["Generated:", new Date().toLocaleString()],
      [],
      ["PROJECT CHARTER"],
      ["Field", "Value"],
      ["Project Name",       c.projectName    || ""],
      ["Project Code",       c.projectCode    || ""],
      ["Project Manager",    c.projectManager || ""],
      ["Project Sponsor",    c.projectSponsor || ""],
      ["Organisation",       c.organisation   || ""],
      ["Start Date",         c.startDate      || ""],
      ["End Date",           c.endDate        || ""],
      ["Budget",             c.budget         || ""],
      ["Purpose",            c.purpose        || ""],
      ["Problem Statement",  c.problemStatement || ""],
      ["Strategic Alignment",c.strategicAlignment || ""],
      [],
      ["OBJECTIVES"],
      ["#", "Objective", "Success Criterion", "Target Date"],
      ...(c.objectives||[]).map((o,i) => [i+1, o.objective, o.successCriterion, o.targetDate||""]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s01), "01 Charter");

    // Sheet 02 — Team
    const s02 = [
      ["TEAM REGISTER"],
      ["Login Code", "Name", "PM Role", "Delivery Role", "Availability", "Location"],
      ...teamMembers.map(m => [m.loginCode, m.name, m.role, m.deliveryRole||"", m.availability||"", m.location||""]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s02), "02 Team");

    // Sheet 03 — Schedule
    const s03 = [
      ["MASTER SCHEDULE"],
      ["ID", "Name", "Phase", "Responsible", "Status"],
      ...activities.map(a => [a._id, a.name, a.phase, a.responsible, a._complete?"Complete":"In Progress"]),
      [],
      ["MILESTONES"],
      ["ID", "Name", "Phase", "Target Date", "Status"],
      ...milestones.map(m => [m._id, m.name, m.phase, m.targetDate||"TBC", m._complete?"Complete":"Pending"]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s03), "03 Schedule");

    // Sheet 04 — RACI
    const members = teamMembers.filter(m=>m.name&&m.role);
    const raciRows = [...(raciData.raciRows||[]), ...(raciData.customRows||[])];
    const s04 = [
      ["RACI MATRIX"],
      ["Task ID", "Task", "Phase", ...members.map(m => `${m.loginCode} (${m.name})`), "Status"],
      ...raciRows.map(r => [
        r.taskId, r.label, r.phase||"",
        ...members.map(m => r.assignments?.[m.loginCode]||""),
        activities.find(a=>a._id===r.taskId)?._complete ? "Complete" : "Pending",
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s04), "04 RACI");

    // Sheet 05 — Risks
    const s05 = [
      ["RISK REGISTER"],
      ["Risk ID", "Name", "Category", "Cause", "Potential Impact", "Likelihood", "Impact", "Score", "Mitigation", "Response", "Owner"],
      ...risks.map(r => [
        r._id, r.name, r.category, r.cause, r.potentialImpact,
        r.likelihood, r.impact,
        (parseInt(r.likelihood)||1)*(parseInt(r.impact)||1),
        r.mitigation, r.response, r._suggestedOwner||"",
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s05), "05 Risk Register");

    // Sheet 06 — Change Control
    const changes = state.l2?.sheets?.["06"]?.data?.changes || [];
    const s06 = [
      ["CHANGE CONTROL LOG"],
      ["CCR ID", "Date", "Requested By", "Type", "Description", "Impact", "Decision"],
      ...changes.map(c => [c.id, c.date, c.requestedBy, c.type, c.description, c.impact, c.decision]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s06), "06 Change Control");

    // Sheet 07 — KD Tracker
    const s07 = [
      ["KD TRACKER — DELIVERABLES"],
      ["Del ID", "Name", "KPI", "Target", "Actual", "Achievement %", "Deadline"],
      ...deliverables.map(d => [
        d._id, d.name, d.kpi, d.target, d.actual,
        d.target && d.actual ? Math.round((parseFloat(d.actual)/parseFloat(d.target))*100)+"%" : "—",
        d.deadlineV1||"",
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s07), "07 KD Tracker");

    // Sheet 08 — Stakeholders
    const s08 = [
      ["STAKEHOLDER MATRIX"],
      ["SH ID", "Name", "Category", "Contact", "Power", "Interest", "Influence", "Ease", "Priority Score", "Strategy", "Status"],
      ...stakeholders.map(s => [
        s._id, s.name, s.category, s.contact,
        s.power, s.interest, s.influence, s.ease,
        (((parseInt(s.power)||5)+(parseInt(s.influence)||5))/2*(parseInt(s.interest)||5)/10).toFixed(1),
        s.engagementStrategy, s.status||"Identified",
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s08), "08 Stakeholders");

    // Sheet 09 — Comms
    const comms = state.l2?.sheets?.["09"]?.data?.comms || [];
    const s09 = [
      ["COMMUNICATIONS PLAN"],
      ["Stakeholder", "Category", "Contact", "Format", "Frequency", "Key Content", "Next Date", "Status"],
      ...comms.map(c => [c.stakeholderName, c.category, c.contact, c.format, c.frequency, c.keyContent, c.nextDate||"", c.status]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s09), "09 Comms Plan");

    // Export
    const filename = `NorCon_${(project.code||"PROJECT")}_Workbook_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const totalTasks = activities.length;
  const doneTasks  = activities.filter(a => a._complete).length;
  const pct        = totalTasks > 0 ? Math.round((doneTasks/totalTasks)*100) : 0;

  return (
    <div style={{ padding:20, maxWidth:700 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:9, padding:"24px 28px", marginBottom:16 }}>
        <div style={{ fontSize:16, fontWeight:700, color:C.sage, marginBottom:4 }}>Project Workbook Export</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:20, lineHeight:1.6 }}>
          Generates a full Excel workbook with all 9 sheets populated from the current project state.
          Includes Charter, Team, Schedule, RACI, Risk Register, Change Control, KD Tracker, Stakeholders and Comms Plan.
        </div>

        {/* Summary */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:20 }}>
          {[
            [`${pct}%`, "Progress",    `${doneTasks}/${totalTasks} tasks`],
            [risks.length,  "Risks",       "in register"],
            [stakeholders.length, "Stakeholders", "identified"],
            [deliverables.length, "Deliverables", "tracked"],
          ].map(([v,l,s])=>(
            <div key={l} style={{ background:C.surface2, borderRadius:6, padding:"10px 12px", textAlign:"center" }}>
              <div style={{ fontSize:20, fontWeight:700, color:C.sage }}>{v}</div>
              <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:".4px" }}>{l}</div>
              <div style={{ fontSize:10, color:C.muted }}>{s}</div>
            </div>
          ))}
        </div>

        {/* Sheets included */}
        <div style={{ marginBottom:20 }}>
          {[["01","Charter"],["02","Team Register"],["03","Master Schedule"],["04","RACI Matrix"],["05","Risk Register"],["06","Change Control"],["07","KD Tracker"],["08","Stakeholder Matrix"],["09","Comms Plan"]].map(([n,l])=>(
            <div key={n} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <span style={{ fontSize:10, color:C.accentL, fontFamily:"monospace", width:30 }}>{n}</span>
              <span style={{ color:C.sage }}>{l}</span>
              <span style={{ marginLeft:"auto", fontSize:10, color:C.activity }}>✓ Included</span>
            </div>
          ))}
        </div>

        <button onClick={generateExcel}
          style={{ width:"100%", padding:"12px", background:C.accent, color:"#fff", border:"none", borderRadius:7, fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          ⬇ Download Project Workbook
        </button>
      </div>
    </div>
  );
}
