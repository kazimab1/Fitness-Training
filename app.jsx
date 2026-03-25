const { useState, useRef } = React;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function extractArrayText(src, varName) {
  const marker = `const ${varName} = [`;
  const start = src.indexOf(marker);
  if (start === -1) return null;
  const arrStart = src.indexOf("[", start);
  let depth = 0, i = arrStart;
  while (i < src.length) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") { depth--; if (depth === 0) return src.slice(arrStart, i + 1); }
    i++;
  }
  return null;
}

// ─── PARSERS ─────────────────────────────────────────────────────────────────

function parseHTMLPlan(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const h1 = doc.querySelector("h1");
  const title = h1
    ? Array.from(h1.childNodes).map(n => n.textContent?.trim()).filter(Boolean).join(" ")
    : "Fitness Plan";
  const subtitle = doc.querySelector(".header-sub")?.textContent?.trim() || "";

  const stats = [...doc.querySelectorAll(".stat-chip")].map(c => ({
    label: c.querySelector(".label")?.textContent?.trim() || "",
    value: c.querySelector(".value")?.textContent?.trim() || "",
    orange: c.querySelector(".value.orange") !== null,
  })).filter(s => s.label);

  const days = [...doc.querySelectorAll(".day-card")].map((card, i) => {
    const badgeEl = card.querySelector(".day-badge");
    const cls = badgeEl?.className || "";
    const exercises = [...card.querySelectorAll(".exercise-list li")].map(li => ({
      name: li.querySelector(".ex-name")?.textContent?.trim() || "",
      detail: li.querySelector(".ex-detail")?.textContent?.trim() || "",
      duration: li.querySelector(".duration-badge")?.textContent?.trim() || "",
      sets: "", reps: "", rest: "", weight: "", note: "",
    })).filter(e => e.name);
    const dayNum = card.querySelector(".day-num")?.textContent?.trim() || String(i + 1).padStart(2, "0");
    return {
      label: card.querySelector(".day-name")?.textContent?.trim()?.slice(0, 3)?.toUpperCase() || `D${i + 1}`,
      dayNum,
      name: card.querySelector(".day-name")?.textContent?.trim() || "",
      focus: card.querySelector(".day-focus")?.textContent?.trim() || "",
      tag: badgeEl?.textContent?.trim() || "",
      color: cls.includes("cardio") ? "#3af0c8" : cls.includes("strength") ? "#f0a83a" : cls.includes("combo") ? "#c8f03a" : "#6b7280",
      exercises,
      cardio: null,
    };
  });

  const macros = [...doc.querySelectorAll(".macro-card")].map(c => ({
    value: c.querySelector(".macro-value")?.textContent?.trim() || "",
    label: c.querySelector(".macro-label")?.textContent?.trim() || "",
  }));

  const nutritionDays = [...doc.querySelectorAll(".meal-day")].map(md => ({
    title: md.querySelector(".meal-day-title")?.textContent?.trim().replace(/\s+/g, " ") || "",
    meals: [...md.querySelectorAll(".meal-slot")].map(slot => ({
      label: slot.querySelector(".meal-slot-label")?.textContent?.trim() || "",
      description: slot.querySelector("p")?.textContent?.trim() || "",
      cal: slot.querySelector(".meal-cal")?.textContent?.trim() || "",
    })).filter(m => m.label),
  }));

  const guidelines = [...doc.querySelectorAll(".guideline-card")].map(card => ({
    title: card.querySelector("h4")?.textContent?.trim() || "",
    items: [...card.querySelectorAll("li")].map(li => li.textContent?.trim()).filter(Boolean),
  }));

  const tipBoxes = [...doc.querySelectorAll(".tip-box")];
  const tips = tipBoxes.flatMap(box => {
    const heading = box.querySelector("h4")?.textContent?.trim() || "";
    return [...box.querySelectorAll("li")].map(li => ({ body: li.textContent?.trim() || "", heading }));
  }).filter(t => t.body);

  return { type: "html", title, subtitle, stats, days, macros, nutritionDays, nutritionMeals: null, guidelines, tips };
}

