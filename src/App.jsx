import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  FileText,
  FileUp,
  Flame,
  HeartPulse,
  Info,
  RotateCcw,
  Salad,
  ShieldAlert,
  Sparkles,
  Target,
  Upload,
} from 'lucide-react'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerSrc

const STORAGE_KEY = 'fitness-trainer-plan-v1'
const DONE_KEY = 'fitness-trainer-progress-v1'

const DEFAULT_PLAN = {
  title: 'Your Plan',
  subtitle: 'Week 1 · Fat Loss & Strength',
  exerciseSchedule: '7-day fat loss and strength programme',
  mealPlan: '1,600 to 1,750 kcal per day · High protein · Whole foods',
  calories: 1700,
  protein: '130g',
  carbs: '160g',
  fats: '55g',
  cardioSessions: '3 sessions',
  targetLoss: '0.5 to 0.75 kg per week',
  guidelines: [
    'Prioritize protein at every meal.',
    'Train with intent and maintain clean form.',
    'Aim for 7,000 to 10,000 daily steps.',
    'Hydrate well and sleep at least 7 hours.'
  ],
  healthNote: [
    'Consult your physician before starting, especially before intense cardio.',
    'Adjust the plan if your recovery, pain, or energy levels worsen.',
    'Stop immediately if you feel chest pain, dizziness, or unusual shortness of breath.'
  ],
  days: [
    {
      day: 'Monday',
      workout: 'Lower Body Strength',
      details: 'Squats, Romanian deadlifts, lunges, calf raises, core finisher',
      meals: 'High-protein breakfast, lean lunch, balanced dinner',
      tip: 'Use a controlled tempo and focus on range of motion.'
    },
    {
      day: 'Tuesday',
      workout: 'Zone 2 Cardio and Mobility',
      details: '30 to 40 minutes brisk walk or cycling plus 10 minutes mobility',
      meals: 'Keep calories steady and fiber high',
      tip: 'Cardio should feel sustainable, not maximal.'
    },
    {
      day: 'Wednesday',
      workout: 'Upper Body Strength',
      details: 'Press, row, pulldown, shoulders, biceps, triceps',
      meals: 'Prioritize protein post-workout',
      tip: 'Leave 1 to 2 reps in reserve on main lifts.'
    },
    {
      day: 'Thursday',
      workout: 'Recovery',
      details: 'Light walk, stretching, hydration, sleep focus',
      meals: 'Maintain protein and avoid mindless snacking',
      tip: 'Recovery quality drives training quality.'
    },
    {
      day: 'Friday',
      workout: 'Full Body Conditioning',
      details: 'Circuit of goblet squat, push-ups, rows, carries, bike sprints',
      meals: 'Pre-workout carbs, protein throughout the day',
      tip: 'Keep rest periods honest and consistent.'
    },
    {
      day: 'Saturday',
      workout: 'Cardio Intervals',
      details: '6 to 8 intervals with full easy recoveries',
      meals: 'Front-load hydration and electrolytes',
      tip: 'Push intensity only if recovery is good.'
    },
    {
      day: 'Sunday',
      workout: 'Rest Day',
      details: 'Walk, meal prep, reflection, bodyweight mobility',
      meals: 'Stay consistent and prepare for the next week',
      tip: 'A great week starts with a prepared Sunday.'
    }
  ]
}

function extractNumber(text, fallback) {
  if (!text) return fallback
  const match = String(text).match(/(\d+[\d,.]*)/)
  return match ? Number(match[1].replace(/,/g, '')) : fallback
}

function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitLines(text) {
  return String(text || '')
    .split(/\n|\r/)
    .map((line) => cleanText(line))
    .filter(Boolean)
}

function parseHtmlToText(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  return cleanText(doc.body?.innerText || doc.body?.textContent || html)
    .replace(/\.\s+/g, '.\n')
    .replace(/:\s+/g, ': ')
}

function findLine(lines, patterns) {
  return lines.find((line) => patterns.some((pattern) => pattern.test(line)))
}

function pickAfterLabel(text, labelRegex, fallback = '') {
  const match = String(text || '').match(labelRegex)
  return match?.[1]?.trim() || fallback
}

