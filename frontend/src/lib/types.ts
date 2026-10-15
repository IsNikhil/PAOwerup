// Shared types: API payloads and the data that flows along wires.

export type DataType = 'resume' | 'job' | 'skills' | 'score' | 'audio' | 'transcript' | 'doc'

export const TYPE_COLOR: Record<DataType, string> = {
  resume: 'var(--t-resume)',
  job: 'var(--t-job)',
  skills: 'var(--t-skills)',
  score: 'var(--t-score)',
  audio: 'var(--t-audio)',
  transcript: 'var(--t-transcript)',
  doc: 'var(--t-doc)',
}

export const TYPE_HEX: Record<DataType, string> = {
  resume: '#E8FF5A',
  job: '#4ADE80',
  skills: '#F87171',
  score: '#60A5FA',
  audio: '#A78BFA',
  transcript: '#A78BFA',
  doc: '#F472B6',
}

export type NodeStatus = 'idle' | 'queued' | 'running' | 'done' | 'error' | 'skipped'

// ---------------------------------------------------------------- API payloads
export interface ModelStatus {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'disabled'
  detail: string
}
export interface Health {
  ok: boolean
  use: ModelStatus
  whisper: ModelStatus
  gemini: ModelStatus
  gemini_model: string
  tensorflow_version: string
}

export interface SkillHit {
  name: string
  category: string
  count: number
  source: 'taxonomy' | 'gemini'
}
export interface SkillsResponse {
  resume: SkillHit[]
  job: SkillHit[]
  gemini_used: boolean
  note: string
}

export interface Evidence {
  sentence: string
  similarity: number
}
export interface MatchedSkill {
  name: string
  similarity: number
  match_type: 'exact' | 'semantic'
  matched_with: string
  evidence: Evidence[]
}
export interface MissingSkill {
  name: string
  similarity: number
  importance: number
  importance_label: 'high' | 'medium' | 'low'
  closest: string
  hint: string
}
export interface MatchResponse {
  score: number
  verdict: string
  summary: string
  breakdown: {
    skill_coverage: number
    sentence_similarity: number
    document_similarity: number
    raw_document_cosine: number
    raw_sentence_mean: number
  }
  weights: Record<string, number>
  matched_skills: MatchedSkill[]
  missing_skills: MissingSkill[]
  model: string
  threshold: number
  elapsed_ms: number
  resume_sentences: number
  job_sentences: number
}

export interface ResumeItem {
  heading: string
  subheading: string
  dates: string
  bullets: string[]
}
export interface ResumeDoc {
  name: string
  headline: string
  contact: string
  summary: string
  sections: { title: string; items: ResumeItem[] }[]
  skills: string[]
  skills_to_develop: string[]
  changes: string[]
}
export type Source = 'gemini' | 'fallback'
export interface RewriteResponse {
  resume: ResumeDoc
  source: Source
  note: string
}
export interface CoachResponse {
  headline: string
  steps: { title: string; detail: string; timeframe: string }[]
  source: Source
  note: string
}
export interface Word {
  word: string
  start: number
  end: number
}
export interface TranscriptResponse {
  text: string
  words: Word[]
  duration: number
  language: string
  model: string
  elapsed_ms: number
}
export interface SpeechMetrics {
  word_count: number
  duration: number
  wpm: number
  pace_label: string
  filler_total: number
  filler_rate: number
  fillers: { word: string; count: number }[]
  pause_count: number
  longest_pause: number
  clarity: number
  wpm_series: number[]
}
export interface FeedbackResponse {
  overall: string
  rating: number
  strengths: string[]
  improvements: string[]
  sample_answer: string
  source: Source
  note: string
}

// ---------------------------------------------------------------- wire values
export interface ResumeValue {
  type: 'resume'
  text: string
  filename: string
}
export interface JobValue {
  type: 'job'
  text: string
  title: string
}
export interface SkillsValue {
  type: 'skills'
  kind: 'extracted' | 'gap'
  resume: SkillHit[]
  job: SkillHit[]
  matched?: MatchedSkill[]
  missing?: MissingSkill[]
}
export interface ScoreValue {
  type: 'score'
  kind: 'match' | 'speech'
  match?: MatchResponse
  speech?: SpeechMetrics
}
export interface AudioValue {
  type: 'audio'
  dataUrl: string
  mime: string
  duration: number
  question: string
  id: string
}
export interface TranscriptValue extends TranscriptResponse {
  type: 'transcript'
  question: string
  audioId: string
}
export interface DocValue {
  type: 'doc'
  kind: 'resume' | 'coach' | 'feedback'
  resume?: RewriteResponse
  coach?: CoachResponse
  feedback?: FeedbackResponse & { question: string; transcript: string; metrics?: SpeechMetrics }
}

export type WireValue = ResumeValue | JobValue | SkillsValue | ScoreValue | AudioValue | TranscriptValue | DocValue

export interface NodeResult {
  status: NodeStatus
  output?: WireValue
  error?: string
  note?: string
  ms?: number
  updatedAt?: number
}
