import DOMPurify from 'dompurify'

// Minimal, dependency-free markdown-subset renderer for AI chat bubbles.
// Only supports what the chat system prompt is allowed to emit
// (see backend/src/routes/ai.ts formatInstruction): **bold**, *italics*,
// and newlines. Everything else is escaped as literal text, and the final
// HTML is sanitized so a prompt-injected or model-generated <script>/<img
// onerror> can never execute — only the tags we explicitly allow survive.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function renderChatMarkdown(text: string): string {
  const escaped = escapeHtml(text)
  const withBold = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  const withItalics = withBold.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  const withBreaks = withItalics.replace(/\n/g, '<br />')
  return DOMPurify.sanitize(withBreaks, { ALLOWED_TAGS: ['strong', 'em', 'br'], ALLOWED_ATTR: [] })
}