function normalizeImportedPlan(sourceText, sourceType = 'text') {
  const text = String(sourceText || '')
  const lines = splitLines(text)

  const title =
    lines[0] ||
    pickAfterLabel(text, /(?:title|plan)\s*[:\-]\s*([^\n]+)/i, DEFAULT_PLAN.title)

  const subtitle =
    findLine(lines, [/week\s*\d+/i, /strength/i, /fat loss/i, /muscle/i, /hypertrophy/i]) ||
    DEFAULT_PLAN.subtitle

  const caloriesLine = findLine(lines, [/calories/i, /kcal/i])
  const proteinLine = findLine(lines, [/protein/i])
  const carbsLine = findLine(lines, [/carbs?/i, /carbohydrates/i])
  const fatsLine = findLine(lines, [/fats?/i])
  const cardioLine = findLine(lines, [/cardio/i])
  const targetLossLine = findLine(lines, [/target loss/i, /weight loss/i, /kg\/wk/i, /lb\/wk/i])
  const exerciseLine = findLine(lines, [/exercise schedule/i, /workout schedule/i, /programme/i, /program/i])
  const mealLine = findLine(lines, [/meal plan/i, /nutrition/i, /diet/i])

  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const foundDayIndexes = lines
    .map((line, index) => ({ line: line.toLowerCase(), index }))
    .filter(({ line }) => weekdays.some((d) => line.includes(d)))

  let days = []
  if (foundDayIndexes.length > 0) {
    days = foundDayIndexes.slice(0, 7).map((entry, i, arr) => {
      const start = entry.index
      const end = arr[i + 1]?.index ?? Math.min(lines.length, start + 4)
      const block = lines.slice(start, end)
      const heading = block[0] || DEFAULT_PLAN.days[i]?.day || `Day ${i + 1}`
      const workout = block[1] || DEFAULT_PLAN.days[i]?.workout || 'Workout'
      const details = block.slice(2, 5).join(' · ') || DEFAULT_PLAN.days[i]?.details || 'Details not provided'
      return {
        day: heading,
        workout,
        details,
        meals: DEFAULT_PLAN.days[i]?.meals || 'Meal guidance not provided',
        tip: DEFAULT_PLAN.days[i]?.tip || 'Stay consistent and track your recovery.'
      }
    })
  }

  if (days.length === 0) {
    const listCandidates = lines.filter((line) => /day\s*\d+|push|pull|legs|upper|lower|cardio|recovery|rest/i.test(line))
    days = DEFAULT_PLAN.days.map((d, i) => ({
      ...d,
      workout: listCandidates[i] || d.workout
    }))
  }

  const guidelineStart = lines.findIndex((line) => /guidelines?|principles|notes/i.test(line))
  const importedGuidelines = guidelineStart >= 0 ? lines.slice(guidelineStart + 1, guidelineStart + 5) : []
  const safetyLines = lines
    .filter((line) => /consult|doctor|physician|stop if|dizziness|breathlessness|pain/i.test(line))
    .slice(0, 3)

  return {
    title,
    subtitle,
    exerciseSchedule: exerciseLine || DEFAULT_PLAN.exerciseSchedule,
    mealPlan: mealLine || DEFAULT_PLAN.mealPlan,
    calories: extractNumber(caloriesLine, DEFAULT_PLAN.calories),
    protein: pickAfterLabel(proteinLine || '', /protein[^\d]*(\d+\s*g?)/i, DEFAULT_PLAN.protein),
    carbs: pickAfterLabel(carbsLine || '', /carbs?[^\d]*(\d+\s*g?)/i, DEFAULT_PLAN.carbs),
    fats: pickAfterLabel(fatsLine || '', /fats?[^\d]*(\d+\s*g?)/i, DEFAULT_PLAN.fats),
    cardioSessions: cardioLine || DEFAULT_PLAN.cardioSessions,
    targetLoss: targetLossLine || DEFAULT_PLAN.targetLoss,
    guidelines: importedGuidelines.length ? importedGuidelines : DEFAULT_PLAN.guidelines,
    healthNote: safetyLines.length ? safetyLines : DEFAULT_PLAN.healthNote,
    days,
    importedFrom: sourceType,
    importedAt: new Date().toISOString(),
    rawSource: text.slice(0, 12000)
  }
}

async function parsePdfText(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const pdf = await getDocument({ data: bytes }).promise
  const pages = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(`Page ${pageNumber}\n${text}`)
  }

  return pages.join('\n\n')
}

function StatCard({ icon: Icon, label, value, subvalue }) {
  return (
    <section className="card stat-card">
      <div className="icon-chip"><Icon size={18} /></div>
      <div>
        <p className="muted small">{label}</p>
        <p className="stat-value">{value}</p>
        {subvalue ? <p className="muted tiny">{subvalue}</p> : null}
      </div>
    </section>
  )
}

