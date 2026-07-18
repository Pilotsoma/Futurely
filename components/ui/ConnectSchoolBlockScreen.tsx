'use client'

import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { api, ApiError } from '@/lib/api'
import { SORTED_ISD_LIST, type ISDEntry } from '@/lib/isds'

interface ConnectSchoolBlockScreenProps {
  onLogout: () => void
  onConnected?: () => void
}

type SubmitState = 'idle' | 'submitting' | 'success'

interface BlockMessage {
  text: string
  type: 'error'
}

export default function ConnectSchoolBlockScreen({ onLogout, onConnected }: ConnectSchoolBlockScreenProps) {
  const [selectedIsd, setSelectedIsd] = useState<ISDEntry | null>(null)
  const [isdSearch, setIsdSearch]     = useState('')
  const [isdOpen, setIsdOpen]         = useState(false)
  const [useCustomUrl, setUseCustomUrl] = useState(false)
  const [hacUrl, setHacUrl]           = useState('')
  const [hacUsername, setHacUsername] = useState('')
  const [hacPassword, setHacPassword] = useState('')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [message, setMessage]         = useState<BlockMessage | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsdOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  const filteredIsds = SORTED_ISD_LIST.filter(isd =>
    (isd.hacUrl || isd.classlinkId) && (
      isd.name.toLowerCase().includes(isdSearch.toLowerCase()) ||
      isd.state.toLowerCase().includes(isdSearch.toLowerCase())
    )
  )

  // True when the selected district uses ClassLink instead of HAC
  const isClasslinkDistrict = !!(selectedIsd?.classlinkId && !selectedIsd?.hacUrl)

  const isdDisplayLabel = useCustomUrl
    ? 'Other / Not Listed'
    : selectedIsd
    ? `${selectedIsd.name} (${selectedIsd.state})`
    : ''

  function selectIsd(isd: ISDEntry) {
    setSelectedIsd(isd)
    setHacUrl(isd.hacUrl ?? '')
    setUseCustomUrl(false)
    setIsdSearch('')
    setIsdOpen(false)
  }

  function selectOther() {
    setSelectedIsd(null)
    setHacUrl('')
    setUseCustomUrl(true)
    setIsdSearch('')
    setIsdOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (!hacUsername.trim() || !hacPassword.trim()) {
      setMessage({ text: 'Please enter your school portal username and password.', type: 'error' })
      return
    }
    if (!isClasslinkDistrict && !hacUrl.trim()) {
      setMessage({ text: 'Please select your school district or enter a portal URL.', type: 'error' })
      return
    }

    setSubmitState('submitting')
    try {
      if (isClasslinkDistrict && selectedIsd?.classlinkId) {
        await api.classlinkConnect(selectedIsd.classlinkId, hacUsername.trim(), hacPassword.trim())
      } else {
        await api.portalLoginHAC(hacUrl.trim(), hacUsername.trim(), hacPassword.trim())
      }
      setSubmitState('success')
      setTimeout(() => {
        onConnected?.()
      }, 1500)
    } catch (err) {
      setSubmitState('idle')
      const msg = err instanceof ApiError
        ? err.message
        : 'Could not connect to your school portal. Please check your credentials and try again.'
      setMessage({ text: msg, type: 'error' })
    }
  }

  return (
    <div style={S.card}>
      <div style={S.logoRow}>
        <Image src="/logo.png" alt="myFuturely" width={40} height={40} style={{ objectFit: 'contain' }} />
        <span style={S.logoText}>myFuturely</span>
      </div>

      <h1 style={S.heading}>Connect your school portal</h1>
      <p style={S.body}>
        To finish setting up your account, we need to verify your identity through your school portal.
        Connect it below — this only takes a moment.
      </p>

      {submitState === 'success' ? (
        <div style={S.successState}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
            style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', flexShrink: 0 }}
          />
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>
              Connecting to your school&hellip;
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              We&rsquo;ll verify your account in the background. This may take a moment.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={e => void handleSubmit(e)} style={S.form}>
          {/* District selector */}
          <div style={S.field}>
            <label style={S.label}>School District</label>
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => { setIsdOpen(v => !v); setIsdSearch('') }}
                style={{
                  ...S.input,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: 'var(--bg)',
                  color: isdDisplayLabel ? 'var(--text)' : 'var(--text-muted)',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isdDisplayLabel || 'Search for your school district...'}
                </span>
                <span style={{ fontSize: 12, marginLeft: 8, flexShrink: 0 }}>{isdOpen ? '▲' : '▼'}</span>
              </button>
              {isdOpen && (
                <div style={S.dropdownPanel}>
                  <div style={{ padding: '8px 8px 4px' }}>
                    <input
                      autoFocus
                      type="text"
                      value={isdSearch}
                      onChange={e => setIsdSearch(e.target.value)}
                      placeholder="Type to search..."
                      style={{ ...S.input, height: 36, fontSize: 13, padding: '6px 10px' }}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                  <div style={S.dropdownList}>
                    {filteredIsds.length === 0 ? (
                      <div style={S.dropdownEmpty}>No districts found</div>
                    ) : filteredIsds.map(isd => (
                      <button
                        key={isd.hacUrl ?? isd.classlinkId ?? isd.name}
                        type="button"
                        style={{
                          ...S.dropdownItem,
                          background: selectedIsd?.name === isd.name ? 'var(--primary-dim)' : 'transparent',
                          color: selectedIsd?.name === isd.name ? 'var(--primary)' : 'var(--text)',
                        }}
                        onClick={() => selectIsd(isd)}
                      >
                        <span style={{ fontWeight: 500 }}>{isd.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{isd.state}</span>
                      </button>
                    ))}
                    <div style={S.dropdownDivider} />
                    <button
                      type="button"
                      style={{
                        ...S.dropdownItem,
                        background: useCustomUrl ? 'var(--primary-dim)' : 'transparent',
                        color: useCustomUrl ? 'var(--primary)' : 'var(--text-secondary)',
                        fontStyle: 'italic',
                      }}
                      onClick={selectOther}
                    >
                      Other / My district is not listed
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {useCustomUrl && !isClasslinkDistrict && (
            <div style={S.field}>
              <label style={S.label}>Portal URL</label>
              <input
                type="url"
                value={hacUrl}
                onChange={e => setHacUrl(e.target.value)}
                placeholder="https://homeaccess.yourisd.org/"
                required
                style={S.input}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Enter the base URL of your school&apos;s Home Access Center portal.
              </span>
            </div>
          )}

          <div style={S.field}>
            <label style={S.label}>{isClasslinkDistrict ? 'ClassLink Username' : 'HAC Username'}</label>
            <input
              type="text"
              value={hacUsername}
              onChange={e => setHacUsername(e.target.value)}
              placeholder={isClasslinkDistrict ? 'Your ClassLink username' : 'Your HAC username'}
              autoComplete="username"
              style={S.input}
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>{isClasslinkDistrict ? 'ClassLink Password' : 'HAC Password'}</label>
            <input
              type="password"
              value={hacPassword}
              onChange={e => setHacPassword(e.target.value)}
              placeholder={isClasslinkDistrict ? 'Your ClassLink password' : 'Your HAC password'}
              autoComplete="current-password"
              style={S.input}
            />
          </div>

          <p style={S.hint}>Your school credentials are never stored — used only to fetch grades.</p>

          {message && (
            <p
              role="alert"
              style={{
                ...S.messageBase,
                color: 'var(--text)',
                borderColor: 'var(--error)',
                background: 'rgba(239, 68, 68, 0.08)',
              }}
            >
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={submitState === 'submitting'}
            style={{
              ...S.btn,
              opacity: submitState === 'submitting' ? 0.5 : 1,
              cursor: submitState === 'submitting' ? 'not-allowed' : 'pointer',
            }}
          >
            {submitState === 'submitting' ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', flexShrink: 0 }}
                />
                Connecting&hellip;
              </>
            ) : 'Connect school portal'}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={onLogout}
        style={S.logoutBtn}
      >
        Sign out
      </button>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '40px 36px',
    maxWidth: 440,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    maxHeight: 'calc(100vh - 48px)',
    overflowY: 'auto',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.3px',
  },
  heading: {
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text)',
    margin: '0 0 12px',
  },
  body: {
    fontSize: 15,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: '0 0 28px',
  },
  successState: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: '20px 16px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    marginBottom: 16,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    marginBottom: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    letterSpacing: '0.02em',
  },
  input: {
    width: '100%',
    height: 48,
    padding: '0 14px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  hint: {
    fontSize: 11.5,
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    margin: 0,
  },
  messageBase: {
    fontSize: 13,
    lineHeight: 1.5,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid',
    margin: 0,
  },
  btn: {
    width: '100%',
    height: 48,
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    transition: 'opacity 0.15s',
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 13,
    cursor: 'pointer',
    padding: '12px 0',
    minHeight: 44,
    textAlign: 'center' as const,
    width: '100%',
    marginTop: 8,
  },
  dropdownPanel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 100,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(26,21,14,0.10)',
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownList: {
    maxHeight: 220,
    overflowY: 'auto' as const,
    padding: '4px 8px 8px',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '9px 10px',
    borderRadius: 7,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    textAlign: 'left' as const,
    transition: 'background 0.1s',
  },
  dropdownEmpty: {
    padding: '12px 10px',
    color: 'var(--text-muted)',
    fontSize: 13,
    textAlign: 'center' as const,
  },
  dropdownDivider: {
    height: 1,
    background: 'var(--border)',
    margin: '4px 0',
  },
}
