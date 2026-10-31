/**
 * Everything the dashboard shows comes from this file.
 * Source: "P2 Daily Plan — Top 3" (30/10/2026).
 *
 * Editing guide
 * - Dates are ISO strings (YYYY-MM-DD), times are 24 h "HH:MM".
 * - Text fields accept a tiny bit of markdown: [label](url), *italic*, **bold**.
 *   Links starting with "#/" go to a page of this app; others open in a new tab.
 * - Block ids are used to save your progress. If you rename one, progress already
 *   saved under the old id stays in your backup but is no longer shown.
 */

// ─── Modules ────────────────────────────────────────────────────────────────

export type ModuleId =
  | 'proba'
  | 'micro'
  | 'introEco'
  | 'demo'
  | 'statDes'
  | 'algo'
  | 'r'
  | 'envInfo'
  | 'anglais'
  | 'techCom'

export interface Module {
  id: ModuleId
  /** Name as written in the plan. */
  name: string
  /** Short label for chips and the timetable. */
  short: string
  /** Coefficient, only where the plan states it. */
  coef?: number
  /** Position in the plan's "Module priority" list. */
  priority: number
  /** The plan's note on this module. */
  why: string
  /** Shown on the Absences page. */
  absenceNote?: string
}

export const modules: Module[] = [
  {
    id: 'proba',
    name: 'Intég Proba 2',
    short: 'Proba 2',
    coef: 3,
    priority: 1,
    why: 'Plus the Proba 1 measure theory you missed. Coefficient 3, 6 hours of class a week, and the base for later statistics.',
  },
  { id: 'micro', name: 'Micro économie I', short: 'Micro', coef: 2, priority: 2, why: 'Your weakest area.' },
  { id: 'introEco', name: "Intro à l'économie", short: 'Intro éco', coef: 2, priority: 3, why: 'Weak, new to you.' },
  { id: 'demo', name: 'Démographie', short: 'Démographie', coef: 2, priority: 4, why: 'Barely studied in P1, but quick to learn.' },
  { id: 'statDes', name: 'Stat Des', short: 'Stat Des', coef: 2, priority: 5, why: 'Past papers already work for you.' },
  { id: 'algo', name: 'Algo Prog 1', short: 'Algo', coef: 2, priority: 6, why: 'Close to CPGE informatique.' },
  { id: 'r', name: 'Logiciels stat I R', short: 'R', priority: 7, why: 'Class work only.' },
  { id: 'envInfo', name: 'Envir Info', short: 'Envir Info', priority: 7, why: 'Class work only.' },
  {
    id: 'anglais',
    name: 'Anglais',
    short: 'Anglais',
    priority: 7,
    why: 'Class work only.',
    absenceNote: 'One more Anglais absence may already reach the limit.',
  },
  { id: 'techCom', name: 'Tech com', short: 'Tech com', priority: 7, why: 'Class work only.' },
]

// ─── Goal ───────────────────────────────────────────────────────────────────

export const goal = {
  title: 'Top 3 of 54',
  text: 'Top 3 of 54 means scoring about 1.5 class standard deviations above the mean in every graded period, which is about the top 7%. On a test like your Proba DS, that is about 17.3/20.',
  /** target ≈ μ + kσ, worked example from the Proba DS */
  k: 1.5,
  example: { mean: 13.05, sd: 2.83, target: 17.3 },
}

// ─── Do these first ─────────────────────────────────────────────────────────

export interface DoFirstItem {
  id: string
  /** Date the item is due, or the date it starts for "From …" items. */
  date: string
  /** Label as written in the plan. */
  when: string
  text: string
}

export const doFirst: DoFirstItem[] = [
  { id: 'debt-list', date: '2026-11-01', when: 'Sun 01/11', text: 'Write your P1 debt list, module by module: every chapter you never studied.' },
  {
    id: 'absence-count',
    date: '2026-11-02',
    when: 'Mon 02/11, scolarité',
    text: 'Official absence count per module, the 20% limit in sessions, and whether any absence can still be justified.',
  },
  { id: 'exam-dates', date: '2026-11-02', when: 'Mon 02/11, scolarité', text: 'P2 exam dates, and which P1 grades are final.' },
  {
    id: 'past-papers',
    date: '2026-11-07',
    when: 'By Sat 07/11',
    text: 'Past papers with corrigés for Proba, Micro, Intro éco, Démographie, Stat Des and Algo, from 2A students.',
  },
  {
    id: 'tsyp-first',
    date: '2026-11-08',
    when: 'Sun 08/11',
    text: 'TSYP first submission. After it, TSYP drops to its weekly cap ([rules](#/plan/rules)).',
  },
  { id: 'attend', date: '2026-11-02', when: 'From Mon 02/11', text: 'Attend every class. No exceptions.' },
]