function parseJSXPlan(jsx) {
  try {
    const daysText = extractArrayText(jsx, "days");
    const mealsText = extractArrayText(jsx, "meals");
    const tipsText = extractArrayText(jsx, "tips");
    // eslint-disable-next-line no-new-func
    const days = daysText ? new Function(`return ${daysText}`)() : [];
    // eslint-disable-next-line no-new-func
    const meals = mealsText ? new Function(`return ${mealsText}`)() : [];
    // eslint-disable-next-line no-new-func
    const tips = tipsText ? new Function(`return ${tipsText}`)() : [];

    const headerMatch = jsx.match(/["']([A-Z][A-Z\s&+]+)["']/);
    const title = headerMatch ? headerMatch[1] : "Fitness Plan";
    const subMatch = jsx.match(/["']([A-Z][A-Z\s·\-+]+· [A-Za-z\s·\-+]+)["']/i);
    const subtitle = subMatch ? subMatch[1] : "";

    const totalKcal = meals.reduce((s, m) => s + (m.kcal || 0), 0);
    const totalProt = meals.reduce((s, m) => s + (m.protein || 0), 0);
    const totalCarb = meals.reduce((s, m) => s + (m.carbs || 0), 0);
    const totalFat  = meals.reduce((s, m) => s + (m.fat || 0), 0);
    const macros = meals.length ? [
      { value: `${totalKcal}`, label: "Total Cal/Day" },
      { value: `${totalProt}g`, label: "Protein" },
      { value: `${totalCarb}g`, label: "Carbs" },
      { value: `${totalFat}g`, label: "Fat" },
    ] : [];

    return { type: "jsx", title, subtitle, stats: [], days, macros, nutritionDays: null, nutritionMeals: meals, guidelines: [], tips };
  } catch (e) {
    console.error("JSX parse error:", e);
    return null;
  }
}

function parsePlan(content, fileName = "") {
  const isJSX = /\.(jsx|js|tsx|ts)$/i.test(fileName);
  const looksLikeJSX = content.includes("export default function") || content.includes("const days = [");
  if (isJSX || looksLikeJSX) {
    const r = parseJSXPlan(content);
    if (r) return r;
  }
  return parseHTMLPlan(content);
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S = {
  app: { fontFamily: "'DM Mono','Courier New',monospace", background: "#0a0a0a", minHeight: "100vh", color: "#f0f0f0", maxWidth: 480, margin: "0 auto", position: "relative", paddingBottom: 72 },
  header: { background: "linear-gradient(160deg,#141414 0%,#0d0d0d 100%)", borderBottom: "1px solid #1f1f1f", padding: "24px 20px 18px" },
  tag: { fontSize: 9, letterSpacing: "0.22em", color: "#555", textTransform: "uppercase", marginBottom: 6, display: "block" },
  h1: { fontSize: "clamp(24px,7vw,40px)", fontWeight: 900, margin: "0 0 4px", letterSpacing: "-0.03em", lineHeight: 1.1, background: "linear-gradient(90deg,#e8ff5a,#5affb0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  subtitle: { fontSize: 11, color: "#555", lineHeight: 1.6, marginTop: 4 },
  statsRow: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 },
  chip: { background: "#141414", border: "1px solid #1e1e1e", borderRadius: 6, padding: "7px 12px", display: "flex", flexDirection: "column", gap: 1 },
  chipLabel: { fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", color: "#444" },
  chipValue: { fontSize: 13, fontWeight: 700 },
  section: { padding: "18px 20px" },
  sectionTitle: { fontSize: 9, letterSpacing: "0.25em", color: "#444", textTransform: "uppercase", marginBottom: 14 },
  card: { background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, overflow: "hidden", marginBottom: 10 },
  navBar: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#0e0e0e", borderTop: "1px solid #1a1a1a", display: "flex", zIndex: 99 },
  navBtn: (active) => ({ flex: 1, padding: "10px 4px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, border: "none", background: "none", cursor: "pointer", color: active ? "#e8ff5a" : "#444", transition: "color 0.15s" }),
  navIcon: { fontSize: 19 },
  navLabel: { fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "inherit" },
};

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function EmptyState({ onImport }) {
  return (
    <div style={{ padding: "60px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#e8ff5a", marginBottom: 8, letterSpacing: "0.05em" }}>No plan loaded</div>
      <div style={{ fontSize: 11, color: "#444", lineHeight: 1.7, marginBottom: 24 }}>Import your fitness plan HTML or JSX file to get started.</div>
      <button onClick={onImport} style={{ background: "#e8ff5a", color: "#0a0a0a", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", fontFamily: "inherit", cursor: "pointer" }}>
        IMPORT A PLAN
      </button>
    </div>
  );
}

function HomePage({ plan, onImport }) {
  if (!plan) return <EmptyState onImport={onImport} />;
  const { title, subtitle, stats, macros, days } = plan;
  const workoutDays = days.filter(d => d.exercises?.length > 0 || d.cardio);
  const restDays = days.filter(d => !d.exercises?.length && !d.cardio);

  return (
    <div>
      <div style={S.header}>
        <span style={S.tag}>Fitness Tracker · Active Plan</span>
        <h1 style={S.h1}>{title}</h1>
        {subtitle && <div style={S.subtitle}>{subtitle}</div>}
        {stats.length > 0 && (
          <div style={S.statsRow}>
            {stats.map((s, i) => (
              <div key={i} style={S.chip}>
                <span style={S.chipLabel}>{s.label}</span>
                <span style={{ ...S.chipValue, color: s.orange ? "#ff8c5a" : "#e8ff5a" }}>{s.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={S.section}>
        <div style={S.sectionTitle}>Plan Overview</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Workout Days", value: workoutDays.length, color: "#e8ff5a" },
            { label: "Rest Days", value: restDays.length, color: "#5affb0" },
            { label: "Exercises", value: days.reduce((s, d) => s + (d.exercises?.length || 0), 0), color: "#ff8c5a" },
            { label: "Cardio Sessions", value: days.filter(d => d.cardio || (d.tag || "").toUpperCase().includes("CARDIO")).length, color: "#5ab4ff" },
          ].map((item, i) => (
            <div key={i} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: item.color, letterSpacing: "-0.03em" }}>{item.value}</div>
              <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {macros.length > 0 && (
          <>
            <div style={S.sectionTitle}>Nutrition Summary</div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {macros.map((m, i) => {
                const colors = ["#e8ff5a", "#5affb0", "#5ab4ff", "#ff8c5a"];
                return (
                  <div key={i} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", minWidth: 80, textAlign: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: colors[i % 4], letterSpacing: "-0.02em" }}>{m.value}</div>
                    <div style={{ fontSize: 8, color: "#444", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2 }}>{m.label}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div style={{ marginTop: 16 }}>
          <div style={S.sectionTitle}>This Week</div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {days.map((d, i) => (
              <div key={i} style={{ background: "#141414", border: `1px solid ${d.color}33`, borderRadius: 8, padding: "8px 10px", minWidth: 56, textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: d.color, letterSpacing: "0.1em" }}>{d.label}</div>
                <div style={{ fontSize: 8, color: "#444", marginTop: 3, letterSpacing: "0.05em" }}>{d.tag || d.focus?.split("—")[0]?.trim().split(" ")[0]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkoutPage({ plan, onImport }) {
  const [activeDay, setActiveDay] = useState(0);
  const [expanded, setExpanded] = useState({});
  if (!plan) return <EmptyState onImport={onImport} />;
  const { days } = plan;
  const day = days[activeDay] || days[0];

  const toggle = (i) => setExpanded(p => ({ ...p, [i]: !p[i] }));

  return (
    <div>
      <div style={S.header}>
        <span style={S.tag}>Workout Plan</span>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 12 }}>
          {day.name}
          <span style={{ fontSize: 10, fontWeight: 500, color: "#555", marginLeft: 8, letterSpacing: "0.15em" }}>
            {day.tag}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {days.map((d, i) => (
            <button key={i} onClick={() => setActiveDay(i)} style={{
              background: i === activeDay ? d.color : "#141414",
              color: i === activeDay ? "#0a0a0a" : "#555",
              border: `1px solid ${i === activeDay ? d.color : "#1e1e1e"}`,
              borderRadius: 6, padding: "5px 10px", fontSize: 9, fontWeight: 800,
              letterSpacing: "0.12em", cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
            }}>{d.label}</button>
          ))}
        </div>
      </div>

      <div style={S.section}>
        <div style={{ fontSize: 11, color: "#555", marginBottom: 14, fontStyle: "italic" }}>{day.focus}</div>

        {day.cardio && (
          <div style={{ background: "#141414", border: `1px solid ${day.color}44`, borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>{day.cardio.icon || "🏃"}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: day.color }}>{day.cardio.type}</div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>{day.cardio.duration} · {day.cardio.zone}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6, marginBottom: 10 }}>{day.cardio.pace}</div>
            {day.cardio.steps?.map((step, j) => (
              <div key={j} style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: "1px solid #1c1c1c", fontSize: 11 }}>
                <div style={{ color: day.color, fontWeight: 700, minWidth: 80 }}>{step.phase}</div>
                <div style={{ color: "#555" }}>{step.duration}</div>
                <div style={{ color: "#666", flex: 1 }}>{step.detail}</div>
              </div>
            ))}
          </div>
        )}

        {day.exercises?.length > 0 ? day.exercises.map((ex, i) => {
          const isOpen = expanded[i];
          const hasMeta = ex.sets || ex.reps || ex.rest || ex.weight;
          const hasDetail = ex.note || ex.detail;
          return (
            <div key={i} style={{ ...S.card, borderColor: isOpen ? day.color + "55" : "#1e1e1e" }}>
              <div onClick={() => (hasMeta || hasDetail) && toggle(i)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: (hasMeta || hasDetail) ? "pointer" : "default" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: day.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{ex.name}</div>
                  {!isOpen && (ex.detail || ex.note) && (
                    <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{ex.detail || ex.note}</div>
                  )}
                </div>
                {ex.duration && <div style={{ fontSize: 10, color: day.color, fontWeight: 700, flexShrink: 0 }}>{ex.duration}</div>}
                {hasMeta && <div style={{ fontSize: 10, color: "#333", marginLeft: 4 }}>{isOpen ? "▲" : "▼"}</div>}
              </div>
              {isOpen && (
                <div style={{ padding: "0 14px 12px", borderTop: "1px solid #1a1a1a" }}>
                  {hasMeta && (
                    <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
                      {[
                        { k: "Sets", v: ex.sets }, { k: "Reps", v: ex.reps },
                        { k: "Rest", v: ex.rest }, { k: "Weight", v: ex.weight },
                      ].filter(m => m.v).map(m => (
                        <div key={m.k} style={{ background: "#1a1a1a", borderRadius: 6, padding: "7px 10px", textAlign: "center", flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: day.color }}>{m.v}</div>
                          <div style={{ fontSize: 8, color: "#444", marginTop: 1, letterSpacing: "0.1em" }}>{m.k.toUpperCase()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {(ex.note || ex.detail) && (
                    <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6, marginTop: 4 }}>{ex.note || ex.detail}</div>
                  )}
                </div>
              )}
            </div>
          );
        }) : (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#333", fontSize: 11 }}>Rest day — no exercises today.</div>
        )}
      </div>
    </div>
  );
}

function NutritionPage({ plan, onImport }) {
  const [expanded, setExpanded] = useState({});
  const [dayIdx, setDayIdx] = useState(0);
  if (!plan) return <EmptyState onImport={onImport} />;
  const { macros, nutritionDays, nutritionMeals } = plan;

  const toggle = (i) => setExpanded(p => ({ ...p, [i]: !p[i] }));
  const colors = ["#e8ff5a", "#5affb0", "#5ab4ff", "#ff8c5a"];

  return (
    <div>
      <div style={S.header}>
        <span style={S.tag}>Nutrition Plan</span>
        {macros.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            {macros.map((m, i) => (
              <div key={i} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 8, padding: "10px 12px", flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: colors[i % 4], letterSpacing: "-0.02em" }}>{m.value}</div>
                <div style={{ fontSize: 8, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>{m.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={S.section}>
        {/* HTML plan: per-day layout */}
        {nutritionDays && nutritionDays.length > 0 && (
          <>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 14 }}>
              {nutritionDays.map((nd, i) => (
                <button key={i} onClick={() => setDayIdx(i)} style={{
                  background: i === dayIdx ? "#e8ff5a" : "#141414",
                  color: i === dayIdx ? "#0a0a0a" : "#555",
                  border: `1px solid ${i === dayIdx ? "#e8ff5a" : "#1e1e1e"}`,
                  borderRadius: 6, padding: "5px 10px", fontSize: 8, fontWeight: 800,
                  letterSpacing: "0.1em", cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                  whiteSpace: "nowrap", textTransform: "uppercase",
                }}>{nd.title.split(/[/·]/)[0]?.trim().slice(0, 9) || `Day ${i + 1}`}</button>
              ))}
            </div>
            {nutritionDays[dayIdx]?.meals.map((meal, i) => (
              <div key={i} style={{ ...S.card, marginBottom: 8 }}>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ fontSize: 9, color: "#5affb0", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>{meal.label}</div>
                  <div style={{ fontSize: 12, color: "#ccc", lineHeight: 1.6 }}>{meal.description}</div>
                  {meal.cal && <div style={{ fontSize: 10, color: "#444", marginTop: 6 }}>{meal.cal}</div>}
                </div>
              </div>
            ))}
          </>
        )}

        {/* JSX plan: per-meal layout */}
        {nutritionMeals && nutritionMeals.map((meal, i) => {
          const isOpen = expanded[i];
          return (
            <div key={i} style={{ ...S.card, borderColor: isOpen ? "#e8ff5a33" : "#1e1e1e" }}>
              <div onClick={() => toggle(i)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", cursor: "pointer" }}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>{meal.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{meal.name}</div>
                  <div style={{ fontSize: 9, color: "#444", marginTop: 1, letterSpacing: "0.05em" }}>{meal.time}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#e8ff5a" }}>{meal.kcal}</div>
                  <div style={{ fontSize: 8, color: "#333", letterSpacing: "0.1em" }}>KCAL</div>
                </div>
                <div style={{ fontSize: 10, color: "#333", marginLeft: 4, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</div>
              </div>
              {isOpen && (
                <div style={{ padding: "0 14px 14px", borderTop: "1px solid #1a1a1a" }}>
                  <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
                    {[{ l: "Protein", v: `${meal.protein}g`, c: "#5affb0" }, { l: "Carbs", v: `${meal.carbs}g`, c: "#5ab4ff" }, { l: "Fat", v: `${meal.fat}g`, c: "#ff8c5a" }].map(m => (
                      <div key={m.l} style={{ flex: 1, background: "#1a1a1a", borderRadius: 6, padding: "8px", textAlign: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: m.c }}>{m.v}</div>
                        <div style={{ fontSize: 8, color: "#444", marginTop: 1, letterSpacing: "0.1em" }}>{m.l.toUpperCase()}</div>
                      </div>
                    ))}
                  </div>
                  {meal.items?.map((item, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: j < meal.items.length - 1 ? "1px solid #1c1c1c" : "none" }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#333", flexShrink: 0 }} />
                      <div style={{ fontSize: 11, color: "#bbb" }}>{item}</div>
                    </div>
                  ))}
                  {meal.tip && (
                    <div style={{ background: "#1a1a1a", borderRadius: 8, padding: "10px 12px", fontSize: 11, color: "#666", lineHeight: 1.6, marginTop: 10 }}>
                      <span style={{ color: "#e8ff5a" }}>💡 </span>{meal.tip}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GuidePage({ plan, onImport }) {
  if (!plan) return <EmptyState onImport={onImport} />;
  const { guidelines, tips } = plan;

  return (
    <div>
      <div style={S.header}>
        <span style={S.tag}>Guidelines &amp; Tips</span>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Key Principles</div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>Follow these for sustainable results.</div>
      </div>

      <div style={S.section}>
        {guidelines.length > 0 && (
          <>
            <div style={S.sectionTitle}>Guidelines</div>
            {guidelines.map((g, i) => (
              <div key={i} style={{ background: "#141414", border: "1px solid #1e1e1e", borderLeft: "3px solid #3af0c8", borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#3af0c8", marginBottom: 10 }}>{g.title}</div>
                {g.items.map((item, j) => (
                  <div key={j} style={{ fontSize: 11, color: "#666", padding: "4px 0", paddingLeft: 14, position: "relative", lineHeight: 1.5 }}>
                    <span style={{ position: "absolute", left: 0, color: "#3af0c8", fontSize: 9 }}>·</span>
                    {item}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

        {tips.length > 0 && (
          <>
            <div style={{ ...S.sectionTitle, marginTop: guidelines.length > 0 ? 20 : 0 }}>
              {Array.isArray(tips) && typeof tips[0] === "object" && tips[0].title ? "Pro Tips" : "Tips & Notes"}
            </div>
            {tips.map((tip, i) => {
              if (typeof tip === "string") {
                return (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < tips.length - 1 ? "1px solid #161616" : "none" }}>
                    <span style={{ color: "#c8f03a", fontSize: 10, flexShrink: 0, marginTop: 2 }}>→</span>
                    <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6 }}>{tip}</div>
                  </div>
                );
              }
              const accentColors = ["#e8ff5a", "#5affb0", "#ff5a8a", "#ff8c5a", "#ffb347", "#c77dff", "#5ab4ff"];
              const c = tip.color || accentColors[i % accentColors.length];
              return (
                <div key={i} style={{ background: "#141414", border: "1px solid #1e1e1e", borderLeft: `3px solid ${c}`, borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    {tip.icon && <span style={{ fontSize: 18 }}>{tip.icon}</span>}
                    <div style={{ fontSize: 12, fontWeight: 800, color: c }}>{tip.title || tip.heading}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#666", lineHeight: 1.7 }}>{tip.body}</div>
                </div>
              );
            })}
          </>
        )}

        {guidelines.length === 0 && tips.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#333", fontSize: 11 }}>No guidelines in this plan.</div>
        )}
      </div>
    </div>
  );
}

function ImportPage({ onImport }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState(null); // null | 'success' | 'error'
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const handleContent = (content, fileName = "") => {
    try {
      if (!content.trim()) { setStatus("empty"); return; }
      const plan = parsePlan(content, fileName);
      if (plan && (plan.days?.length > 0 || plan.nutritionMeals?.length > 0)) {
        setStatus("success");
        setTimeout(() => onImport(plan), 600);
      } else {
        setStatus("error");
      }
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  };

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = e => handleContent(e.target.result, file.name);
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleParse = () => handleContent(text, "plan.html");

  return (
    <div>
      <div style={S.header}>
        <span style={S.tag}>Import Plan</span>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Load Your Plan</div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>Upload an HTML or JSX fitness plan file, or paste the code below.</div>
      </div>

      <div style={S.section}>
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? "#e8ff5a" : "#2a2a2a"}`,
            borderRadius: 12, padding: "28px 20px", textAlign: "center",
            cursor: "pointer", marginBottom: 16, transition: "border-color 0.2s",
            background: dragging ? "rgba(232,255,90,0.04)" : "transparent",
          }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#ccc", marginBottom: 4 }}>Drop file here or tap to browse</div>
          <div style={{ fontSize: 10, color: "#444" }}>Supports .html · .jsx · .js</div>
          <input ref={fileRef} type="file" accept=".html,.htm,.jsx,.js" style={{ display: "none" }}
            onChange={e => { const f = e.target.files[0]; if (f) handleFile(f); }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
          <div style={{ fontSize: 9, color: "#333", letterSpacing: "0.15em" }}>OR PASTE CODE</div>
          <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
        </div>

        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setStatus(null); }}
          placeholder="Paste your HTML or JSX plan here…"
          style={{
            width: "100%", minHeight: 160, background: "#141414", border: "1px solid #1e1e1e",
            borderRadius: 10, padding: "12px 14px", color: "#ccc", fontSize: 11,
            fontFamily: "inherit", lineHeight: 1.6, resize: "vertical", outline: "none",
            boxSizing: "border-box",
          }}
        />

        {status === "success" && (
          <div style={{ background: "rgba(90,255,176,0.08)", border: "1px solid #5affb044", borderRadius: 8, padding: "10px 14px", marginTop: 10, fontSize: 11, color: "#5affb0", display: "flex", alignItems: "center", gap: 8 }}>
            <span>✓</span> Plan parsed! Returning to home page…
          </div>
        )}
        {status === "error" && (
          <div style={{ background: "rgba(255,90,90,0.08)", border: "1px solid #ff5a5a44", borderRadius: 8, padding: "10px 14px", marginTop: 10, fontSize: 11, color: "#ff5a5a", display: "flex", alignItems: "center", gap: 8 }}>
            <span>✗</span> Could not parse this file. Make sure it's a valid fitness plan HTML or JSX.
          </div>
        )}
        {status === "empty" && (
          <div style={{ background: "rgba(255,140,90,0.08)", border: "1px solid #ff8c5a44", borderRadius: 8, padding: "10px 14px", marginTop: 10, fontSize: 11, color: "#ff8c5a", display: "flex", alignItems: "center", gap: 8 }}>
            <span>!</span> Please paste some content or upload a file first.
          </div>
        )}

        <button
          onClick={handleParse}
          style={{
            width: "100%", marginTop: 14, background: "#e8ff5a", color: "#0a0a0a",
            border: "none", borderRadius: 10, padding: "13px", fontSize: 11,
            fontWeight: 900, letterSpacing: "0.15em", fontFamily: "inherit",
            cursor: "pointer", textTransform: "uppercase",
          }}>
          Parse &amp; Load Plan
        </button>

        <div style={{ marginTop: 28, borderTop: "1px solid #161616", paddingTop: 20 }}>
          <div style={S.sectionTitle}>Supported formats</div>
          {[
            ["HTML Plan (.html)", "The Your Fitness Blueprint format with .day-card, .meal-day, .guideline-card structure"],
            ["JSX Plan (.jsx / .js)", "React component with const days = [...] and const meals = [...] data arrays"],
          ].map(([title, desc], i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#ccc", marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 10, color: "#444", lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function FitnessTracker() {
  const [page, setPage] = useState("home");
  const [plan, setPlan] = useState(null);

  const handleImport = (parsed) => {
    setPlan(parsed);
    setPage("home");
  };

  const navItems = [
    { id: "home", icon: "⊞", label: "Home" },
    { id: "workout", icon: "◉", label: "Workout" },
    { id: "nutrition", icon: "◈", label: "Nutrition" },
    { id: "guide", icon: "◫", label: "Guide" },
    { id: "import", icon: "⊕", label: "Import" },
  ];

  return (
    <div style={S.app}>
      <div style={{ paddingBottom: 72 }}>
        {page === "home" && <HomePage plan={plan} onImport={() => setPage("import")} />}
        {page === "workout" && <WorkoutPage plan={plan} onImport={() => setPage("import")} />}
        {page === "nutrition" && <NutritionPage plan={plan} onImport={() => setPage("import")} />}
        {page === "guide" && <GuidePage plan={plan} onImport={() => setPage("import")} />}
        {page === "import" && <ImportPage onImport={handleImport} />}
      </div>

      <nav style={S.navBar}>
        {navItems.map(({ id, icon, label }) => (
          <button key={id} onClick={() => setPage(id)} style={S.navBtn(page === id)}>
            <span style={{ ...S.navIcon, fontStyle: "normal" }}>{icon}</span>
            <span style={S.navLabel}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<FitnessTracker />);
