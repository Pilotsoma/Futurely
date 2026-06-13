'use client'

import { useRef, useState } from 'react'
import { api } from '../../../lib/api'

interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  text: string
}

const CHIPS = ['What is my GPA?', 'Upcoming assignments?', 'College advice', 'Study tips', 'Weakest class?']

export default function AIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function handleSend(textOverride?: string) {
    const text = (textOverride ?? input).trim()
    if (!text || isSending) return
    setInput('')
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text }
    setMessages(prev => [...prev, userMsg])
    setIsSending(true)
    try {
      const { reply } = await api.chat(text)
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', text: reply }])
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', text: 'Sorry, I had trouble connecting. Please try again.' }])
    } finally {
      setIsSending(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  return (
    <div style={styles.shell}>
      {/* Left: chips */}
      <div style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}>Quick Questions</h2>
        {CHIPS.map(chip => (
          <button key={chip} style={styles.chip} onClick={() => void handleSend(chip)}>
            {chip}
          </button>
        ))}
      </div>

      {/* Right: chat */}
      <div style={styles.chatArea}>
        <h1 style={styles.heading}>NextStep AI</h1>

        <div style={styles.messages}>
          {messages.length === 0 && (
            <div style={styles.emptyChat}>
              <div style={styles.logo}>N</div>
              <p style={{ color: 'var(--text-secondary)' }}>Ask me anything about your grades, GPA, or college plans.</p>
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} style={{ ...styles.bubble, ...(m.role === 'user' ? styles.bubbleUser : styles.bubbleAi) }}>
              {m.text}
            </div>
          ))}
          {isSending && (
            <div style={{ ...styles.bubble, ...styles.bubbleAi, color: 'var(--text-muted)' }}>
              Thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={styles.inputBar}>
          <input
            style={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleSend() }}
            placeholder="Ask NextStep AI..."
            disabled={isSending}
          />
          <button style={{ ...styles.sendBtn, opacity: isSending ? 0.6 : 1 }} onClick={() => void handleSend()} disabled={isSending}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', gap: '24px', height: 'calc(100vh - 64px)' },
  sidebar: { width: '200px', flexShrink: 0 },
  sidebarTitle: { fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' },
  chip: { display: 'block', width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', fontSize: '13px', color: 'var(--text)', marginBottom: '8px', textAlign: 'left' as const },
  chatArea: { flex: 1, display: 'flex', flexDirection: 'column' },
  heading: { fontSize: '24px', fontWeight: '700', marginBottom: '16px' },
  messages: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' },
  emptyChat: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px', color: 'var(--text-secondary)' },
  logo: { width: '56px', height: '56px', borderRadius: '16px', background: 'var(--primary)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '800' },
  bubble: { maxWidth: '70%', padding: '12px 16px', borderRadius: '16px', fontSize: '14px', lineHeight: '1.5' },
  bubbleUser: { background: 'var(--primary)', color: 'var(--bg)', alignSelf: 'flex-end', borderBottomRightRadius: '4px' },
  bubbleAi: { background: 'var(--surface)', border: '1px solid var(--border)', alignSelf: 'flex-start', borderBottomLeftRadius: '4px' },
  inputBar: { display: 'flex', gap: '12px' },
  input: { flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 16px', color: 'var(--text)', outline: 'none', fontSize: '15px' },
  sendBtn: { background: 'var(--primary)', color: 'var(--bg)', border: 'none', borderRadius: '8px', padding: '12px 24px', fontWeight: '600', fontSize: '14px' },
}