// ─── Every day ──────────────────────────────────────────────────────────────

/** ISO weekday: Monday = 1 … Sunday = 7 */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type BlockKind = 'study' | 'paper' | 'check' | 'catchup'

export interface BlockTemplate {
  /** Stable id used to save progress. */
  id: string
  start: string
  end: string
  module?: ModuleId
  title: string
  task: string
  kind: BlockKind
}

export interface DayTemplate {
  weekday: Weekday
  short: string
  classes: { start: string; end: string } | null
  blocks: BlockTemplate[]
  /** Total study time as written in the plan. */
  total: string
}

export const everyDay = {
  intro:
    'About 20 hours a week of study. Every block opens with 10 minutes closed-book on its topic, then notes. Before bed, write tomorrow\'s first task as a sheet and exercise number.',
  sideWork: 'Side work (TSYP, DataCamp) goes only on Thursday, Saturday and Sunday evenings, after the blocks.',
  commute: 'The times assume a 45-minute commute; shift them if yours differs.',
}

export const week: DayTemplate[] = [
  {
    weekday: 1,
    short: 'Mon',
    classes: { start: '08:30', end: '15:50' },
    total: '2 h 15',
    blocks: [
      { id: 'mon-1', start: '17:00', end: '18:30', module: 'statDes', kind: 'study', title: 'Stat Des', task: "Today's cours from memory, then 3 exercises" },
      { id: 'mon-2', start: '19:00', end: '19:45', module: 'algo', kind: 'study', title: 'Algo', task: "Today's cours and TP" },
    ],
  },
  {
    weekday: 2,
    short: 'Tue',
    classes: { start: '10:10', end: '15:50' },
    total: '2 h 45',
    blocks: [
      { id: 'tue-1', start: '08:00', end: '09:15', module: 'proba', kind: 'study', title: 'Proba 1 debt (measure theory)', task: '1 exercise closed-book' },
      { id: 'tue-2', start: '17:00', end: '18:30', module: 'proba', kind: 'study', title: 'Proba 2', task: "Today's two cours from memory, then 2 exercises" },
    ],
  },
  {
    weekday: 3,
    short: 'Wed',
    classes: { start: '10:10', end: '13:20' },
    total: '3 h 45',
    blocks: [
      { id: 'wed-1', start: '08:00', end: '09:15', module: 'proba', kind: 'study', title: 'Proba 2', task: "Try Thursday's TD exercises before class" },
      { id: 'wed-2', start: '14:30', end: '16:00', module: 'micro', kind: 'study', title: 'Micro', task: "Today's cours, then P1 debt" },
      { id: 'wed-3', start: '16:30', end: '17:30', module: 'statDes', kind: 'study', title: 'Stat Des', task: "Redo today's TD closed-book" },
    ],
  },
  {
    weekday: 4,
    short: 'Thu',
    classes: { start: '08:30', end: '11:40' },
    total: '3 h',
    blocks: [
      { id: 'thu-1', start: '13:00', end: '14:30', module: 'proba', kind: 'study', title: 'Proba 2', task: "Redo today's TD closed-book, plus 1 new exercise" },
      { id: 'thu-2', start: '15:00', end: '16:30', module: 'introEco', kind: 'study', title: 'Intro éco', task: "Today's cours, then P1 debt" },
    ],
  },
  {
    weekday: 5,
    short: 'Fri',
    classes: { start: '10:10', end: '15:50' },
    total: '2 h 30',
    blocks: [
      { id: 'fri-1', start: '08:00', end: '09:15', module: 'micro', kind: 'study', title: 'Micro', task: "Try today's TD exercises before class" },
      { id: 'fri-2', start: '17:00', end: '18:15', module: 'demo', kind: 'study', title: 'Démographie', task: "Today's cours, then P1 debt" },
    ],
  },
  {
    weekday: 6,
    short: 'Sat',
    classes: { start: '08:30', end: '11:40' },
    total: '2 h 15',
    blocks: [
      { id: 'sat-1', start: '13:00', end: '14:30', module: 'proba', kind: 'study', title: 'Proba 2', task: "Redo Friday's TD closed-book" },
      { id: 'sat-2', start: '14:45', end: '15:30', module: 'micro', kind: 'study', title: 'Micro', task: "Redo Friday's TD closed-book" },
    ],
  },
  {
    weekday: 7,
    short: 'Sun',
    classes: null,
    total: '3 h 30',
    blocks: [
      { id: 'sun-1', start: '10:00', end: '11:30', kind: 'paper', title: 'One past paper', task: 'Timed. The module is in the fixed dates on the [Plan](#/plan) page.' },
      { id: 'sun-2', start: '11:30', end: '12:00', kind: 'check', title: 'Sunday check', task: 'Track [three numbers](#/check).' },
      { id: 'sun-3', start: '15:00', end: '16:30', kind: 'catchup', title: 'Catch-up', task: 'Whatever is behind' },
    ],
  },
]

