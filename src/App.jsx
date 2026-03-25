import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Dumbbell,
  FileText,
  FileUp,
  Flame,
  HeartPulse,
  Home,
  Info,
  Salad,
  ShieldAlert,
  Sparkles,
  Target,
  Upload,
} from 'lucide-react'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerSrc

const STORAGE_KEY = 'fitness-trainer-plan-v2'
const DONE_KEY = 'fitness-trainer-progress-v2'

const DEFAULT_PLAN = {
  title: 'YOUR PLAN',
  subtitle: 'Week 1 · Fat Loss & Strength',
  exerciseSchedule: '7-day fat loss & strength programme',
  mealPlan: '~1,600–1,750 kcal/day · High protein · Whole foods',
  calories: 1700,
  protein: '130g',
  carbs: '160g',
  fats: '55g',
  cardioSessions: '3 sessions',
  targetLoss: '0.5–0.75 kg/wk',
  guidelines: [
    'Prioritize protein at every meal.',
    'Train with intent and maintain clean form.',
    'Aim for 7,000–10,000 daily steps.',
    'Hydrate well and sleep at least 7 hours.'
  ],
  healthNote: [
    'Consult your GP before starting — especially for cardiovascular workouts.',
    'This plan is general guidance — adjust based on your body\'s response.',
    'Stop if you feel chest pain, dizziness, or unusual breathlessness.'
  ],
  days: [
    {
      day: 'Monday',
      workout: 'Lower Body Strength',
      details: 'Squats, RDLs, lunges, calf raises, core finisher',
      meals: 'High-protein breakfast, lean lunch, balanced dinner',
      tip: 'Use a controlled tempo and focus on range of motion.'
    },
    {
      day: 'Tuesday',
      workout: 'Zone 2 Cardio + Mobility',
      details: '30–40 min brisk walk or cycling, 10 min mobility',
      meals: 'Keep calories steady and fiber high',
      tip: 'Cardio should feel sustainable, not maximal.'
    },
    {
      day: 'Wednesday',
      workout: 'Upper Body Strength',
      details: 'Press, row, pulldown, shoulders, biceps, triceps',
      meals: 'Prioritize protein post-workout',
      tip: 'Leave 1–2 reps in reserve on main lifts.'
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
      details: 'Circuit: goblet squat, push-ups, rows, carries, bike sprints',
      meals: 'Pre-workout carbs, protein throughout the day',
      tip: 'Keep rest periods honest and consistent.'
    },
    {
      day: 'Saturday',
      workout: 'Cardio Intervals',
      details: '6–8 intervals with full easy recoveries',
      meals: 'Front-load hydration and electrolytes',
      tip: 'Push intensity only if recovery is good.'
    },
    {
      day: 'Sunday',
      workout: 'Rest Day',
      details: 'Walk, meal prep, reflection, mobility',
      meals: 'Stay consistent and prepare for the next week',
      tip: 'A great week starts with a prepared Sunday.'
    }
  ]
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function cleanText(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()
}

function splitLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter(Boolean)
}

