import type { NodeTypes } from '@xyflow/react'
import { CoachNode } from './CoachNode'
import { FeedbackNode } from './FeedbackNode'
import { JobNode } from './JobNode'
import { MatchEngineNode } from './MatchEngineNode'
import { RecorderNode } from './RecorderNode'
import { ReportNode } from './ReportNode'
import { ResumeNode } from './ResumeNode'
import { RewriterNode } from './RewriterNode'
import { SkillExtractorNode } from './SkillExtractorNode'
import { SkillGapNode } from './SkillGapNode'
import { SpeechMetricsNode } from './SpeechMetricsNode'
import { TranscriberNode } from './TranscriberNode'

export const nodeTypes: NodeTypes = {
  resume: ResumeNode,
  job: JobNode,
  skillExtractor: SkillExtractorNode,
  matchEngine: MatchEngineNode,
  skillGap: SkillGapNode,
  rewriter: RewriterNode,
  coach: CoachNode,
  recorder: RecorderNode,
  transcriber: TranscriberNode,
  speechMetrics: SpeechMetricsNode,
  feedback: FeedbackNode,
  report: ReportNode,
}