/** Blocks that start before this time count as "morning blocks" for the ramp-up weeks. */
export const morningBefore = '12:00'

// ─── Week by week ───────────────────────────────────────────────────────────

export type WeekSchedule =
  /** Study blocks on these weekdays; morning blocks only if morningBlocks is true. */
  | { kind: 'blocks'; days: Weekday[]; morningBlocks: boolean }
  /** The exam-mode day from the rules section. */
  | { kind: 'exam' }

export interface PlanWeek {
  /** First day (inclusive). */
  start: string
  /** Last day (inclusive). null = open-ended ("to exams"). */
  end: string | null
  /** As written in the plan. */
  label: string
  hours: string
  focus: string
  schedule: WeekSchedule
}

const ALL_DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7]

export const weekByWeek = {
  intro:
    'The first two weeks ramp up on purpose: going from zero to 20 hours at once is how plans break in week one. All P1 debt is cleared by 29/11, and nothing new is studied after 21/12.',
}

export const weeks: PlanWeek[] = [
  {
    start: '2026-11-02',
    end: '2026-11-08',
    label: '02–08/11',
    hours: '10',
    focus: 'Restart: only the afternoon and evening blocks, Mon–Fri. Go to the scolarité on Monday.',
    schedule: { kind: 'blocks', days: [1, 2, 3, 4, 5], morningBlocks: false },
  },
  {
    start: '2026-11-09',
    end: '2026-11-15',
    label: '09–15/11',
    hours: '16',
    focus: 'Add the morning blocks and Saturday. P1 debt: Proba 1 measure theory, Micro.',
    schedule: { kind: 'blocks', days: [1, 2, 3, 4, 5, 6], morningBlocks: true },
  },
  {
    start: '2026-11-16',
    end: '2026-11-22',
    label: '16–22/11',
    hours: '20',
    focus: 'Full week, Sunday included. P1 debt: Intro éco, Démographie.',
    schedule: { kind: 'blocks', days: ALL_DAYS, morningBlocks: true },
  },
  {
    start: '2026-11-23',
    end: '2026-11-29',
    label: '23–29/11',
    hours: '20',
    focus: 'Full week. Finish all P1 debt.',
    schedule: { kind: 'blocks', days: ALL_DAYS, morningBlocks: true },
  },
  {
    start: '2026-11-30',
    end: '2026-12-06',
    label: '30/11–06/12',
    hours: '20',
    focus: 'Sunday papers become routine.',
    schedule: { kind: 'blocks', days: ALL_DAYS, morningBlocks: true },
  },
  {
    start: '2026-12-07',
    end: '2026-12-13',
    label: '07–13/12',
    hours: '20',
    focus: 'TSYP final week: keep every study block, cut other side work.',
    schedule: { kind: 'blocks', days: ALL_DAYS, morningBlocks: true },
  },
  {
    start: '2026-12-14',
    end: '2026-12-20',
    label: '14–20/12',
    hours: '20',
    focus: 'Close content: a one-page formula sheet per module, written from memory.',
    schedule: { kind: 'blocks', days: ALL_DAYS, morningBlocks: true },
  },
  {
    start: '2026-12-21',
    end: '2026-12-25',
    label: '21–25/12',
    hours: '15',
    focus: 'Nothing new. Redo old TDs closed-book.',
    schedule: { kind: 'blocks', days: ALL_DAYS, morningBlocks: true },
  },
  {
    start: '2026-12-26',
    end: '2027-01-02',
    label: '26/12–02/01',
    hours: 'about 4.5 a day',
    focus: 'Exam mode ([rules](#/plan/rules)).',
    schedule: { kind: 'exam' },
  },
  {
    start: '2027-01-03',
    end: null,
    label: '03/01 to exams',
    hours: '—',
    focus: 'Exam-day routine ([rules](#/plan/rules)).',
    schedule: { kind: 'exam' },
  },
]

