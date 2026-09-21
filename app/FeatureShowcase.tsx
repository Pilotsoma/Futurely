'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import Reveal from './Reveal'

export default function FeatureShowcase() {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 56, alignItems: 'start' }}>

      {/* Left: editorial feature list — no boxes, typography carries the weight */}
      <div>
        {[
          {
            n: '01',
            label: 'Your Academic Advisor',
            accent: 'var(--purple)',
            desc: 'Ask anything — "What should I focus on this week?" or "What do I need to improve before the final?" Real answers from an advisor that actually knows your academic history, not a generic chatbot.',
          },
          {
            n: '02',
            label: 'Smart Planner',
            accent: 'var(--primary)',
            desc: 'Deadlines and assignments surfaced by priority. No manual entry — ever. Just open it and know what matters today.',
          },
          {
            n: '03',
            label: 'What-If Simulator',
            accent: '#A78BFA',
            desc: 'Drop a hypothetical score in and see how your overall standing shifts instantly. Know exactly what you need before you sit down for that final.',
          },
          {
            n: '04',
            label: 'Your Roadmap',
            accent: '#F59E0B',
            desc: 'A 4-year plan built around your goals — course suggestions, milestones by grade, and college prep guidance, all in one place.',
          },
        ].map((feat, i) => (
          <Reveal key={feat.n} delay={i * 0.06}>
            <div
              onMouseEnter={() => setHoveredFeature(i)}
              onMouseLeave={() => setHoveredFeature(prev => prev === i ? null : prev)}
              style={{
                padding: '28px 24px',
                marginLeft: -24,
                marginRight: -24,
                borderTop: '1px solid var(--border)',
                borderRadius: 12,
                cursor: 'default',
                background: hoveredFeature === i ? 'rgba(255,255,255,0.03)' : 'transparent',
                transition: 'background 0.25s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 10 }}>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  letterSpacing: '2.5px',
                  flexShrink: 0,
                }}>
                  {feat.n}
                </span>
                <h3 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(19px, 2vw, 25px)',
                  fontWeight: 500,
                  letterSpacing: '-0.5px',
                  lineHeight: 1.15,
                  color: feat.accent,
                  margin: 0,
                }}>
                  {feat.label}
                </h3>
              </div>
              <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0, paddingLeft: 40 }}>
                {feat.desc}
              </p>
            </div>
          </Reveal>
        ))}
        <div style={{ borderTop: '1px solid var(--border)' }} />
      </div>

      {/* Right: sticky preview frame — one feature detailed at a time, on hover */}
      <div style={{ position: 'sticky', top: 100 }}>
        <div style={{
          position: 'relative',
          minHeight: 640,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          padding: '44px 44px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
            width: 620, height: 500, pointerEvents: 'none',
            opacity: hoveredFeature !== null ? 1 : 0.4,
            transition: 'opacity 0.4s ease',
            background: 'radial-gradient(ellipse, rgba(41,121,255,0.16) 0%, rgba(124,58,237,0.09) 40%, transparent 72%)',
          }} />

          <AnimatePresence mode="wait">
            {hoveredFeature === null && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{ position: 'relative', textAlign: 'center' }}
              >
                <span style={{
                  display: 'inline-flex', width: 52, height: 52, borderRadius: 14, marginBottom: 20,
                  background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)',
                  alignItems: 'center', justifyContent: 'center', padding: 10,
                }}>
                  <Image src="/logo.png" alt="myFuturely logo" width={32} height={32} style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.6 }} />
                </span>
                <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>
                  Hover a feature to see it in action
                </p>
              </motion.div>
            )}

            {/* Advisor — full mini conversation + suggestion chips */}
            {hoveredFeature === 0 && (
              <motion.div
                key="advisor"
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
                style={{ position: 'relative', width: '100%' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
                  <span style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6,
                  }}>
                    <Image src="/logo.png" alt="myFuturely AI advisor icon" width={24} height={24} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>myFuturely AI</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Knows your academic history</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{
                      fontSize: 14, fontWeight: 500, color: '#fff',
                      background: 'var(--primary)', borderRadius: '12px 12px 2px 12px',
                      padding: '11px 17px', maxWidth: '78%', lineHeight: 1.45,
                    }}>
                      What should I focus on this week?
                    </span>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{
                      fontSize: 14, color: 'var(--text-secondary)',
                      background: 'var(--surface-2)', borderRadius: '12px 12px 12px 2px',
                      padding: '12px 17px', lineHeight: 1.6, maxWidth: '85%',
                    }}>
                      Your chemistry report is due Monday — start it tonight so you have time to revise. Your SAT practice is also overdue by two days.
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{
                      fontSize: 14, fontWeight: 500, color: '#fff',
                      background: 'var(--primary)', borderRadius: '12px 12px 2px 12px',
                      padding: '11px 17px', maxWidth: '78%', lineHeight: 1.45,
                    }}>
                      Am I ready for the chemistry unit test?
                    </span>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{
                      fontSize: 14, color: 'var(--text-secondary)',
                      background: 'var(--surface-2)', borderRadius: '12px 12px 12px 2px',
                      padding: '12px 17px', lineHeight: 1.6, maxWidth: '85%',
                    }}>
                      You&apos;ve completed 4 of 5 assignments in this unit. Review chapters 4–5 tonight and you&apos;ll be in good shape.
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['Study tips for finals', 'College prep advice', 'Help me plan my week'].map((chip, i) => (
                    <span key={i} style={{
                      fontSize: 12.5, color: 'var(--text-secondary)',
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: 20, padding: '7px 14px',
                    }}>
                      {chip}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Planner — full week, priority tags, stats */}
            {hoveredFeature === 1 && (
              <motion.div
                key="planner"
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
                style={{ position: 'relative', width: '100%' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                  <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>This week</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#22d3ee', background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 7, padding: '3px 10px' }}>6 due</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#F87171', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 7, padding: '3px 10px' }}>2 high priority</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {[
                    { day: 'Mon', date: '15', task: 'Chemistry lab report', subject: 'Chemistry', color: '#2979FF', priority: 'High' },
                    { day: 'Tue', date: '16', task: 'Robotics club meeting prep', subject: 'Robotics Club', color: '#F59E0B', priority: null },
                    { day: 'Wed', date: '17', task: 'Read Ch. 5–6', subject: 'English', color: '#22d3ee', priority: null },
                    { day: 'Thu', date: '18', task: 'Practice SAT math section', subject: 'Test Prep', color: '#7C3AED', priority: 'High' },
                    { day: 'Fri', date: '19', task: 'History reading response', subject: 'History', color: '#A78BFA', priority: null },
                  ].map((t, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '13px 0',
                      borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{ width: 36, flexShrink: 0, textAlign: 'center' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t.day}</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t.date}</div>
                      </div>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14.5, color: 'var(--text)', lineHeight: 1.3 }}>{t.task}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t.subject}</div>
                      </div>
                      {t.priority && (
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: '#F87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.22)', borderRadius: 6, padding: '3px 8px', flexShrink: 0 }}>
                          {t.priority}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)' }}>
                  Sorted by priority — automatically, no manual entry
                </div>
              </motion.div>
            )}

            {/* Simulator — multi-scenario bar comparison */}
            {hoveredFeature === 2 && (
              <motion.div
                key="simulator"
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
                style={{ position: 'relative', width: '100%' }}
              >
                <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}>What-if Simulator</span>
                <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '0 0 28px', lineHeight: 1.5 }}>
                  Adding extra study sessions each week
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, height: 160, marginBottom: 16 }}>
                  {[
                    { label: 'Now', pct: null, h: 32, color: 'var(--surface-2)' },
                    { label: '+1 / wk', pct: '+7%', h: 52, color: 'rgba(167,139,250,0.5)' },
                    { label: '+2 / wk', pct: '+18%', h: 78, color: 'rgba(167,139,250,0.75)' },
                    { label: '+3 / wk', pct: '+26%', h: 100, color: 'linear-gradient(180deg, #A78BFA 0%, #7C3AED 100%)' },
                  ].map((b, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                      {b.pct && <span style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA' }}>{b.pct}</span>}
                      <span style={{
                        width: '100%', height: `${b.h}%`, borderRadius: 8,
                        background: b.color,
                      }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{b.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Three extra sessions a week could shift your standing by as much as 26% over a semester — see the exact impact before you commit to it.
                </div>
              </motion.div>
            )}

            {/* Roadmap — full 4-year timeline */}
            {hoveredFeature === 3 && (
              <motion.div
                key="roadmap"
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
                style={{ position: 'relative', width: '100%' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                  <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>Your Roadmap</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 7, padding: '3px 10px' }}>Class of 2028</span>
                </div>
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{ position: 'absolute', left: 15, top: 15, bottom: 15, width: 1, background: 'var(--border)' }} />
                  {[
                    { grade: '9', title: 'Explore interests', text: 'Try different clubs and subjects. Build strong foundations before specializing.', color: '#2979FF' },
                    { grade: '10', title: 'Challenge yourself', text: 'Take on AP or Honors courses in subjects you enjoy most.', color: '#22d3ee' },
                    { grade: '11', title: 'Build your college list', text: 'Start researching schools and narrowing down what matters to you.', color: '#A78BFA' },
                    { grade: '12', title: 'Apply with confidence', text: 'Applications, essays, and decisions — all tracked in one place.', color: '#F59E0B' },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '11px 0', position: 'relative' }}>
                      <span style={{
                        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                        background: `rgba(${s.color === '#2979FF' ? '41,121,255' : s.color === '#22d3ee' ? '34,211,238' : s.color === '#A78BFA' ? '167,139,250' : '245,158,11'},0.16)`,
                        border: `1px solid ${s.color}`, color: s.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12.5, fontWeight: 700,
                        position: 'relative', zIndex: 1,
                      }}>{s.grade}</span>
                      <div>
                        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{s.title}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
