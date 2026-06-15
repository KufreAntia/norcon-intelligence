const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };

const PHASE_COLORS = { Concept:"#9c6ee0", Definition:"#3a9ce0", Development:"#3ae0a2", "Handover & Closeout":"#e0a23a", "Benefits Realisation":"#e05c5c", Planning:"#3a9ce0", Execution:"#3ae0a2", "Monitoring & Control":"#e0a23a", Closure:"#8aac96" };

export default function L3Gantt({ activities, milestones }) {
  const allItems = [
    ...activities.map(a => ({ ...a, itemType:"activity" })),
    ...milestones.map(m => ({ ...m, itemType:"milestone" })),
  ];

  // Group by phase
  const phases = [...new Set(allItems.map(a => a.phase||"Unassigned"))];

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:11, color:C.muted, marginBottom:14 }}>
        Visual schedule by APM phase. All activities shown — Mark Complete from the Tasks tab.
      </div>

      {/* Phase legend */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
        {phases.map(p => (
          <div key={p} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:C.dim }}>
            <div style={{ width:8, height:8, borderRadius:2, background:PHASE_COLORS[p]||C.muted }}/>
            {p}
          </div>
        ))}
      </div>

      {phases.map(phase => {
        const items = allItems.filter(a => (a.phase||"Unassigned") === phase);
        const col   = PHASE_COLORS[phase] || C.muted;
        return (
          <div key={phase} style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:col, textTransform:"uppercase", letterSpacing:".5px", marginBottom:6, display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:3, height:14, background:col, borderRadius:2 }}/>
              {phase}
            </div>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:7, overflow:"hidden" }}>
              {items.map((item, i) => {
                const pct   = item._complete ? 100 : 0;
                const isMil = item.itemType === "milestone";
                const barCol = item._complete ? C.activity : col;
                return (
                  <div key={item._id||i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 14px", borderBottom: i<items.length-1 ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ width:70, fontFamily:"monospace", fontSize:10, color:isMil?C.milestone:C.muted, flexShrink:0 }}>{item._id}</div>
                    <div style={{ width:200, fontSize:12, color: item._complete ? C.muted : C.sage, textDecoration:item._complete?"line-through":"none", flexShrink:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {isMil ? "🏁 " : ""}{item.name||item.description||"—"}
                    </div>
                    <div style={{ flex:1, position:"relative" }}>
                      <div style={{ height:16, background:C.surface2, borderRadius:3, overflow:"hidden" }}>
                        <div style={{ width:`${pct}%`, height:"100%", background:barCol, borderRadius:3, transition:"width .5s ease", minWidth: pct>0?"4px":0 }}/>
                      </div>
                      {!isMil && (
                        <div style={{ position:"absolute", right:0, top:0, fontSize:9, color:C.muted, lineHeight:"16px", paddingRight:4 }}>
                          {pct}%
                        </div>
                      )}
                    </div>
                    <div style={{ width:80, fontSize:10, color:C.muted, textAlign:"right", flexShrink:0 }}>
                      {item.targetDate||"TBC"}
                    </div>
                    <div style={{ width:60, flexShrink:0 }}>
                      {item._complete
                        ? <span style={{ fontSize:9, color:C.activity, fontWeight:700 }}>✓ Done</span>
                        : <span style={{ fontSize:9, color:C.muted }}>Pending</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {allItems.length === 0 && (
        <div style={{ color:C.muted, fontSize:13, textAlign:"center", padding:40 }}>
          No activities in the schedule yet. Complete Sheet 03 in the Personalisation Layer.
        </div>
      )}
    </div>
  );
}