// ─── Fixed dates ────────────────────────────────────────────────────────────

export type FixedKind = 'deadline' | 'paper' | 'checkpoint' | 'rest' | 'exam'

export interface FixedDate {
  id: string
  date: string
  /** As written in the plan. */
  label: string
  kind: FixedKind
  start?: string
  end?: string
  module?: ModuleId
  /** Checkpoint number, for kind "checkpoint". */
  checkpoint?: 1 | 2
  /** The plan says to confirm this date. */
  tentative?: boolean
}

export const fixedDates: FixedDate[] = [
  { id: 'tsyp-first', date: '2026-11-08', label: 'TSYP first submission', kind: 'deadline' },
  { id: 'paper-statdes', date: '2026-11-22', label: 'Timed Stat Des past DS', kind: 'paper', module: 'statDes' },
  { id: 'cp1', date: '2026-11-28', label: 'Checkpoint 1', kind: 'checkpoint', checkpoint: 1, start: '14:00', end: '17:00' },
  { id: 'paper-micro', date: '2026-12-06', label: 'Timed Micro past DS', kind: 'paper', module: 'micro' },
  { id: 'tsyp-final', date: '2026-12-11', label: 'TSYP final', kind: 'deadline' },
  { id: 'cp2', date: '2026-12-13', label: 'Checkpoint 2', kind: 'checkpoint', checkpoint: 2, start: '09:00', end: '12:00' },
  { id: 'datacamp', date: '2026-12-20', label: 'DataCamp courses finished', kind: 'deadline' },
  { id: 'paper-23', date: '2026-12-23', label: 'One timed paper', kind: 'paper' },
  { id: 'rest', date: '2027-01-01', label: 'Full rest day', kind: 'rest' },
  { id: 'exams', date: '2027-01-07', label: 'Exams around 07/01: confirm the dates', kind: 'exam', tentative: true },
]

// ─── Checkpoints ────────────────────────────────────────────────────────────

export interface Checkpoint {
  n: 1 | 2
  date: string
  when: string
  start: string
  end: string
  parts: { label: string; module?: ModuleId }[]
  /** Score at or above this is "On track for top 3". */
  onTrackFrom: number
  /** Score at or above this (and below onTrackFrom) is "Behind"; below is "Far behind". */
  behindFrom: number
}

export const checkpoints: Checkpoint[] = [
  {
    n: 1,
    date: '2026-11-28',
    when: 'Sat 28/11, 14:00–17:00',
    start: '14:00',
    end: '17:00',
    parts: [
      { label: 'Proba 2 (60 minutes, three unseen TD or past DS exercises)', module: 'proba' },
      { label: 'Micro (a 40-minute past DS)', module: 'micro' },
      { label: 'Stat Des (45 minutes of an unused past DS)', module: 'statDes' },
    ],
    onTrackFrom: 16,
    behindFrom: 13,
  },
  {
    n: 2,
    date: '2026-12-13',
    when: 'Sun 13/12, 09:00–12:00',
    start: '09:00',
    end: '12:00',
    parts: [{ label: 'A full Proba past exam', module: 'proba' }, { label: 'Your weakest economics module from Checkpoint 1' }],
    onTrackFrom: 17,
    behindFrom: 14,
  },
]

export const checkpointMarking = 'Mark strictly with the corrigé: no half credit for a wrong final answer.'

export type Verdict = 'on-track' | 'behind' | 'far'

