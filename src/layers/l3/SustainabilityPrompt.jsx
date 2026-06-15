import { useState } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c" };

// One question per focus area
const PROMPTS = {
  "Resource Use":        "Did this activity minimise unnecessary resource consumption?",
  "Travel":              "Was travel for this activity kept to a minimum or offset?",
  "Waste":               "Was waste minimised during this activity?",
  "Digital Delivery":    "Was this activity delivered digitally where possible?",
  "Accessibility":       "Was this activity accessible to all intended participants?",
  "Diversity":           "Did this activity promote inclusion and diverse participation?",
  "Community Benefit":   "Did this activity create measurable benefit for the community?",
  "Wellbeing":           "Did this activity support participant wellbeing?",
  "Skills Development":  "Did participants gain useful skills from this activity?",
  "Knowledge Creation":  "Were reusable insights or materials produced?",
  "Skills Transfer":     "Were skills transferred to others during this activity?",
  "Partnerships":        "Were new partnerships formed or strengthened?",
  "Project Continuity":  "Will outputs from this activity continue beyond the project?",
};

const DIM_COLORS = {
  environmental:"#3ae0a2", social:"#3a9ce0", governance:"#e0a23a", legacy:"#9c6ee0",
};

// Find the most relevant prompt for an activity based on enabled sustainability config
function getPromptForActivity(activity, sustainConfig) {
  if (!sustainConfig?.enabled) return null;
  const { enabled, selected } = sustainConfig;
  // Try to match activity name/phase to a focus area
  const actText = `${activity.name||""} ${activity.phase||""} ${activity.description||""}`.toLowerCase();
  // Priority mapping
  const keywords = {
    "Skills Development": ["train","workshop","skill","learn","develop","educat"],
    "Community Benefit":  ["community","outreach","public","partner","engage"],
    "Knowledge Creation": ["research","document","report","lesson","knowledge","analys"],
    "Accessibility":      ["access","inclusive","participant","attend"],
    "Digital Delivery":   ["digital","online","virtual","remote","web"],
    "Resource Use":       ["resource","material","supply","procure","equipment"],
    "Travel":             ["travel","visit","site","transport","trip"],
    "Partnerships":       ["partner","collaborat","stakeholder","sponsor"],
    "Project Continuity": ["handover","closure","transition","sustain","legacy"],
    "Wellbeing":          ["wellbeing","health","welfare","support"],
    "Diversity":          ["diversi","inclusiv","equal"],
    "Waste":              ["waste","recycl","reuse","environment"],
    "Skills Transfer":    ["transfer","train","mentor","coach","handover"],
  };

  // Find matching area that is enabled
  for (const [area, kws] of Object.entries(keywords)) {
    const dimId = Object.keys(enabled).find(d =>
      enabled[d] && (selected[d]||[]).includes(area)
    );
    if (!dimId) continue;
    if (kws.some(kw => actText.includes(kw))) {
      return { area, dimId, question: PROMPTS[area], color: DIM_COLORS[dimId] };
    }
  }

  // Fallback — pick first enabled area
  for (const dimId of Object.keys(enabled)) {
    if (!enabled[dimId]) continue;
    const areas = selected[dimId] || [];
    if (areas.length > 0) {
      const area = areas[0];
      return { area, dimId, question: PROMPTS[area], color: DIM_COLORS[dimId] };
    }
  }
  return null;
}

export default function SustainabilityPrompt({ activity, sustainConfig, onRecord, onSkip }) {
  const [answer, setAnswer] = useState(null);
  const prompt = getPromptForActivity(activity, sustainConfig);

  if (!prompt) { onSkip?.(); return null; }

  const options = [
    { value:"yes",       label:"Yes",       score:1.0 },
    { value:"partially", label:"Partially", score:0.5 },
    { value:"no",        label:"No",        score:0.0 },
  ];

  const handleSubmit = () => {
    if (!answer) return;
    const opt = options.find(o=>o.value===answer);
    onRecord({ area: prompt.area, dimId: prompt.dimId, answer, score: opt.score, activityId: activity._id, activityName: activity.name });
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:1001,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:C.surface, border:`1px solid ${prompt.color}44`,
        borderRadius:10, width:"100%", maxWidth:400, overflow:"hidden",
        boxShadow:"0 20px 60px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ background:`${prompt.color}11`, borderBottom:`1px solid ${prompt.color}33`,
          padding:"12px 16px", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:prompt.color, flexShrink:0 }}/>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:prompt.color, textTransform:"uppercase",
              letterSpacing:".5px" }}>Sustainability Check · {prompt.area}</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>{activity.name}</div>
          </div>
        </div>

        {/* Question */}
        <div style={{ padding:"20px 16px" }}>
          <div style={{ fontSize:14, color:C.sage, lineHeight:1.6, marginBottom:20, fontWeight:500 }}>
            {prompt.question}
          </div>

          {/* Options */}
          <div style={{ display:"flex", gap:8, marginBottom:20 }}>
            {options.map(opt => (
              <button key={opt.value} onClick={()=>setAnswer(opt.value)}
                style={{ flex:1, padding:"10px 8px", borderRadius:6, fontSize:12, fontWeight:600,
                  border:`1px solid ${answer===opt.value ? prompt.color : C.border}`,
                  background: answer===opt.value ? `${prompt.color}22` : "none",
                  color: answer===opt.value ? prompt.color : C.muted,
                  cursor:"pointer", transition:"all .15s" }}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onSkip}
              style={{ flex:1, padding:"8px", background:"none", border:`1px solid ${C.border}`,
                borderRadius:5, color:C.muted, fontSize:11, cursor:"pointer" }}>
              Skip
            </button>
            <button onClick={handleSubmit} disabled={!answer}
              style={{ flex:2, padding:"8px", background:answer?prompt.color:C.surface2,
                border:"none", borderRadius:5,
                color:answer?"#fff":C.muted, fontSize:12, fontWeight:700,
                cursor:answer?"pointer":"not-allowed" }}>
              Record & Continue →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { getPromptForActivity };
