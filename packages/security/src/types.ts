// Response shapes of the Gully Security API (gullysecurity.xyz), as the server writes them
// (gully-security server/security-routes.mjs, server/gully-score.mjs, server/security/schema.mjs).

import type { SecurityChainKey } from './chains'

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type SeverityCounts = Record<Severity, number>

export type ScanStatus = 'queued' | 'fetching' | 'analysing' | 'triaging' | 'reporting' | 'done' | 'failed' | 'cancelled'
export type ScanMode = 'static+ai' | 'ai-only' | 'static-only' | 'bytecode-only' | 'checklist'
export type InputKind = 'address' | 'github' | 'upload' | 'web2'

/** What a scan looks at, as the server stores it (addresses lower-cased). */
export type ScanInput =
  | { kind: 'address'; chain: SecurityChainKey; address: string }
  | { kind: 'github' | 'web2'; repo: string; commit: string | null; ref: string | null }
  | { kind: 'upload'; filename?: string }

/** The visitor's free scans today and what one more costs. */
export interface Quota {
  freePerDay: number
  used: number
  left: number
  resetsAt: string
  nextPriceUsd: number
  active: number
  maxActive: number
}

/** One scan, as its owner (the visitor that started it) sees it. */
export interface ScanView {
  id: string
  status: ScanStatus | 'unknown'
  title: string
  input: ScanInput
  upload: { name: string; size: number } | null
  free: boolean
  priceUsd: number
  progress: { pct: number; message: string } | null
  mode: ScanMode | null
  label: string | null
  duplicate: boolean
  createdAt: string
  startedAt: string | null
  updatedAt: string
  completedAt: string | null
  counts: SeverityCounts | null
  published: boolean
  publishedAt: string | null
  indexable: boolean
  /** Site-relative path of the public report (`/reports/<id>`) once published. */
  publicUrl: string | null
  cancelReason: string | null
  /** Present on single-scan reads: the report once done. */
  report?: ScanReport | null
  /** Present on single-scan reads: the failure in plain words once failed. */
  failure?: string | null
}

export interface Finding {
  id: string
  title: string
  severity: Severity
  likelihood: 'high' | 'medium' | 'low'
  impact: 'high' | 'medium' | 'low' | 'none'
  confidence: 'high' | 'medium' | 'low'
  category: string
  triage: 'ai-triaged' | 'ai-found' | 'tool-untriaged' | 'engine-note'
  sources: { tool: string; detector: string | null }[]
  locations: { file: string; line: number | null; endLine: number | null }[]
  description: string
  explanation: string
  recommendation: string
  poc: { framework: 'foundry'; status: 'draft-not-executed' | 'executed-passed' | 'executed-failed'; code: string; note: string } | null
  verifiedByHuman: false
  status: 'open'
}

/** The AI Security Scan report (schema 1.x). Never an audit: see `disclaimer`. */
export interface ScanReport {
  schemaVersion: string
  kind: 'ai-security-scan'
  id: string
  title: string
  mode: ScanMode
  label: string
  createdAt: string
  completedAt: string
  engine: { name: 'gully-security'; version: string }
  target: {
    type: InputKind
    chainId: number | null
    chainName?: string | null
    address: string | null
    explorerUrl?: string | null
    verified: boolean | null
    sourceProvider?: 'etherscan' | 'blockscout' | 'sourcify' | null
    sourceMatch?: 'full' | 'partial' | null
    sourceUrl?: string | null
    contractName?: string | null
    compiler?: Record<string, unknown> | null
    proxy?: Record<string, unknown> | null
    bytecodeSha256?: string | null
    repo: Record<string, unknown> | null
    upload: Record<string, unknown> | null
  }
  scope: {
    files: { path: string; sha256: string; lines: number; nsloc: number; language: string; inScope: boolean; reason: string | null }[]
    totalNsloc: number
    inScopeFiles: number
    excluded: { path: string; reason: string }[]
  }
  tools: { name: string; version: string | null; status: 'ran' | 'failed' | 'not-run' | 'skipped'; reason: string | null; durationMs: number | null; findings: number }[]
  ai: Record<string, unknown>
  summary: { text: string; counts: SeverityCounts; findings: number; dropped: number }
  findings: Finding[]
  dropped: { tool: string; detector: string | null; title: string; location: Record<string, unknown> | null; reason: string }[]
  checklist: { id: string; area: string; item: string; result: 'pass' | 'fail' | 'warn' | 'not-checked'; note: string; locations: Finding['locations'] }[] | null
  dependencies: Record<string, unknown> | null
  limitations: string[]
  disclaimer: string
}