export const checkpointScale: { verdict: Verdict; score: string; meaning: string; change: string }[] = [
  { verdict: 'on-track', score: '16 or more (17 or more)', meaning: 'On track for top 3', change: 'Nothing' },
  { verdict: 'behind', score: '13 to 15.75 (14 to 16.75)', meaning: 'Behind', change: 'Add 1.5 h a week to that module, taken from side work' },
  { verdict: 'far', score: 'Under 13 (under 14)', meaning: 'Far behind', change: 'Add 3 h a week; pause all personal projects' },
]

// ─── Rules, bad days, exam weeks ────────────────────────────────────────────

export const rules: { title: string; text?: string }[] = [
  {
    title: 'Go to every class.',
    text: 'Above 20% absences in a subject, you cannot sit its exam. One more Anglais absence may already reach the limit.',
  },
  { title: 'Process every lecture the same day.' },
  { title: 'Recall before you read:', text: '10 minutes closed-book, then open your notes.' },
  { title: 'Try TD exercises before the TD session.' },
  {
    title: "Side work comes after the day's blocks, with caps:",
    text: 'TSYP 4 h a week (more only in the 08/11 and 11/12 weeks), DataCamp 1.5 h a week, the CPI pipeline 0 until P3.',
  },
  { title: 'Nothing new after Mon 21/12.' },
]

export const badDay = {
  title: 'Bad day: the 40-minute minimum',
  steps: [
    'Attend every class. This part is never optional.',
    "20 minutes: write today's lectures from memory, then check them against your notes.",
    '15 minutes: redo one exercise from today, closed-book.',
    "5 minutes: write tomorrow's first task.",
  ],
  footer: 'Never two bad days in a row.',
}

export interface ExamModeItem {
  id: string
  time: string
  end?: string
  /** As written in the plan. */
  text: string
  /** Short label for the timetable. */
  label: string
  /** false = not a study block (not counted, no Start button). */
  block: boolean
}

export const examMode = {
  title: 'Exam mode, 26/12 to the exams',
  from: '2026-12-26',
  items: [
    { id: 'exam-1', time: '09:00', label: 'Past paper 1', text: 'Past paper 1, timed, at a desk with no screen', block: true },
    { id: 'exam-2', time: '11:00', label: 'Correct it', text: 'Correct it with the corrigé; copy every mistake into an error log', block: true },
    { id: 'exam-3', time: '14:30', label: 'Past paper 2', text: 'Past paper 2, or redo old error-log mistakes closed-book', block: true },
    { id: 'exam-4', time: '17:00', end: '18:30', label: 'Formula sheets', text: 'Write each formula sheet from memory, then compare; stop at 18:30', block: true },
    { id: 'exam-5', time: '19:00', label: 'Films and series', text: 'After 19:00: films and series, only if both papers are done', block: false },
  ] satisfies ExamModeItem[],
  dayBefore:
    'The day before an exam: one more paper of that module, then the formula sheet from memory twice, and sleep by 23:00. Print the corrigés in advance so the laptop stays closed.',
}

// ─── Sunday check ───────────────────────────────────────────────────────────

export const sundayCheck = {
  time: '11:30',
  intro: 'Track three numbers, every Sunday at 11:30.',
  metrics: [
    {
      id: 'blocks',
      title: 'Blocks done out of blocks planned',
      target: 'Target: 80% or more.',
      why: 'This is the input you control.',
      goal: 80,
      direction: 'up' as const,
    },
    {
      id: 'delay',
      title: 'Median start delay, in minutes',
      target: 'Target: 10 or less.',
      why: 'This measures the exam-week avoidance directly.',
      goal: 10,
      direction: 'down' as const,
    },
    {
      id: 'z',
      title: 'Latest score as a z-score',
      target: 'Target: 1.5 or more for top 3.',
      why: 'This is what predicts rank.',
      goal: 1.5,
      direction: 'up' as const,
    },
  ],
}

// ─── Resources ──────────────────────────────────────────────────────────────

export interface Resource {
  /** Module the card belongs to (used by the filter). */
  module: ModuleId
  /** Row title as written in the plan. */
  title: string
  understand: string
  practise: string
  howToUse: string
}

export const resourcesIntro = {
  layers:
    "Use three layers for every module, in this order. First your own cours, TD and ESSAI past papers, because they define the exam. Then the main reference below, for anything you don't understand. Then the practice column for extra exercises with corrections.",
  checked: 'Every link was opened on 30/10/2026 and is free to read.',
  footer:
    "The best resource of all is ESSAI's own past papers with corrigés. Getting them from 2A students this week matters more than any link here.",
}