function DayCard({ item, done, onToggle }) {
  return (
    <section className="card day-card">
      <div className="day-card__header">
        <div>
          <h3>{item.day}</h3>
          <p className="muted">{item.workout}</p>
        </div>
        <button className={`button ${done ? 'button-secondary' : ''}`} onClick={onToggle}>
          <CheckCircle2 size={16} />
          {done ? 'Done' : 'Mark Done'}
        </button>
      </div>
      <div className="detail-block">
        <strong>Workout Details</strong>
        <p>{item.details}</p>
      </div>
      <div className="detail-block">
        <strong>Meal Focus</strong>
        <p>{item.meals}</p>
      </div>
      <div className="detail-block">
        <strong>Coach Tip</strong>
        <p>{item.tip}</p>
      </div>
    </section>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [plan, setPlan] = useState(DEFAULT_PLAN)
  const [doneDays, setDoneDays] = useState([])
  const [pastedHtml, setPastedHtml] = useState('')
  const [importStatus, setImportStatus] = useState('No file imported yet.')
  const [importPreview, setImportPreview] = useState('')
  const [fileName, setFileName] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const savedPlan = localStorage.getItem(STORAGE_KEY)
    const savedDoneDays = localStorage.getItem(DONE_KEY)

    if (savedPlan) {
      try {
        setPlan(JSON.parse(savedPlan))
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }

    if (savedDoneDays) {
      try {
        setDoneDays(JSON.parse(savedDoneDays))
      } catch {
        localStorage.removeItem(DONE_KEY)
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
  }, [plan])

  useEffect(() => {
    localStorage.setItem(DONE_KEY, JSON.stringify(doneDays))
  }, [doneDays])

  const progress = useMemo(() => {
    const total = plan.days?.length || 7
    return Math.round((doneDays.length / total) * 100)
  }, [doneDays, plan.days])

  const todayItem = useMemo(() => {
    const todayIndex = new Date().getDay()
    const normalized = todayIndex === 0 ? 6 : todayIndex - 1
    return plan.days?.[normalized] || plan.days?.[0]
  }, [plan.days])

  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'plan', label: 'Plan' },
    { id: 'meals', label: 'Meals' },
    { id: 'tips', label: 'Tips' },
    { id: 'import', label: 'Import' }
  ]

  const toggleDay = (index) => {
    setDoneDays((current) =>
      current.includes(index) ? current.filter((i) => i !== index) : [...current, index]
    )
  }

  const resetProgress = () => setDoneDays([])

  const handleImportedText = (text, sourceType, sourceLabel) => {
    const parsed = normalizeImportedPlan(text, sourceType)
    setPlan(parsed)
    setImportPreview(text.slice(0, 4000))
    setImportStatus(`Imported ${sourceLabel} successfully.`)
    setActiveTab('plan')
  }

  const importHtmlFile = async (file) => {
    const html = await file.text()
    const text = parseHtmlToText(html)
    handleImportedText(text, 'html', file.name)
  }

  const importPdfFile = async (file) => {
    const text = await parsePdfText(file)
    handleImportedText(text, 'pdf', file.name)
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setIsParsing(true)
    setImportStatus(`Reading ${file.name}...`)

    try {
      const isHtml = /text\/html|application\/xhtml\+xml/i.test(file.type) || /\.html?$/i.test(file.name)
      const isPdf = /application\/pdf/i.test(file.type) || /\.pdf$/i.test(file.name)

      if (isHtml) {
        await importHtmlFile(file)
      } else if (isPdf) {
        await importPdfFile(file)
      } else {
        throw new Error('Unsupported file type. Upload an HTML or PDF plan.')
      }
    } catch (error) {
      setImportStatus(error.message || 'Import failed.')
    } finally {
      setIsParsing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePasteImport = () => {
    if (!pastedHtml.trim()) {
      setImportStatus('Paste your fitness plan HTML first.')
      return
    }

    const text = parseHtmlToText(pastedHtml)
    handleImportedText(text, 'html-paste', 'pasted HTML')
  }

  return (
    <div className="app-shell">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="layout"
        >
          <main className="main-column">
            <section className="card hero-card">
              <div className="hero-topline">
                <HeartPulse size={16} />
                <span>Personal Fitness Tracker</span>
              </div>

              <div className="hero-row">
                <div>
                  <h1>{plan.title}</h1>
                  <p className="hero-subtitle">{plan.subtitle}</p>
                </div>

                <div className="badge-group">
                  <span className="badge">
                    {plan.importedFrom ? `Imported from ${plan.importedFrom}` : 'Default template'}
                  </span>
                  <span className="badge">
                    <CalendarDays size={14} />
                    7-Day Programme
                  </span>
                </div>
              </div>

              <div className="stats-grid">
                <StatCard icon={Flame} label="Daily Calories" value={`${plan.calories} kcal`} />
                <StatCard icon={Target} label="Protein Goal" value={plan.protein} subvalue="per day" />
                <StatCard icon={Dumbbell} label="Cardio / Week" value={plan.cardioSessions} />
                <StatCard icon={Salad} label="Target Loss" value={plan.targetLoss} />
              </div>
            </section>

            <section className="card progress-card">
              <div className="section-row">
                <div>
                  <h2>Weekly Progress</h2>
                  <p className="muted">Days done {doneDays.length} / {plan.days?.length || 7}</p>
                </div>
                <div className="button-row">
                  <button className="button button-secondary" onClick={resetProgress}>
                    <RotateCcw size={16} />
                    Reset
                  </button>
                  <button className="button" onClick={() => setActiveTab('import')}>
                    <Upload size={16} />
                    Import Plan
                  </button>
                </div>
              </div>
              <div className="progress-meta">
                <span className="muted">Completion</span>
                <strong>{progress}%</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </section>

            <nav className="tab-bar">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab-button ${activeTab === tab.id ? 'tab-button-active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {activeTab === 'home' && (
              <section className="split-grid">
                <article className="card">
                  <h2>Today</h2>
                  <p className="muted">Your focus for the current day</p>
                  <div className="stack gap-lg">
                    <div>
                      <p className="small muted">Workout</p>
                      <h3>{todayItem?.workout}</h3>
                    </div>
                    <div>
                      <p className="small muted">Details</p>
                      <p>{todayItem?.details}</p>
                    </div>
                    <div>
                      <p className="small muted">Meal focus</p>
                      <p>{todayItem?.meals}</p>
                    </div>
                  </div>
                </article>

                <article className="card">
                  <h2>At a Glance</h2>
                  <p className="muted">Core plan structure</p>
                  <div className="stack gap-lg">
                    <div>
                      <strong>Exercise Schedule</strong>
                      <p>{plan.exerciseSchedule}</p>
                    </div>
                    <div>
                      <strong>Meal Plan</strong>
                      <p>{plan.mealPlan}</p>
                    </div>
                    <div className="mini-grid">
                      <div className="mini-card">
                        <span className="tiny muted">Calories</span>
                        <strong>{plan.calories}</strong>
                      </div>
                      <div className="mini-card">
                        <span className="tiny muted">Protein</span>
                        <strong>{plan.protein}</strong>
                      </div>
                      <div className="mini-card">
                        <span className="tiny muted">Carbs</span>
                        <strong>{plan.carbs}</strong>
                      </div>
                    </div>
                  </div>
                </article>
              </section>
            )}

            {activeTab === 'plan' && (
              <section className="stack gap-md">
                {plan.days?.map((item, index) => (
                  <DayCard
                    key={`${item.day}-${index}`}
                    item={item}
                    done={doneDays.includes(index)}
                    onToggle={() => toggleDay(index)}
                  />
                ))}
              </section>
            )}

            {activeTab === 'meals' && (
              <section className="split-grid">
                <article className="card">
                  <h2>Nutrition Targets</h2>
                  <p className="muted">Based on your imported or default plan</p>
                  <div className="stats-grid two-col">
                    <div className="mini-card tall"><span className="small muted">Calories</span><strong>{plan.calories}</strong></div>
                    <div className="mini-card tall"><span className="small muted">Protein</span><strong>{plan.protein}</strong></div>
                    <div className="mini-card tall"><span className="small muted">Carbs</span><strong>{plan.carbs}</strong></div>
                    <div className="mini-card tall"><span className="small muted">Fats</span><strong>{plan.fats}</strong></div>
                  </div>
                </article>

                <article className="card">
                  <h2>Meal Plan Summary</h2>
                  <p className="muted">{plan.mealPlan}</p>
                  <div className="stack gap-sm">
                    {plan.days?.map((item, index) => (
                      <div key={`meal-${index}`} className="mini-card">
                        <strong>{item.day}</strong>
                        <p>{item.meals}</p>
                      </div>
                    ))}
                  </div>
                </article>
              </section>
            )}

            {activeTab === 'tips' && (
              <section className="split-grid">
                <article className="card">
                  <h2>Key Guidelines</h2>
                  <p className="muted">Principles for sustainable progress</p>
                  <div className="stack gap-sm">
                    {plan.guidelines?.map((item, index) => (
                      <div key={`guide-${index}`} className="list-item">
                        <Info size={16} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="card">
                  <h2>Health Note</h2>
                  <p className="muted">Important safety reminders</p>
                  <div className="stack gap-sm">
                    {plan.healthNote?.map((item, index) => (
                      <div key={`safety-${index}`} className="list-item warning">
                        <ShieldAlert size={16} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </article>
              </section>
            )}

            {activeTab === 'import' && (
              <section className="import-grid">
                <article className="card">
                  <h2>Import Fitness Plan</h2>
                  <p className="muted">
                    Upload an HTML or PDF plan. The app extracts text, rebuilds the weekly structure, and stores it locally.
                  </p>

                  <div className="upload-panel">
                    <div className="icon-chip"><FileUp size={18} /></div>
                    <div>
                      <strong>Upload HTML or PDF</strong>
                      <p className="muted small">Supported files: .html, .htm, .pdf</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".html,.htm,.pdf,text/html,application/pdf"
                        onChange={handleFileUpload}
                        className="file-input"
                      />
                    </div>
                  </div>

                  <div className="stack gap-sm">
                    <p className="section-label"><FileText size={16} /> Or paste plan HTML</p>
                    <textarea
                      className="textarea"
                      value={pastedHtml}
                      onChange={(event) => setPastedHtml(event.target.value)}
                      placeholder="Paste your fitness plan HTML here..."
                    />
                    <button className="button" onClick={handlePasteImport}>
                      <Sparkles size={16} />
                      Parse Plan
                    </button>
                  </div>

                  <div className="mini-card">
                    <strong>Status</strong>
                    <p>{isParsing ? 'Parsing your file...' : importStatus}</p>
                    {fileName ? <p className="tiny muted">Current file: {fileName}</p> : null}
                  </div>
                </article>

                <article className="card">
                  <h2>Imported Plan Preview</h2>
                  <p className="muted">Review the extracted content and verify the generated structure.</p>
                  <div className="stats-grid two-col">
                    <div className="mini-card tall">
                      <span className="small muted">Plan Title</span>
                      <strong>{plan.title}</strong>
                    </div>
                    <div className="mini-card tall">
                      <span className="small muted">Imported Source</span>
                      <strong className="capitalize">{plan.importedFrom || 'default'}</strong>
                    </div>
                    <div className="mini-card tall">
                      <span className="small muted">Calories</span>
                      <strong>{plan.calories}</strong>
                    </div>
                    <div className="mini-card tall">
                      <span className="small muted">Days Found</span>
                      <strong>{plan.days?.length || 0}</strong>
                    </div>
                  </div>
                  <div className="code-preview">
                    <strong>Raw Extracted Text</strong>
                    <pre>{importPreview || 'No imported content yet.'}</pre>
                  </div>
                </article>
              </section>
            )}
          </main>

          <aside className="side-column">
            <section className="card">
              <h2>Coach Dashboard</h2>
              <p className="muted">A compact summary of the current plan</p>
              <div className="stack gap-sm">
                <div className="mini-card">
                  <span className="small muted">Current workout schedule</span>
                  <strong>{plan.exerciseSchedule}</strong>
                </div>
                <div className="mini-card">
                  <span className="small muted">Current nutrition strategy</span>
                  <strong>{plan.mealPlan}</strong>
                </div>
                <div className="mini-card">
                  <span className="small muted">This week&apos;s adherence</span>
                  <strong>{progress}% complete</strong>
                </div>
              </div>
            </section>

            <section className="card">
              <h2>How the import works</h2>
              <div className="stack gap-sm">
                <div className="mini-card">1. Upload an HTML or PDF fitness plan.</div>
                <div className="mini-card">2. The app extracts text and identifies calories, macros, schedule, and day blocks.</div>
                <div className="mini-card">3. The parsed plan becomes the active program and persists in local storage.</div>
              </div>
            </section>
          </aside>
        </motion.div>
      </div>
    </div>
  )
}
