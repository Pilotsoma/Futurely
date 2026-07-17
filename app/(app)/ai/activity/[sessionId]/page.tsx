'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { api, type AgentSessionData, type AgentToolCallData } from '../../../../../lib/api'
import { renderChatMarkdown } from '../../../../../lib/chatMarkdown'

// ── Friendly display names for tool calls ───────────────────────────────────

const TOOL_DISPLAY: Record<string, string> = {
  write_intent: 'Requested action approval',
  read_planner: 'Read planner tasks',
  read_grades: 'Read grade data',
  read_gpa: 'Read GPA information',
  read_roadmap: 'Read course roadmap',
  update_planner: 'Updated a planner task',
  create_planner_item: 'Created a planner task',
  delete_planner_item: 'Removed a planner task',
  update_course: 'Updated course information',
  read_assignments: 'Read assignment list',
  read_colleges: 'Read college list',
  send_notification: 'Sent a notification',
}

function friendlyToolName(toolName: string): string {
  return TOOL_DISPLAY[toolName] ?? toolName.replaceAll('_', ' ')
}

const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  COMPLETED: { text: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  FAILED: { text: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
  RUNNING: { text: '#2979FF', bg: 'rgba(41,121,255,0.1)' },
  PENDING: { text: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  DENIED: { text: '#52698A', bg: 'rgba(82,105,138,0.1)' },
}

const MODULE_LABELS: Record<string, string> = {
  PLANNER: 'Planner',
  GPA: 'GPA',
  ROADMAP: 'Roadmap',
  CHAT: 'Chat',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

function durationMs(start: string, end: string | null): string {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default function AgentSessionDetailPage() {
  const params = useParams()
  const rawId = params?.sessionId
  const sessionId = typeof rawId === 'string' ? parseInt(rawId, 10) : null

  const [session, setSession] = useState<AgentSessionData | null>(null)
  const [toolCalls, setToolCalls] = useState<AgentToolCallData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (sessionId == null || isNaN(sessionId)) {
      setError('Invalid session ID.')
      setLoading(false)
      return
    }

    async function load() {
      try {
        const [s, tc] = await Promise.all([
          api.getAgentSession(sessionId as number),
          api.getAgentToolCalls(sessionId as number),
        ])
        setSession(s)
        setToolCalls(tc)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session details.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [sessionId])

  if (loading) {
    return (
      <div style={S.page}>
        <BackLink />
        <div style={S.spinnerRow}>
          <div style={S.spinner} aria-label="Loading" />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading session…</span>
        </div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div style={S.page}>
        <BackLink />
        <div style={S.errorBox}>
          <p style={{ color: 'var(--error)', fontSize: 13, margin: 0 }}>
            {error ?? 'Session not found.'}
          </p>
        </div>
      </div>
    )
  }

  const statusStyle = STATUS_COLORS[session.status] ?? { text: 'var(--text-muted)', bg: 'var(--surface-2)' }

  return (
    <div style={S.page}>
      <BackLink />

      <div style={S.header}>
        <div style={S.headerTop}>
          <span style={S.modulePill}>{MODULE_LABELS[session.module] ?? session.module}</span>
          <span style={{ ...S.statusBadge, color: statusStyle.text, background: statusStyle.bg }}>
            {session.status.charAt(0) + session.status.slice(1).toLowerCase()}
          </span>
        </div>
        <h1 style={S.title}>
          {session.userMessage
            ? session.userMessage.length > 100
              ? session.userMessage.slice(0, 100) + '…'
              : session.userMessage
            : 'Automatic check-in'}
        </h1>
        <div style={S.metaRow}>
          <MetaItem label="Started" value={formatDate(session.startedAt)} />
          <MetaItem label="Duration" value={durationMs(session.startedAt, session.completedAt)} />
          <MetaItem label="Tool calls" value={String(session.toolCallCount)} />
          <MetaItem label="Trigger" value={session.trigger} />
        </div>
      </div>

      {/* Final response */}
      {session.finalResponse && (
        <section style={S.card}>
          <p style={S.sectionLabel}>AI Response</p>
          <div
            style={S.responseBody}
            dangerouslySetInnerHTML={{ __html: renderChatMarkdown(session.finalResponse) }}
          />
        </section>
      )}

      {/* Error message */}
      {session.errorMessage && (
        <section style={{ ...S.card, borderColor: 'rgba(239,68,68,0.25)' }}>
          <p style={{ ...S.sectionLabel, color: 'var(--error)' }}>Error</p>
          <p style={{ fontSize: 13, color: 'var(--error)', margin: 0 }}>{session.errorMessage}</p>
        </section>
      )}

      {/* Tool call timeline */}
      <section style={S.card}>
        <p style={S.sectionLabel}>
          Tool Calls{toolCalls.length > 0 ? ` (${toolCalls.length})` : ''}
        </p>

        {toolCalls.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            No tool calls recorded for this session.
          </p>
        ) : (
          <ol style={S.timeline}>
            {toolCalls.map((tc, i) => {
              const tcStatus = STATUS_COLORS[tc.status] ?? { text: 'var(--text-muted)', bg: 'var(--surface-2)' }
              return (
                <li key={tc.id} style={S.timelineItem}>
                  <div style={S.timelineNum}>{i + 1}</div>
                  <div style={S.timelineBody}>
                    <div style={S.timelineTop}>
                      <span style={S.toolName}>{friendlyToolName(tc.toolName)}</span>
                      <span
                        style={{
                          ...S.tcStatusBadge,
                          color: tcStatus.text,
                          background: tcStatus.bg,
                        }}
                      >
                        {tc.status.charAt(0) + tc.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                    {tc.executedAt && (
                      <span style={S.tcDate}>{formatDate(tc.executedAt)}</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <style jsx>{`
        @keyframes detSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function BackLink() {
  return (
    <Link href="/ai/activity" style={S.backLink}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Back to Activity
    </Link>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={S.metaItem}>
      <span style={S.metaLabel}>{label}</span>
      <span style={S.metaValue}>{value}</span>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 720,
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 13,
    color: 'var(--text-muted)',
    textDecoration: 'none',
    marginBottom: 20,
  },
  spinnerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '2px solid rgba(41,121,255,0.2)',
    borderTopColor: '#2979FF',
    animation: 'detSpin 0.9s linear infinite',
  },
  errorBox: {
    padding: 20,
    background: 'var(--surface)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 10,
  },
  header: {
    marginBottom: 20,
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  modulePill: {
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: 'var(--primary)',
    background: 'rgba(41,121,255,0.1)',
    border: '1px solid rgba(41,121,255,0.18)',
    borderRadius: 4,
    padding: '2px 7px',
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 4,
    padding: '2px 8px',
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.2px',
    marginBottom: 14,
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 16,
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
  metaLabel: {
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: 'var(--text-muted)',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.7px',
    color: 'var(--text-muted)',
    marginBottom: 14,
  },
  responseBody: {
    fontSize: 14,
    lineHeight: 1.65,
    color: 'var(--text)',
  },
  timeline: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  },
  timelineItem: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
  },
  timelineNum: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    flexShrink: 0,
    marginTop: 1,
  },
  timelineBody: {
    flex: 1,
    minWidth: 0,
  },
  timelineTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap' as const,
  },
  toolName: {
    fontSize: 13.5,
    fontWeight: 600,
    color: 'var(--text)',
  },
  tcStatusBadge: {
    fontSize: 10.5,
    fontWeight: 700,
    borderRadius: 4,
    padding: '2px 7px',
  },
  tcDate: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 2,
    display: 'block',
  },
}
