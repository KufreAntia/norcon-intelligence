import { useState } from "react";
import * as XLSX from "xlsx";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };

// ── Excel style helpers ───────────────────────────────────────────────────
const HDR_STYLE = {
  fill: { fgColor:{ rgb:"0D2B1B" }, patternType:"solid" },
  font: { color:{ rgb:"E5F0E8" }, bold:true, sz:11 },
  alignment: { horizontal:"left", vertical:"center", wrapText:true },
  border: { bottom:{ style:"thin", color:{ rgb:"2E7D52" } } },
};
const SUB_HDR_STYLE = {
  fill: { fgColor:{ rgb:"122E1E" }, patternType:"solid" },
  font: { color:{ rgb:"3a9962" }, bold:true, sz:10 },
  alignment: { horizontal:"left", vertical:"center" },
};
const ALT_STYLE = {
  fill: { fgColor:{ rgb:"183D28" }, patternType:"solid" },
  font: { color:{ rgb:"b8d4c0" }, sz:10 },
  alignment: { wrapText:true, vertical:"top" },
};
const NORMAL_STYLE = {
  fill: { fgColor:{ rgb:"122E1E" }, patternType:"solid" },
  font: { color:{ rgb:"E5F0E8" }, sz:10 },
  alignment: { wrapText:true, vertical:"top" },
};
const RAG_RED   = { fill:{ fgColor:{ rgb:"2a1515" }, patternType:"solid" }, font:{ color:{ rgb:"e05c5c" }, bold:true, sz:10 } };
const RAG_AMBER = { fill:{ fgColor:{ rgb:"2a2010" }, patternType:"solid" }, font:{ color:{ rgb:"e0a23a" }, bold:true, sz:10 } };
const RAG_GREEN = { fill:{ fgColor:{ rgb:"102a20" }, patternType:"solid" }, font:{ color:{ rgb:"3ae0a2" }, bold:true, sz:10 } };
const DONE_STYLE= { fill:{ fgColor:{ rgb:"102a20" }, patternType:"solid" }, font:{ color:{ rgb:"3ae0a2" }, sz:10 } };

function ragStyle(l, i) {
  const s = (parseInt(l)||1)*(parseInt(i)||1);
  return s>=9 ? RAG_RED : s>=4 ? RAG_AMBER : RAG_GREEN;
}

// Apply style to a range of cells
function styleRange(ws, startRow, endRow, startCol, endCol, style) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v:"", t:"s" };
      ws[addr].s = style;
    }
  }
}

// Style a single row
function styleRow(ws, row, cols, style) {
  for (let c = 0; c < cols; c++) {
    const addr = XLSX.utils.encode_cell({ r:row, c });
    if (!ws[addr]) ws[addr] = { v:"", t:"s" };
    ws[addr].s = style;
  }
}

// Add styled header row to a sheet
function addHeader(ws, row, headers, colWidths) {
  headers.forEach((h, c) => {
    const addr = XLSX.utils.encode_cell({ r:row, c });
    ws[addr] = { v:h, t:"s", s:HDR_STYLE };
  });
  ws["!cols"] = colWidths.map(w => ({ wch:w }));
  ws["!freeze"] = { xSplit:0, ySplit:row+1 };
}

// Build styled sheet from data
function buildSheet(headers, rows, colWidths, ragColFn) {
  const ws = {};
  // Header
  headers.forEach((h,c) => {
    ws[XLSX.utils.encode_cell({r:0,c})] = { v:h, t:"s", s:HDR_STYLE };
  });
  // Data rows
  rows.forEach((row, ri) => {
    const style = ri%2===0 ? NORMAL_STYLE : ALT_STYLE;
    row.forEach((val, c) => {
      const addr = XLSX.utils.encode_cell({r:ri+1, c});
      const cellStyle = ragColFn ? ragColFn(ri, c, val, row) || style : style;
      ws[addr] = { v: val==null?"":String(val), t:"s", s:cellStyle };
    });
  });
  ws["!cols"] = colWidths.map(w => ({ wch:w }));
  ws["!ref"]  = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:rows.length,c:headers.length-1} });
  ws["!freeze"] = { xSplit:0, ySplit:1 };
  return ws;
}

