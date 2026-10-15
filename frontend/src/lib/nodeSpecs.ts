import type { DataType } from './types'

export type NodeKind =
  | 'resume'
  | 'job'
  | 'skillExtractor'
  | 'matchEngine'
  | 'skillGap'
  | 'rewriter'
  | 'coach'
  | 'recorder'
  | 'transcriber'
  | 'speechMetrics'
  | 'feedback'
  | 'report'

export interface PortSpec {
  type: DataType
  label: string
  /** accept several incoming wires (Career Report) */
  multi?: boolean
  optional?: boolean
}

export interface NodeSpec {
  kind: NodeKind
  title: string
  subtitle: string
  description: string
  width: number
  inputs: PortSpec[]
  outputs: PortSpec[]
  defaults: Record<string, unknown>
  /** engine badge shown in the title row */
  engine?: 'TF' | 'Gemini' | 'Whisper' | 'Python'
  glow: DataType
}

export const SPECS: Record<NodeKind, NodeSpec> = {
  resume: {
    kind: 'resume',
    title: 'Resume',
    subtitle: 'PDF · DOCX · TXT',
    description: 'Upload a resume and extract its text',
    width: 300,
    inputs: [],
    outputs: [{ type: 'resume', label: 'resume' }],
    defaults: { text: '', filename: '' },
    glow: 'resume',
  },
  job: {
    kind: 'job',
    title: 'Job Description',
    subtitle: 'Paste the posting',
    description: 'The job you are applying for',
    width: 300,
    inputs: [],
    outputs: [{ type: 'job', label: 'job' }],
    defaults: { text: '', title: '' },
    glow: 'job',
  },
  skillExtractor: {
    kind: 'skillExtractor',
    title: 'Skill Extractor',
    subtitle: 'Taxonomy · 299 skills',
    description: 'Find skills on both sides',
    width: 290,
    inputs: [
      { type: 'resume', label: 'resume' },
      { type: 'job', label: 'job' },
    ],
    outputs: [{ type: 'skills', label: 'skills' }],
    defaults: { source: 'taxonomy' },
    engine: 'Python',
    glow: 'skills',
  },
  matchEngine: {
    kind: 'matchEngine',
    title: 'Match Engine',
    subtitle: 'TensorFlow · Universal Sentence Encoder',
    description: 'Semantic match score with TensorFlow + USE',
    width: 300,
    inputs: [
      { type: 'resume', label: 'resume' },
      { type: 'job', label: 'job' },
      { type: 'skills', label: 'skills', optional: true },
    ],
    outputs: [{ type: 'score', label: 'score' }],
    defaults: { model: 'use-v4', threshold: 0.5, topK: 3 },
    engine: 'TF',
    glow: 'score',
  },
  skillGap: {
    kind: 'skillGap',
    title: 'Skill Gap',
    subtitle: 'Matched vs missing',
    description: 'What you have and what to learn',
    width: 300,
    inputs: [
      { type: 'skills', label: 'skills', optional: true },
      { type: 'score', label: 'score' },
    ],
    outputs: [{ type: 'skills', label: 'skills' }],
    defaults: {},
    glow: 'skills',
  },
  rewriter: {
    kind: 'rewriter',
    title: 'Resume Rewriter',
    subtitle: 'Gemini · tailored to the job',
    description: 'Rewrite the resume for this job (no invented experience)',
    width: 290,
    inputs: [
      { type: 'resume', label: 'resume' },
      { type: 'job', label: 'job' },
      { type: 'skills', label: 'skills', optional: true },
    ],
    outputs: [{ type: 'doc', label: 'doc' }],
    defaults: { tone: 'Professional' },
    engine: 'Gemini',
    glow: 'doc',
  },
  coach: {
    kind: 'coach',
    title: 'Career Coach',
    subtitle: 'Gemini · next steps',
    description: 'Personalized next steps',
    width: 290,
    inputs: [
      { type: 'score', label: 'score' },
      { type: 'skills', label: 'skills', optional: true },
    ],
    outputs: [{ type: 'doc', label: 'doc' }],
    defaults: {},
    engine: 'Gemini',
    glow: 'doc',
  },
  recorder: {
    kind: 'recorder',
    title: 'Interview Recorder',
    subtitle: 'Microphone',
    description: 'Record an answer to an interview question',
    width: 300,
    inputs: [],
    outputs: [{ type: 'audio', label: 'audio' }],
    defaults: { question: '' },
    glow: 'audio',
  },
  transcriber: {
    kind: 'transcriber',
    title: 'Transcriber',
    subtitle: 'Whisper · local',
    description: 'Speech to text with word timestamps',
    width: 280,
    inputs: [{ type: 'audio', label: 'audio' }],
    outputs: [{ type: 'transcript', label: 'transcript' }],
    defaults: { model: 'base' },
    engine: 'Whisper',
    glow: 'audio',
  },
  speechMetrics: {
    kind: 'speechMetrics',
    title: 'Speech Metrics',
    subtitle: 'Pace · fillers · pauses',
    description: 'Words per minute, filler words, pauses',
    width: 290,
    inputs: [{ type: 'transcript', label: 'transcript' }],
    outputs: [{ type: 'score', label: 'score' }],
    defaults: {},
    engine: 'Python',
    glow: 'score',
  },
  feedback: {
    kind: 'feedback',
    title: 'Interview Feedback',
    subtitle: 'Gemini · coaching',
    description: 'Strengths, improvements and a better sample answer',
    width: 290,
    inputs: [
      { type: 'transcript', label: 'transcript' },
      { type: 'score', label: 'score', optional: true },
      { type: 'job', label: 'job', optional: true },
    ],
    outputs: [{ type: 'doc', label: 'doc' }],
    defaults: {},
    engine: 'Gemini',
    glow: 'doc',
  },
  report: {
    kind: 'report',
    title: 'Career Report',
    subtitle: 'Preview',
    description: 'The final report: score, gaps, resume, interview',
    width: 440,
    inputs: [
      { type: 'score', label: 'score', multi: true },
      { type: 'skills', label: 'skills', optional: true },
      { type: 'doc', label: 'doc', multi: true, optional: true },
    ],
    outputs: [],
    defaults: { tab: 'match' },
    glow: 'doc',
  },
}

export const PALETTE_ORDER: NodeKind[] = [
  'resume',
  'job',
  'skillExtractor',
  'matchEngine',
  'skillGap',
  'rewriter',
  'coach',
  'recorder',
  'transcriber',
  'speechMetrics',
  'feedback',
  'report',
]