/** A published report in the public list. */
export interface ReportSummary {
  /** The published report's id (`sec_...`), used in `/reports/<id>`. */
  id: string
  title: string
  input: ScanInput
  upload: { name: string } | null
  completedAt: string | null
  publishedAt: string
  indexable: boolean
  counts: SeverityCounts | null
  mode: ScanMode | null
  label: string | null
  /** Site-relative path, `/reports/<id>`. */
  url: string
}

/** One published report: the report snapshot (draft PoC code removed) with its public fields on top. */
export type PublishedReport = Omit<ScanReport, keyof ReportSummary> & ReportSummary

export interface SecurityStats {
  generatedAt: string
  totals: { started: number; done: number; failed: number; running: number; findings: number; published: number }
  days: { day: string; started: number; done: number; failed: number; findings: number }[]
  bySeverity: SeverityCounts
  byChain: { key: SecurityChainKey; chainId: number; name: string; scans: number; findings: number }[]
  byKind: Record<InputKind, number>
}

export interface LiveScan {
  kind: InputKind
  chain: SecurityChainKey | null
  title: string
  status: ScanStatus | 'unknown'
  pct: number
  startedAt: string
  completedAt: string | null
  counts: SeverityCounts | null
  mode: ScanMode | null
  publicUrl: string | null
}

export interface LiveFeed {
  generatedAt: string
  running: number
  scans: LiveScan[]
}

export type EngineState = 'online' | 'partial' | 'offline'

export interface EngineStatus {
  checkedAt: string
  state: EngineState
  text: string
  engines: {
    id: 'ai' | 'static'
    name: string
    status: 'online' | 'offline'
    note?: string
    tools?: string[]
    checks?: { id: string; name: string; status: 'online' | 'offline' | 'not-built'; required: boolean; version: string | null }[]
    selfTestAt?: string
  }[]
  queue: { running: boolean; queued: number }
  history: { t: string; ms: number | null; state: EngineState; ai: string | null; static: string | null; queued: number; running: boolean }[]
  uptime24h: number | null
}

export interface Offer {
  offer: {
    scan: { id: 'scan'; name: string; priceUsd: number; freePerDay: number; maxActive: number; maxUploadBytes: number }
    review: { id: 'review'; name: string; quoted: boolean; available: boolean }
    audit: { id: 'audit'; name: string; quoted: boolean; available: boolean }
  }
  chains: { key: SecurityChainKey; chainId: number; name: string; logo: string }[]
  checkout: { enabled: boolean }
  quota: Quota
}

export interface ReviewRequest {
  tier: 'review' | 'audit'
  name: string
  email: string
  project: string
  /** At least 20 characters. */
  scope: string
  repo?: string
  chain?: SecurityChainKey
  address?: string
  company?: string
  timeline?: string
  budget?: string
}

/* ------------------------------------------------------------ Gully Score --- */

export type ScoreGrade = 'Strong' | 'Fair' | 'Weak' | 'Poor'

export interface ScoreComponent {
  id: 'verified' | 'control' | 'timelock' | 'upgradeability' | 'changes' | 'liquidity' | 'holders' | 'review' | 'age' | (string & {})
  label: string
  weight: number
  source: string
  what: string
  available: boolean
  score: number | null
  value: string
  reason: string
  evidence: { label: string; url: string }[]
  [extra: string]: unknown
}

export interface ScoreMethodology {
  version: number
  minCoverage: number
  ttlHours: number
  components: { id: string; label: string; weight: number; source: string; what: string }[]
  rules: string[]
}

/** One contract's Gully Score (0 to 100, informational; not an endorsement, not investment advice). */
export interface GullyScore {
  chainId: number
  chainKey: SecurityChainKey
  chainName: string
  address: string
  name: string | null
  symbol: string | null
  /** null when less than `methodology.minCoverage` of the weight could be read. */
  score: number | null
  grade: ScoreGrade | null
  coverage: { weight: number; components: number; of: number }
  computedAt: string
  methodVersion: number
  components: ScoreComponent[]
  history: { at: string; score: number | null }[]
  changes: { at: string; id: string | null; label: string; from: number | null; to: number | null; note: string }[]
  chain: { id: number; key: SecurityChainKey; name: string; explorer: string | null }
  listed: boolean
  links: { page: string; badge: string; explorer: string }
  methodology: ScoreMethodology
  /** True when a stored result was served because a fresh one could not be worked out. */
  stale: boolean
}

export interface ScoreIndexRow {
  chainId: number
  chainKey: SecurityChainKey
  chainName: string
  address: string
  name: string | null
  symbol: string | null
  score: number | null
  grade: ScoreGrade | null
  coverage: { weight: number; components: number; of: number }
  computedAt: string
  change: number | null
}

export interface ScoreIndex {
  scores: ScoreIndexRow[]
  chains: { id: number; key: SecurityChainKey; name: string }[]
  methodology: ScoreMethodology
}