export default function L3Report({ state, project, charter, activities, milestones, risks, deliverables, stakeholders, teamMembers, raciData }) {
  const [generating, setGenerating] = useState(false);
  const [aiSummary,  setAiSummary]  = useState("");
  const [genStep,    setGenStep]    = useState("");

  const totalTasks = activities.length;
  const doneTasks  = activities.filter(a => a._complete).length;
  const pct        = totalTasks > 0 ? Math.round((doneTasks/totalTasks)*100) : 0;
  const redRisks   = risks.filter(r=>(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1)>=9).length;
  const ambRisks   = risks.filter(r=>{const s=(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1);return s>=4&&s<9;}).length;
  const nextMs     = milestones.filter(m=>!m._complete&&m.targetDate).sort((a,b)=>new Date(a.targetDate)-new Date(b.targetDate))[0];
  const overdueActs= activities.filter(a=>!a._complete&&a.targetDate&&new Date(a.targetDate)<new Date()).length;

  const generateReport = async () => {
    setGenerating(true);
    setGenStep("Generating executive summary...");
    setAiSummary("");

    // Build summary prompt
    const c = charter||{};
    const summaryPrompt = `You are generating an Executive Summary for a project workbook. Write a professional, concise narrative (300-400 words) for the following project. Use plain English suitable for a Project Sponsor. Structure it with these sections: Project Overview, Progress Update, Key Risks, Upcoming Milestones, Recommendations.

PROJECT: ${c.projectName||project?.name||"Unknown"}
PURPOSE: ${c.purpose||"Not specified"}
PM: ${c.projectManager||"Not specified"} | SPONSOR: ${c.projectSponsor||"Not specified"}
DATES: ${c.startDate||"TBC"} to ${c.endDate||"TBC"} | BUDGET: ${c.budget||"Not specified"}

PROGRESS: ${pct}% complete (${doneTasks} of ${totalTasks} tasks done). ${overdueActs} tasks overdue.

RISKS: ${risks.length} total — ${redRisks} RED (immediate action), ${ambRisks} AMBER (monitoring), ${risks.length-redRisks-ambRisks} GREEN.
Top risks: ${risks.slice(0,3).map(r=>`${r.name} (score ${(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1)})`).join("; ")||"None recorded"}

MILESTONES: ${milestones.length} total, ${milestones.filter(m=>m._complete).length} complete.
Next: ${nextMs ? `${nextMs.name} due ${nextMs.targetDate}` : "None scheduled"}

DELIVERABLES: ${deliverables.length} tracked. ${deliverables.filter(d=>parseFloat(d.actual||0)>=parseFloat(d.target||1)).length} achieved target.

STAKEHOLDERS: ${stakeholders.length} identified.

Write the summary now. Be direct and factual. Flag any red items clearly.`;

    try {
      const res = await fetch("/api/extract", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:1000,
          messages:[{ role:"user", content:summaryPrompt }]
        })
      });
      const data = await res.json();
      const summary = (data.content||[]).map(b=>b.text||"").join("").trim();
      setAiSummary(summary);
      setGenStep("Building workbook...");
      await generateExcel(summary);
    } catch(err) {
      setGenStep("AI summary failed — generating workbook without summary.");
      await generateExcel("Executive summary could not be generated automatically. Please add manually.");
    }
    setGenerating(false);
    setGenStep("");
  };

  const generateExcel = async (summary) => {
    const wb = XLSX.utils.book_new();
    const c  = charter||{};

    // ── Sheet 0 — Executive Summary ────────────────────────────────────
    const s00 = {};
    const summaryRows = [
      [`${c.projectName||project?.name||"Project"} — Executive Summary`],
      [`Generated: ${new Date().toLocaleString()}`],
      [`Project Manager: ${c.projectManager||"—"}  |  Sponsor: ${c.projectSponsor||"—"}  |  Status: ${pct}% Complete`],
      [""],
      [summary],
    ];
    summaryRows.forEach((row,ri)=>{
      row.forEach((val,ci)=>{
        const addr = XLSX.utils.encode_cell({r:ri,c:ci});
        const style = ri===0 ? HDR_STYLE : ri===2 ? SUB_HDR_STYLE : NORMAL_STYLE;
        s00[addr] = { v:val, t:"s", s:style };
      });
    });
    s00["!cols"]  = [{ wch:120 }];
    s00["!merges"]= [{ s:{r:0,c:0}, e:{r:0,c:3} },{ s:{r:4,c:0}, e:{r:4,c:3} }];
    s00["!ref"]   = XLSX.utils.encode_range({s:{r:0,c:0},e:{r:5,c:3}});
    XLSX.utils.book_append_sheet(wb, s00, "00 Executive Summary");

    // ── Sheet 01 — Charter ─────────────────────────────────────────────
    const charterRows = [
      ["Project Name",       c.projectName||""],
      ["Project Code",       c.projectCode||""],
      ["Project Manager",    c.projectManager||""],
      ["Project Sponsor",    c.projectSponsor||""],
      ["Organisation",       c.organisation||""],
      ["Start Date",         c.startDate||""],
      ["End Date",           c.endDate||""],
      ["Budget",             c.budget||""],
      ["Purpose",            c.purpose||""],
      ["Problem Statement",  c.problemStatement||""],
      ["Strategic Alignment",c.strategicAlignment||""],
      ["Within Scope",       (c.withinScope||[]).join("; ")],
      ["Out of Scope",       (c.outOfScope||[]).join("; ")],
    ];
    const s01 = buildSheet(["Field","Value"], charterRows, [28,80], null);
    if((c.objectives||[]).length){
      const objStart = charterRows.length + 3;
      // add objectives section
    }
    XLSX.utils.book_append_sheet(wb, s01, "01 Charter");

    // ── Sheet 02 — Team ────────────────────────────────────────────────
    const s02 = buildSheet(
      ["Login Code","Name","PM / Governance Role","Delivery Role","Availability","Location","Responsibilities"],
      teamMembers.map(m=>[m.loginCode,m.name,m.role,m.deliveryRole||"",m.availability||"",m.location||"",m.responsibilities||""]),
      [14,22,28,24,14,16,40], null
    );
    XLSX.utils.book_append_sheet(wb, s02, "02 Team");

    // ── Sheet 03 — Schedule ────────────────────────────────────────────
    const actRows = activities.map(a=>[a._id,a.name||"",a.phase||"",a.responsible||"",a.startDate||"",a.targetDate||"",a._complete?"Complete":"In Progress"]);
    const msRows  = milestones.map(m=>[m._id,m.name||"",m.phase||"","—","",m.targetDate||"",m._complete?"Complete":"Pending"]);
    const s03 = buildSheet(
      ["ID","Activity / Milestone","Phase","Responsible","Start Date","Target Date","Status"],
      [...actRows,...msRows],
      [12,40,22,24,14,14,14],
      (ri,ci,val) => {
        if(ci===6 && val==="Complete") return DONE_STYLE;
        return null;
      }
    );
    XLSX.utils.book_append_sheet(wb, s03, "03 Schedule");

    // ── Sheet 04 — RACI ────────────────────────────────────────────────
    const members  = teamMembers.filter(m=>m.name&&m.role);
    const raciRows = [...(raciData.raciRows||[]),...(raciData.customRows||[])];
    const raciData2 = raciRows.map(row=>[
      row.taskId, row.label||"", row.phase||"",
      ...members.map(m=>row.assignments?.[m.loginCode]||""),
    ]);
    const s04 = buildSheet(
      ["Task ID","Task","Phase",...members.map(m=>`${m.name}\n(${m.loginCode})`)],
      raciData2,
      [12,40,20,...members.map(()=>16)],
      (ri,ci,val) => {
        if(ci>=3){
          if(val==="R") return RAG_RED;
          if(val==="A") return RAG_AMBER;
          if(val==="C") return { fill:{fgColor:{rgb:"102030"},patternType:"solid"}, font:{color:{rgb:"3a9ce0"},bold:false,sz:10} };
          if(val==="I") return { fill:{fgColor:{rgb:"1e1030"},patternType:"solid"}, font:{color:{rgb:"9c6ee0"},bold:false,sz:10} };
        }
        return null;
      }
    );
    XLSX.utils.book_append_sheet(wb, s04, "04 RACI");

    // ── Sheet 05 — Risk Register ───────────────────────────────────────
    const s05 = buildSheet(
      ["Risk ID","Name","Category","Cause","Potential Impact","Likelihood","Impact","Score","Mitigation","Response","Owner"],
      risks.map(r=>{
        const score=(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1);
        return [r._id,r.name||"",r.category||"",r.cause||"",r.potentialImpact||"",r.likelihood||"",r.impact||"",score,r.mitigation||"",r.response||"",r._suggestedOwner||""];
      }),
      [12,30,24,30,30,14,14,10,40,14,20],
      (ri,ci,val,row) => {
        if(ci===7) return ragStyle(row[5],row[6]);
        return null;
      }
    );
    XLSX.utils.book_append_sheet(wb, s05, "05 Risk Register");

    // ── Sheet 06 — Change Control ──────────────────────────────────────
    const changes = state.l2?.sheets?.["06"]?.data?.changes||[];
    const s06 = buildSheet(
      ["CCR ID","Date","Requested By","Type","Description","Impact","Decision","Approved By"],
      changes.map(c=>[c.id,c.date,c.requestedBy,c.type,c.description,c.impact,c.decision,c.approvedBy||""]),
      [12,14,20,20,40,30,14,20],
      (ri,ci,val) => {
        if(ci===6){
          if(val==="Approved") return DONE_STYLE;
          if(val==="Rejected") return RAG_RED;
          if(val==="Pending")  return RAG_AMBER;
        }
        return null;
      }
    );
    XLSX.utils.book_append_sheet(wb, s06, "06 Change Control");

    // ── Sheet 07 — KD Tracker ─────────────────────────────────────────
    const s07 = buildSheet(
      ["Del ID","Deliverable","KPI Metric","Target","Actual","Achievement %","Deadline","Notes"],
      deliverables.map(d=>{
        const pct2 = d.target&&d.actual ? Math.round((parseFloat(d.actual)/parseFloat(d.target))*100)+"%" : "—";
        return [d._id||"",d.name||"",d.kpi||"",d.target||"",d.actual||"",pct2,d.deadlineV1||"",d.notes||""];
      }),
      [12,36,30,12,12,16,14,30],
      (ri,ci,val) => {
        if(ci===5&&val!=="—"){
          const n=parseInt(val);
          return n>=100?DONE_STYLE:n>=60?RAG_AMBER:RAG_RED;
        }
        return null;
      }
    );
    XLSX.utils.book_append_sheet(wb, s07, "07 KD Tracker");

    // ── Sheet 08 — Stakeholders ────────────────────────────────────────
    const s08 = buildSheet(
      ["SH ID","Name","Category","Contact","Power","Interest","Influence","Ease","Priority Score","Engagement Strategy","Status"],
      stakeholders.map(s=>{
        const ps=(((parseInt(s.power)||5)+(parseInt(s.influence)||5))/2*(parseInt(s.interest)||5)/10).toFixed(1);
        return [s._id||"",s.name||"",s.category||"",s.contact||"",s.power||5,s.interest||5,s.influence||5,s.ease||5,ps,s.engagementStrategy||"",s.status||"Identified"];
      }),
      [12,28,20,24,10,10,12,10,16,40,14], null
    );
    XLSX.utils.book_append_sheet(wb, s08, "08 Stakeholders");

    // ── Sheet 09 — Comms Plan ─────────────────────────────────────────
    const comms = state.l2?.sheets?.["09"]?.data?.comms||[];
    const s09 = buildSheet(
      ["Stakeholder","Category","Contact","Format","Frequency","Key Content","Next Date","Escalation Path","Status"],
      comms.map(c=>[c.stakeholderName||"",c.category||"",c.contact||"",c.format||"",c.frequency||"",c.keyContent||"",c.nextDate||"",c.escalationPath||"",c.status||""]),
      [28,20,24,16,16,40,14,30,14], null
    );
    XLSX.utils.book_append_sheet(wb, s09, "09 Comms Plan");

    // ── Export ─────────────────────────────────────────────────────────
    const filename = `NorCon_${(project?.code||"PROJECT")}_Workbook_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, filename, { bookType:"xlsx", type:"binary", cellStyles:true });
  };

  return (
    <div style={{padding:20, maxWidth:720}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"24px 28px",marginBottom:16}}>
        <div style={{fontSize:16,fontWeight:700,color:C.sage,marginBottom:4}}>Project Workbook Export</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:20,lineHeight:1.6}}>
          Generates a fully styled Excel workbook with an AI-generated Executive Summary on Sheet 00,
          followed by all 9 project registers with header formatting, RAG colour coding and freeze panes.
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:20}}>
          {[[`${pct}%`,"Progress",`${doneTasks}/${totalTasks} tasks`],[redRisks>0?redRisks:"✓","Red Risks",redRisks>0?"need action":"all clear"],[nextMs?.name||"None","Next Milestone",nextMs?.targetDate||"—"],[stakeholders.length,"Stakeholders","identified"]].map(([v,l,s])=>(
            <div key={l} style={{background:C.surface2,borderRadius:6,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:700,color:redRisks>0&&l==="Red Risks"?C.risk:C.sage}}>{v}</div>
              <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:".4px"}}>{l}</div>
              <div style={{fontSize:10,color:C.muted}}>{s}</div>
            </div>
          ))}
        </div>

        {/* Sheet list */}
        <div style={{marginBottom:20}}>
          {[["00","Executive Summary","AI-generated narrative — project health in plain English"],
            ["01","Charter","Project details, purpose, scope, objectives"],
            ["02","Team Register","Login codes, roles, availability"],
            ["03","Master Schedule","All activities and milestones with status"],
            ["04","RACI Matrix","R/A/C/I assignments with colour coding"],
            ["05","Risk Register","All risks with RAG scores highlighted"],
            ["06","Change Control","Change log with decision status"],
            ["07","KD Tracker","Deliverables vs KPIs with achievement %"],
            ["08","Stakeholder Matrix","PIIE scores and engagement strategies"],
            ["09","Comms Plan","Communication schedule per stakeholder"],
          ].map(([n,l,d])=>(
            <div key={n} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
              <span style={{fontSize:10,color:C.accentL,fontFamily:"monospace",width:28,flexShrink:0}}>{n}</span>
              <span style={{color:C.sage,fontWeight:600,minWidth:140,flexShrink:0}}>{l}</span>
              <span style={{color:C.muted,fontSize:11}}>{d}</span>
              <span style={{marginLeft:"auto",fontSize:10,color:n==="00"?C.accentL:C.activity,flexShrink:0}}>{n==="00"?"✨ AI":"✓"}</span>
            </div>
          ))}
        </div>

        {/* AI summary preview */}
        {aiSummary && (
          <div style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:7,padding:"14px 16px",marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:700,color:C.accentL,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>✨ AI Executive Summary Preview</div>
            <div style={{fontSize:12,color:C.dim,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{aiSummary}</div>
          </div>
        )}

        {/* Generate button */}
        <button onClick={generateReport} disabled={generating}
          style={{width:"100%",padding:"13px",background:generating?C.surface2:C.accent,color:"#fff",border:"none",borderRadius:7,fontSize:14,fontWeight:700,cursor:generating?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
          {generating ? (
            <>
              <div style={{width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
              {genStep}
            </>
          ) : "📊 Generate Project Workbook"}
        </button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
