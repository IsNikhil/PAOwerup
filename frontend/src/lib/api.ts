import type {
  CoachResponse,
  FeedbackResponse,
  Health,
  MatchResponse,
  ResumeDoc,
  RewriteResponse,
  SkillsResponse,
  SpeechMetrics,
  TranscriptResponse,
  Word,
} from './types'

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, init)
  } catch {
    throw new ApiError('Backend not reachable — is `make dev` running?', 0)
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* not JSON */
    }
    throw new ApiError(detail || `HTTP ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  health: () => request<Health>('/health'),

  parseResume(file: File) {
    const form = new FormData()
    form.append('file', file)
    return request<{ filename: string; text: string; chars: number; words: number }>('/parse-resume', { method: 'POST', body: form })
  },

  skills: (resume_text: string, job_text: string, source: 'taxonomy' | 'taxonomy+gemini') =>
    post<SkillsResponse>('/skills', { resume_text, job_text, source }),

  match: (body: {
    resume_text: string
    job_text: string
    model: string
    threshold: number
    top_k: number
    resume_skills?: string[]
    job_skills?: string[]
  }) => post<MatchResponse>('/match', body),

  rewrite: (body: {
    resume_text: string
    job_text: string
    job_title: string
    matched_skills: string[]
    missing_skills: string[]
    tone: string
    instructions: string
  }) => post<RewriteResponse>('/rewrite', body),

  async rewriteDocx(doc: ResumeDoc): Promise<{ blob: Blob; filename: string }> {
    const res = await fetch('/api/rewrite/docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    })
    if (!res.ok) throw new ApiError('Could not build the DOCX file', res.status)
    const cd = res.headers.get('Content-Disposition') ?? ''
    const filename = /filename="([^"]+)"/.exec(cd)?.[1] ?? 'resume_PAOwerUp.docx'
    return { blob: await res.blob(), filename }
  },

  coach: (body: {
    job_title: string
    job_text: string
    score: number
    verdict: string
    matched_skills: string[]
    missing_skills: string[]
    instructions: string
  }) => post<CoachResponse>('/coach', body),

  questions: (job_text: string, job_title: string, missing_skills: string[]) =>
    post<{ questions: string[]; source: string }>('/interview/questions', { job_text, job_title, missing_skills }),

  async transcribe(blob: Blob, model: string) {
    const form = new FormData()
    const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
    form.append('file', blob, `answer.${ext}`)
    form.append('model', model)
    return request<TranscriptResponse>('/transcribe', { method: 'POST', body: form })
  },

  speechMetrics: (text: string, words: Word[], duration: number) =>
    post<SpeechMetrics>('/speech-metrics', { text, words, duration }),

  feedback: (body: {
    question: string
    transcript: string
    metrics?: SpeechMetrics
    job_title: string
    job_text: string
    instructions: string
  }) => post<FeedbackResponse>('/interview/feedback', body),
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}
