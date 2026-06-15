# CMD 06 — Wire Up AI Chat Screen

Read these files first:
- `nextstep-mobile/src/screens/MainAIScreen.tsx` (already has good UI scaffold)
- `nextstep-mobile/src/api/aiApi.ts` (created in CMD 04)
- `nextstep-mobile/src/api/studentApi.ts`
- `nextstep-mobile/src/constants/colors.ts`

The `MainAIScreen.tsx` already has a good UI skeleton. This command wires it to real API data and adds the actual chat functionality.

## Step 1 — Add chat state and real API calls to MainAIScreen.tsx

Modify `nextstep-mobile/src/screens/MainAIScreen.tsx`:

Add these imports:
```typescript
import { sendChatMessage } from '../api/aiApi'
import { fetchStudentData, type StudentData } from '../api/studentApi'
import { useFocusEffect } from '@react-navigation/native'
import { KeyboardAvoidingView, Platform, FlatList, ActivityIndicator } from 'react-native'
```

Add these state variables:
```typescript
const [studentData, setStudentData] = useState<StudentData | null>(null)
const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'ai'; text: string }>>([])
const [isSending, setIsSending] = useState(false)
const [showChat, setShowChat] = useState(false)
```

Load student data on focus:
```typescript
useFocusEffect(
  useCallback(() => {
    fetchStudentData().then(setStudentData).catch(() => null)
  }, [])
)
```

Add a `handleSend` function:
```typescript
async function handleSend(): Promise<void> {
  const text = aiInput.trim()
  if (!text || isSending) return
  setAiInput('')
  setShowChat(true)
  const userMsg = { id: Date.now().toString(), role: 'user' as const, text }
  setMessages(prev => [...prev, userMsg])
  setIsSending(true)
  try {
    const reply = await sendChatMessage(text)
    setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai' as const, text: reply }])
  } catch {
    setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai' as const, text: 'Sorry, I had trouble connecting. Please try again.' }])
  } finally {
    setIsSending(false)
  }
}
```

Wire `handleSend` to the send button `onPress` and TextInput `onSubmitEditing`.

Wire chip taps to `setAiInput(chip)` AND immediately call `handleSend` after setting input — use a separate `handleChipTap(chip: string)` function that sets the input and sends in one go.

Update the greeting section to use real student name from `studentData?.name` (falling back to `user?.name`).

## Step 2 — Add chat message list

When `showChat` is true, replace the ScrollView content with a FlatList of messages above the input bar:

Each message bubble:
- User messages: right-aligned, #00C896 bg, dark text, 14px, border-radius 18 (top-left 4)
- AI messages: left-aligned, #161B22 bg, white text, 14px, border-radius 18 (top-right 4)
- Each bubble maxWidth 80%, paddingHorizontal 14, paddingVertical 10, marginBottom 8
- AI messages show a small "N" logo circle (24×24, #00C896 bg) to the left of the bubble

Loading indicator while waiting for AI reply:
- Show a typing bubble with three animated dots (or just an ActivityIndicator) in AI message style

Add a "← Back" button in the top bar when `showChat` is true that resets to the home view.

## Step 3 — Keyboard handling

Wrap the entire screen in:
```typescript
<KeyboardAvoidingView
  style={{ flex: 1, backgroundColor: colors.background }}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={0}
>
```

## Step 4 — TypeScript check

Run from the mobile directory: `cd nextstep-mobile && npx tsc --noEmit`
Fix all errors.

## Done
Report what was modified. The AI chat must accept typed input, display the message, call the API, and show the response.