export const resources: Resource[] = [
  {
    module: 'proba',
    title: 'Intég Proba 2 and Proba 1 measure theory',
    understand:
      "[Le Gall, *Intégration, Probabilités et Processus Aléatoires*](https://igor-kortchemski.perso.math.cnrs.fr/USTC/LeGall.pdf) (ENS, French): ch. 1–3 measure and integration, ch. 8–10 probability. Shorter: [Nonnenmacher's notes](https://www.imo.universite-paris-saclay.fr/~nonnenma/enseign/Cours_USTC_Integration+Probabilites_2024.pdf) (Paris-Saclay, French)",
    practise:
      '[Gallouët & Herbin, *Mesure, intégration, probabilités*](https://www.i2m.univ-amu.fr/~gallouet/licence.d/proba.d/mes-int-proba.pdf): over 250 exercises with full corrigés. For calculation speed: [MIT 18.600](https://ocw.mit.edu/courses/18-600-probability-and-random-variables-fall-2019/) exams with solutions',
    howToUse: 'Per chapter: write the definitions and theorems from memory on one page, then do 3 corrected exercises',
  },
  {
    module: 'micro',
    title: 'Micro économie I',
    understand:
      '[MIT 14.01, *Principles of Microeconomics* (Fall 2018)](https://ocw.mit.edu/courses/14-01-principles-of-microeconomics-fall-2018/): lecture videos and notes',
    practise: 'Same course: problem sets and exams with solutions. Your 2025/26 ESSAI DS and exam corrigés',
    howToUse: "Watch only the lecture matching this week's chapter, then do the problem-set questions on it",
  },
  {
    module: 'introEco',
    title: "Intro à l'économie",
    understand:
      '[CORE Econ, *The Economy 2.0*](https://books.core-econ.org/the-economy/microeconomics/0-3-contents.html), free online ([macro volume](https://books.core-econ.org/the-economy/macroeconomics/0-3-contents.html))',
    practise: 'ESSAI past papers',
    howToUse: 'Read only the unit matching the cours; write 5 key definitions in French',
  },
  {
    module: 'statDes',
    title: 'Stat Des',
    understand:
      '[Baccini, *Statistique descriptive élémentaire*](https://www.math.univ-toulouse.fr/~baccini/zpedago/asde.pdf) (Toulouse, French): one and two variables, boxplots, regression',
    practise:
      '[Corrected exercise on Laspeyres, Paasche and Fisher indices](https://rfoudi.univ-lille.fr/stat_cours/appli_cours15_S2/AAPLI_COURS_INDICES_Corrige.pdf) (Lille). Your ESSAI DS 2024 and exam 2025',
    howToUse: 'Redo the full 2025 exam once before Checkpoint 1',
  },
  {
    module: 'demo',
    title: 'Démographie',
    understand:
      '[INSEE definitions](https://www.insee.fr/fr/metadonnees/definitions), e.g. [indicateur conjoncturel de fécondité](https://www.insee.fr/fr/metadonnees/definition/c1963)',
    practise: 'ESSAI past papers (ask 2A students)',
    howToUse: 'Build a formula sheet: each indicator, its formula, one worked example',
  },
  {
    module: 'algo',
    title: 'Algo Prog 1',
    understand: 'Your cours and TP',
    practise: '[France-IOI](https://www.france-ioi.org/algo/chapters.php): French, auto-graded, in C, C++, Python, Java and OCaml',
    howToUse: 'Only if TP feels slow: 2 exercises a week',
  },
  {
    module: 'r',
    title: 'Logiciels stat I R',
    understand: '[*R for Data Science* (2e)](https://r4ds.hadley.nz/)',
    practise: 'The three DataCamp courses your professor assigned',
    howToUse: 'DataCamp first; use the book as reference',
  },
]

// ─── Lookups ────────────────────────────────────────────────────────────────

export const moduleById = Object.fromEntries(modules.map((m) => [m.id, m])) as Record<ModuleId, Module>
export const dayTemplateByWeekday = Object.fromEntries(week.map((d) => [d.weekday, d])) as Record<Weekday, DayTemplate>
export const planStart = weeks[0].start