function dedupeLines(lines) {
  const seen = new Set()
  return lines.filter((line) => {
    const key = line.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function extractNumber(text, fallback) {
  if (!text) return fallback
  const match = String(text).match(/(\d+[\d,.]*)/)
  return match ? Number(match[1].replace(/,/g, '')) : fallback
}

function pickMatch(text, regex, fallback = '') {
  const match = String(text || '').match(regex)
  return match?.[1]?.trim() || fallback
}

function findLine(lines, patterns) {
  return lines.find((line) => patterns.some((pattern) => pattern.test(line)))
}

function extractHtmlLines(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const selectors = [
    'h1',
    'h2',
    'h3',
    'h4',
    'p',
    'li',
    'button',
    '[data-day]',
    '.day-card',
    '.meal-card',
    '.tip-card'
  ]

  let nodes = [...doc.body.querySelectorAll(selectors.join(','))]
  if (nodes.length === 0) {
    nodes = [...doc.body.querySelectorAll('*')].filter((node) => node.children.length === 0)
  }

  const lines = nodes
    .map((node) => cleanText(node.textContent))
    .filter(Boolean)

  if (lines.length === 0) {
    return splitLines(doc.body?.textContent || html)
  }

  return dedupeLines(lines)
}

function parseHtmlToText(html) {
  return extractHtmlLines(html).join('\n')
}

function inferWeekPlan(lines, fullText) {
  const lowerLines = lines.map((line) => line.toLowerCase())
  const foundDayIndexes = lowerLines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => WEEKDAYS.some((day) => line.includes(day.toLowerCase())))

  if (foundDayIndexes.length) {
    return foundDayIndexes.slice(0, 7).map((entry, index, arr) => {
      const start = entry.index
      const end = arr[index + 1]?.index ?? Math.min(lines.length, start + 6)
      const block = lines.slice(start, end)
      const template = DEFAULT_PLAN.days[index] || DEFAULT_PLAN.days[0]
      return {
        day: WEEKDAYS.find((day) => block[0]?.toLowerCase().includes(day.toLowerCase())) || template.day,
        workout: block[1] || template.workout,
        details: block.slice(2, 4).join(' · ') || template.details,
        meals: block.find((line) => /meal|breakfast|lunch|dinner|protein|calorie/i.test(line)) || template.meals,
        tip: block.find((line) => /tip|focus|remember|tempo|hydration|sleep|recovery/i.test(line)) || template.tip,
      }
    })
  }

  const candidateLines = lines.filter((line) => /push|pull|legs|upper|lower|cardio|recovery|rest|conditioning/i.test(line))
  if (candidateLines.length) {
    return DEFAULT_PLAN.days.map((day, index) => ({
      ...day,
      workout: candidateLines[index] || day.workout
    }))
  }

  const bodyPattern = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/ig
  if (bodyPattern.test(fullText)) {
    return DEFAULT_PLAN.days
  }

  return DEFAULT_PLAN.days
}

function normalizeImportedPlan(sourceText, sourceType = 'text') {
  const text = String(sourceText || '')
  const lines = splitLines(text)
  const fullText = lines.join('\n')

  const title =
    findLine(lines.slice(0, 5), [/your plan/i, /fitness/i, /plan/i]) ||
    pickMatch(fullText, /(?:title|plan)\s*[:\-]\s*([^\n]+)/i, DEFAULT_PLAN.title) ||
    DEFAULT_PLAN.title

  const subtitle =
    findLine(lines, [/week\s*\d+/i, /fat loss/i, /strength/i, /muscle/i, /hypertrophy/i]) ||
    DEFAULT_PLAN.subtitle

  const exerciseSchedule =
    findLine(lines, [/exercise schedule/i, /workout schedule/i, /programme/i, /program/i]) ||
    DEFAULT_PLAN.exerciseSchedule

  const mealPlan =
    findLine(lines, [/meal plan/i, /nutrition/i, /diet/i, /whole foods/i, /high protein/i]) ||
    DEFAULT_PLAN.mealPlan

  const calories =
    extractNumber(findLine(lines, [/daily calories/i, /kcal/i, /calories/i]), DEFAULT_PLAN.calories)

  const protein =
    pickMatch(fullText, /protein(?:\s+goal)?[^\d]*(\d+\s*g)/i, DEFAULT_PLAN.protein) ||
    DEFAULT_PLAN.protein

  const carbs =
    pickMatch(fullText, /carbs?|carbohydrates[^\d]*(\d+\s*g)/i, DEFAULT_PLAN.carbs) ||
    DEFAULT_PLAN.carbs

  const fats =
    pickMatch(fullText, /fats?[^\d]*(\d+\s*g)/i, DEFAULT_PLAN.fats) ||
    DEFAULT_PLAN.fats

  const cardioSessions =
    findLine(lines, [/cardio\s*\/\s*week/i, /sessions/i, /cardio/i]) ||
    DEFAULT_PLAN.cardioSessions

  const targetLoss =
    findLine(lines, [/target loss/i, /kg\/wk/i, /lb\/wk/i, /weight loss/i]) ||
    DEFAULT_PLAN.targetLoss

  const guidelineHeaderIndex = lines.findIndex((line) => /key guidelines|guidelines|principles/i.test(line))
  const healthHeaderIndex = lines.findIndex((line) => /health note|health|consult/i.test(line))

  const guidelines = guidelineHeaderIndex >= 0
    ? lines.slice(guidelineHeaderIndex + 1, guidelineHeaderIndex + 5)
    : DEFAULT_PLAN.guidelines

  const healthNote = healthHeaderIndex >= 0
    ? lines.slice(healthHeaderIndex + 1, healthHeaderIndex + 4)
    : lines.filter((line) => /consult|stop if|dizziness|breathlessness|doctor|gp/i.test(line)).slice(0, 3)

  return {
    title,
    subtitle,
    exerciseSchedule,
    mealPlan,
    calories,
    protein,
    carbs,
    fats,
    cardioSessions,
    targetLoss,
    guidelines: healthHeaderIndex > -1 && guidelineHeaderIndex > -1 && healthHeaderIndex > guidelineHeaderIndex
      ? guidelines
      : DEFAULT_PLAN.guidelines,
    healthNote: healthNote.length ? healthNote : DEFAULT_PLAN.healthNote,
    days: inferWeekPlan(lines, fullText),
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
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
    pages.push(text)
  }

  return pages.join('\n')
}

function BottomNav({ activeTab, setActiveTab }) {
  const items = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'plan', label: 'Plan', icon: CalendarDays },
    { id: 'meals', label: 'Meals', icon: Salad },
    { id: 'tips', label: 'Tips', icon: Info },
    { id: 'import', label: 'Import', icon: Upload }
  ]

  return (
    <nav className="bottom-nav">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`nav-item ${activeTab === id ? 'nav-item-active' : ''}`}
          onClick={() => setActiveTab(id)}
          type="button"
        >
          <Icon size={18} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

function DayRow({ item, done, onToggle }) {
  return (
    <article className="plan-day-card">
      <div className="plan-day-top">
        <div>
          <h3>{item.day}</h3>
          <p className="plan-day-workout">{item.workout}</p>
        </div>
        <button className={`pill-button ${done ? 'pill-button-done' : ''}`} onClick={onToggle} type="button">
          {done ? '✓ Done' : 'Log Day Done'}
        </button>
      </div>
      <p className="plan-day-details">{item.details}</p>
      <p className="plan-day-tip">{item.tip}</p>
    </article>
  )
}

function InstallCard() {
  return (
    <section className="tracker-card install-card">
      <h4>Install as an App</h4>
      <p>Open this page in Safari, tap Share, then Add to Home Screen.</p>
      <a className="install-button" href="#">Add to Home Screen</a>
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
    const dayIndex = new Date().getDay()
    const normalized = dayIndex === 0 ? 6 : dayIndex - 1
    return plan.days?.[normalized] || plan.days?.[0]
  }, [plan.days])

  const toggleDay = (index) => {
    setDoneDays((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])
  }

  const undoLast = () => {
    setDoneDays((current) => current.slice(0, -1))
  }

  const handleImportedText = (text, sourceType, sourceLabel) => {
    const parsed = normalizeImportedPlan(text, sourceType)
    setPlan(parsed)
    setImportPreview(text.slice(0, 4000))
    setImportStatus(`Imported ${sourceLabel} successfully.`)
    setActiveTab('home')
  }

  const importHtmlFile = async (file) => {
    const html = await file.text()
    handleImportedText(parseHtmlToText(html), 'html', file.name)
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
      setImportStatus(error?.message || 'Import failed.')
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

    handleImportedText(parseHtmlToText(pastedHtml), 'html-paste', 'pasted HTML')
  }

  return (
    <div className="tracker-shell">
      <motion.main
        className="phone-frame"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
      >
        <header className="tracker-header">
          <p className="tracker-kicker">PERSONAL FITNESS TRACKER</p>
          <h1>{plan.title}</h1>
          <p className="tracker-subtitle">{plan.subtitle}</p>
        </header>

        <InstallCard />

        <section className="tracker-card progress-card">
          <div className="section-title-row">
            <div>
              <h2>WEEKLY PROGRESS</h2>
              <p className="muted-text">Days done {doneDays.length} / {plan.days?.length || 7}</p>
            </div>
            <div className="progress-percent">{progress}%</div>
          </div>

          <div className="progress-actions">
            <button className="ghost-button" onClick={undoLast} type="button">
              <ChevronLeft size={16} /> Undo
            </button>
            <button className="dark-button" onClick={() => setActiveTab('plan')} type="button">
              <CheckCircle2 size={16} /> Log Day Done
            </button>
          </div>
        </section>

        <section className="stats-panel">
          <div className="stat-box"><Flame size={18} /><span>Daily Calories</span><strong>{plan.calories.toLocaleString()} kcal</strong></div>
          <div className="stat-box"><Target size={18} /><span>Protein Goal</span><strong>{plan.protein} / day</strong></div>
          <div className="stat-box"><Dumbbell size={18} /><span>Cardio / Week</span><strong>{plan.cardioSessions}</strong></div>
          <div className="stat-box"><Salad size={18} /><span>Target Loss</span><strong>{plan.targetLoss}</strong></div>
        </section>

        {activeTab === 'home' && (
          <div className="content-stack">
            <section className="tracker-card today-card">
              <h2>TODAY</h2>
              <div className="today-workout">{todayItem?.workout || '—'}</div>
            </section>

            <section className="tracker-card info-card-grid">
              <div>
                <h3>Exercise Schedule</h3>
                <p>{plan.exerciseSchedule}</p>
              </div>
              <div>
                <h3>Meal Plan</h3>
                <p>{plan.mealPlan}</p>
              </div>
              <div className="macro-grid">
                <div><span>Calories</span><strong>{plan.calories.toLocaleString()}</strong></div>
                <div><span>Protein</span><strong>{plan.protein}</strong></div>
                <div><span>Carbs</span><strong>{plan.carbs}</strong></div>
                <div><span>Fats</span><strong>{plan.fats}</strong></div>
              </div>
            </section>

            <section className="tracker-card">
              <h2>Key Guidelines</h2>
              <p className="muted-text">Principles for sustainable fat loss</p>
              <div className="list-stack">
                {plan.guidelines.map((item, index) => (
                  <div className="plain-list-item" key={`guide-${index}`}>{item}</div>
                ))}
              </div>
            </section>

            <section className="tracker-card warning-card">
              <div className="warning-title"><ShieldAlert size={16} /> Health Note</div>
              <div className="list-stack">
                {plan.healthNote.map((item, index) => (
                  <div className="warning-line" key={`warning-${index}`}>→ {item}</div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'plan' && (
          <section className="content-stack">
            {plan.days.map((item, index) => (
              <DayRow key={`${item.day}-${index}`} item={item} done={doneDays.includes(index)} onToggle={() => toggleDay(index)} />
            ))}
          </section>
        )}

        {activeTab === 'meals' && (
          <section className="content-stack">
            <section className="tracker-card">
              <h2>Meal Plan</h2>
              <p>{plan.mealPlan}</p>
            </section>
            {plan.days.map((item, index) => (
              <section className="tracker-card meal-card" key={`meal-${index}`}>
                <h3>{item.day}</h3>
                <p>{item.meals}</p>
              </section>
            ))}
          </section>
        )}

        {activeTab === 'tips' && (
          <section className="content-stack">
            {plan.days.map((item, index) => (
              <section className="tracker-card" key={`tip-${index}`}>
                <h3>{item.day}</h3>
                <p>{item.tip}</p>
              </section>
            ))}
          </section>
        )}

        {activeTab === 'import' && (
          <section className="content-stack">
            <section className="tracker-card import-card">
              <h2>Import Plan</h2>
              <p className="muted-text">Upload any fitness plan HTML or PDF — the app extracts and rebuilds it.</p>

              <label className="upload-box">
                <div className="upload-box-title"><FileUp size={18} /> Upload HTML or PDF</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".html,.htm,.pdf,text/html,application/pdf"
                  onChange={handleFileUpload}
                />
              </label>

              <div className="import-section-label"><FileText size={16} /> OR PASTE HTML</div>
              <textarea
                className="import-textarea"
                value={pastedHtml}
                onChange={(event) => setPastedHtml(event.target.value)}
                placeholder="Paste your fitness plan HTML here..."
              />

              <button className="dark-button full-width" onClick={handlePasteImport} type="button">
                <Sparkles size={16} /> PARSE PLAN WITH AI
              </button>

              <div className="status-box">
                <strong>Status</strong>
                <p>{isParsing ? 'Parsing your file...' : importStatus}</p>
                {fileName ? <p className="muted-text small-text">Current file: {fileName}</p> : null}
              </div>
            </section>

            <section className="tracker-card">
              <h2>Imported Preview</h2>
              <p className="muted-text">Review the extracted content below.</p>
              <div className="preview-grid">
                <div><span>Plan Title</span><strong>{plan.title}</strong></div>
                <div><span>Imported Source</span><strong>{plan.importedFrom || 'default'}</strong></div>
                <div><span>Calories</span><strong>{plan.calories}</strong></div>
                <div><span>Days Found</span><strong>{plan.days?.length || 0}</strong></div>
              </div>
              <pre className="preview-code">{importPreview || 'No imported content yet.'}</pre>
            </section>
          </section>
        )}

        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </motion.main>
    </div>
  )
}
