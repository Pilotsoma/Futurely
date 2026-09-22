import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, fonts, radii, spacing, typography } from '../theme/tokens'
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { useAuth } from '../context/AuthContext'
import { sendChatMessage } from '../api/aiApi'
import * as studentsApi from '../api/studentsApi'
import { ActionTile } from '../components/ui/ActionTile'
import { createActionLock } from '../utils/actionLock'
import type { StudentMe } from '../types/student'
import type { MainTabParamList } from '../navigation/MainNavigator'


interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  text: string
}

interface ChatSession {
  id: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
}

interface PromptOption {
  label: string
  subtitle: string
  prompt: string
  icon: React.ComponentProps<typeof Feather>['name']
  color: string
  background: string
}


const PROMPTS: PromptOption[] = [
  {
    label: 'Raise my GPA',
    subtitle: 'Build a focused improvement plan',
    prompt: 'How can I raise my GPA, and which classes should I focus on first?',
    icon: 'trending-up',
    color: colors.accent2,
    background: colors.accent2Dim,
  },
  {
    label: 'Plan my week',
    subtitle: 'Organize assignments and priorities',
    prompt: 'Help me plan my school week based on my assignments and priorities.',
    icon: 'calendar',
    color: colors.accent,
    background: colors.accentDim,
  },
  {
    label: 'Study smarter',
    subtitle: 'Create a better study routine',
    prompt: 'Help me create a focused study plan for an upcoming test.',
    icon: 'book-open',
    color: '#A78BFA',
    background: 'rgba(167,139,250,0.15)',
  },
  {
    label: 'College roadmap',
    subtitle: 'Map out your next application steps',
    prompt: 'Help me build a college application roadmap and tell me what to do next.',
    icon: 'map',
    // Not colors.gold/goldBg — that pair is reserved for achievement/streak chips only.
    color: '#FB923C',
    background: 'rgba(251, 146, 60, 0.15)',
  },
]

const APP_LOGO = require('../../assets/logo.png')
const CHAT_HISTORY_KEY = 'myfuturely.ai.chat-history.v1'
const MAX_SAVED_CHATS = 30

function makeChatTitle(messages: ChatMessage[]): string {
  const firstQuestion = messages.find((message) => message.role === 'user')?.text.trim()
  if (!firstQuestion) return 'New conversation'
  return firstQuestion.length > 44 ? `${firstQuestion.slice(0, 44)}…` : firstQuestion
}

function formatChatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const today = new Date()

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })
}

const PROMPT_ROWS: PromptOption[][] = Array.from(
  { length: Math.ceil(PROMPTS.length / 2) },
  (_, index) => PROMPTS.slice(index * 2, index * 2 + 2),
)

const PILL_HEIGHT = 64

export default function AIChatScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<MainTabParamList, 'AIChat'>>()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const [studentData, setStudentData] = useState<StudentMe | null>(null)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [historyVisible, setHistoryVisible] = useState(false)
  const [history, setHistory] = useState<ChatSession[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const listRef = useRef<FlatList<ChatMessage>>(null)
  const sendLockRef = useRef(createActionLock())
  const handledInitialPromptRef = useRef<string | null>(null)

  // Tab bar clearance — FloatingTabBar is position:absolute, height 64,
  // bottom = Math.max(20, insets.bottom + 8). When keyboard shows,
  // tabBarHideOnKeyboard:true in MainNavigator hides it automatically.
  const tabBarBottom = Math.max(20, insets.bottom + 8)
  const tabBarClearance = tabBarBottom + PILL_HEIGHT
  const composerBottomPad = keyboardVisible
    ? Math.max(spacing.sm, insets.bottom)
    : tabBarClearance + spacing.xs
  const contentBottomPad = tabBarClearance + spacing.md

  useEffect(() => {
    let mounted = true

    AsyncStorage.getItem(CHAT_HISTORY_KEY)
      .then((stored) => {
        if (!mounted || !stored) return
        const parsed = JSON.parse(stored) as ChatSession[]
        if (Array.isArray(parsed)) setHistory(parsed)
      })
      .catch(() => undefined)

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true))
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      let cancelled = false

      studentsApi.getMe()
        .then((result) => {
          if (!cancelled) setStudentData(result)
        })
        .catch(() => undefined)

      return () => {
        cancelled = true
      }
    }, []),
  )

  const firstName = studentData?.name?.split(' ')[0] ?? user?.name?.split(' ')[0] ?? 'Student'
  const canSend = input.trim().length > 0 && !isSending

  const saveSession = useCallback((sessionId: string, nextMessages: ChatMessage[]) => {
    if (nextMessages.length === 0) return

    const session: ChatSession = {
      id: sessionId,
      title: makeChatTitle(nextMessages),
      updatedAt: Date.now(),
      messages: nextMessages,
    }

    setHistory((current) => {
      const next = [
        session,
        ...current.filter((item) => item.id !== sessionId),
      ].slice(0, MAX_SAVED_CHATS)

      void AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  async function handleSend(textOverride?: string): Promise<void> {
    const text = (textOverride ?? input).trim()
    if (!text) return

    const release = sendLockRef.current.tryAcquire()
    if (!release) return

    setInput('')
    setShowChat(true)

    const timestamp = Date.now()
    const sessionId = currentChatId ?? `chat-${timestamp}`

    if (!currentChatId) setCurrentChatId(sessionId)

    const userMessage: ChatMessage = {
      id: `${timestamp}-user`,
      role: 'user',
      text,
    }

    setMessages((current) => {
      const next = [...current, userMessage]
      saveSession(sessionId, next)
      return next
    })
    setIsSending(true)

    try {
      const result = await sendChatMessage(text)
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-ai`,
        role: 'ai',
        text: result.reply,
      }

      setMessages((current) => {
        const next = [...current, assistantMessage]
        saveSession(sessionId, next)
        return next
      })
    } catch {
      const errorMessage: ChatMessage = {
        id: `${Date.now()}-error`,
        role: 'ai',
        text: 'I had trouble connecting just now. Please try sending that again.',
      }

      setMessages((current) => {
        const next = [...current, errorMessage]
        saveSession(sessionId, next)
        return next
      })
    } finally {
      release()
      setIsSending(false)
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120)
    }
  }

  useEffect(() => {
    const initialPrompt = route.params?.initialPrompt?.trim()
    const promptKey = `${route.params?.requestId ?? 'direct'}:${initialPrompt ?? ''}`
    if (!initialPrompt || handledInitialPromptRef.current === promptKey) return

    handledInitialPromptRef.current = promptKey
    void handleSend(initialPrompt)
    // handleSend intentionally reads the current chat state at the moment a new
    // route prompt arrives; including it would re-run this effect every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.initialPrompt, route.params?.requestId])

  function startNewChat(): void {
    setMessages([])
    setInput('')
    setCurrentChatId(null)
    setShowChat(false)
  }

  function openPastChat(session: ChatSession): void {
    setMessages(session.messages)
    setCurrentChatId(session.id)
    setShowChat(true)
    setHistoryVisible(false)

    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 80)
  }


  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        role="main"
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <Header
          showChat={showChat}
          historyCount={history.length}
          onBack={() => setShowChat(false)}
          onOpenHistory={() => setHistoryVisible(true)}
        />

        <PastChatsModal
          visible={historyVisible}
          sessions={history}
          onClose={() => setHistoryVisible(false)}
          onOpenChat={openPastChat}
          onNewChat={() => {
            startNewChat()
            setHistoryVisible(false)
          }}
        />

        {showChat ? (
          <FlatList
            ref={listRef}
            style={styles.chatList}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={[styles.chatContent, { paddingBottom: contentBottomPad }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.conversationIntro}>
                <View style={styles.conversationIcon}>
                  <Feather name="message-circle" size={18} color={colors.accent} />
                </View>
                <Text style={styles.conversationTitle}>Your conversation</Text>
                <Text style={styles.conversationSubtitle}>
                  Ask about grades, studying, planning, or college preparation.
                </Text>
              </View>
            }
            ListFooterComponent={isSending ? <TypingIndicator /> : <View style={styles.chatFooterSpace} />}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        ) : (
          <ScrollView
            style={styles.homeScroll}
            contentContainerStyle={[styles.homeContent, { paddingBottom: contentBottomPad }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroBadge}>
                  <Feather name="zap" size={15} color={colors.accent} />
                  <Text style={styles.heroBadgeText}>YOUR AI COPILOT</Text>
                </View>
                <View style={styles.secureBadge}>
                  <Feather name="shield" size={13} color={colors.accent2} />
                  <Text style={styles.secureBadgeText}>Student-aware</Text>
                </View>
              </View>

              <Text style={styles.heroTitle}>Hi {firstName}, what can we work on?</Text>
              <Text style={styles.heroDescription}>
                Get personalized support for school, planning, grades, and your path to college.
              </Text>

            </View>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>QUICK START</Text>
                <Text style={styles.sectionTitle}>What do you need help with?</Text>
              </View>
              <Feather name="star" size={17} color={colors.accent} />
            </View>

            <View style={styles.promptGrid}>
              {PROMPT_ROWS.map((row, rowIndex) => (
                <View key={`prompt-row-${rowIndex}`} style={styles.promptRow}>
                  {row.map((prompt) => (
                    <ActionTile
                      key={prompt.label}
                      title={prompt.label}
                      subtitle={prompt.subtitle}
                      icon={prompt.icon}
                      color={prompt.color}
                      iconBackground={prompt.background}
                      disabled={isSending}
                      onPress={() => void handleSend(prompt.prompt)}
                      accessibilityHint={`Start a chat: ${prompt.subtitle}`}
                      testID={`ai-prompt-${prompt.label.toLowerCase().replace(/\s+/g, '-')}`}
                    />
                  ))}
                </View>
              ))}
            </View>

          </ScrollView>
        )}

        <Composer
          value={input}
          onChangeText={setInput}
          onSend={() => void handleSend()}
          canSend={canSend}
          isSending={isSending}
          bottomPad={composerBottomPad}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

interface HeaderProps {
  showChat: boolean
  historyCount: number
  onBack: () => void
  onOpenHistory: () => void
}

function Header({
  showChat,
  historyCount,
  onBack,
  onOpenHistory,
}: HeaderProps): React.JSX.Element {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {showChat ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Back to AI home"
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.logoWrap}>
            <Image source={APP_LOGO} style={styles.headerLogo} resizeMode="contain" />
          </View>
        )}

        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>myFuturely AI</Text>
          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Grounded in your record</Text>
          </View>
        </View>
      </View>

      <Pressable
        onPress={onOpenHistory}
        style={({ pressed }) => [styles.historyButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="View past chats"
      >
        <Feather name="clock" size={16} color={colors.textDim} />
        <Text style={styles.historyButtonText}>Chats</Text>
        {historyCount > 0 ? (
          <View style={styles.historyCount}>
            <Text style={styles.historyCountText}>{Math.min(historyCount, 99)}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  )
}

interface PastChatsModalProps {
  visible: boolean
  sessions: ChatSession[]
  onClose: () => void
  onOpenChat: (session: ChatSession) => void
  onNewChat: () => void
}

function PastChatsModal({
  visible,
  sessions,
  onClose,
  onOpenChat,
  onNewChat,
}: PastChatsModalProps): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.historySheet}>
          <View style={styles.historySheetHeader}>
            <View>
              <Text style={styles.historyEyebrow}>MYFUTURELY AI</Text>
              <Text style={styles.historyTitle}>Past chats</Text>
              <Text style={styles.historySubtitle}>
                Continue a previous conversation.
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.historyCloseButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close past chats"
            >
              <Feather name="x" size={18} color={colors.text} />
            </Pressable>
          </View>

          {sessions.length === 0 ? (
            <View style={styles.historyEmpty}>
              <View style={styles.historyEmptyIcon}>
                <Feather name="message-square" size={22} color={colors.accent} />
              </View>
              <Text style={styles.historyEmptyTitle}>No past chats yet</Text>
              <Text style={styles.historyEmptyText}>
                Your conversations will appear here after you ask a question.
              </Text>
            </View>
          ) : (
            <FlatList
              data={sessions}
              keyExtractor={(item) => item.id}
              style={styles.historyList}
              contentContainerStyle={styles.historyListContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onOpenChat(item)}
                  style={({ pressed }) => [
                    styles.historyCard,
                    pressed && styles.historyCardPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Open chat: ${item.title}`}
                >
                  <View style={styles.historyCardIcon}>
                    <Feather name="message-circle" size={17} color={colors.accent} />
                  </View>

                  <View style={styles.historyCardCopy}>
                    <Text style={styles.historyCardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.historyCardMeta}>
                      {formatChatDate(item.updatedAt)} · {item.messages.length} messages
                    </Text>
                  </View>

                  <Feather name="chevron-right" size={17} color={colors.textFaint} />
                </Pressable>
              )}
            />
          )}

          <Pressable
            onPress={onNewChat}
            style={({ pressed }) => [
              styles.historyNewButton,
              pressed && styles.historyNewButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Start a new chat"
          >
            <Feather name="plus" size={17} color={colors.text} />
            <Text style={styles.historyNewButtonText}>Start new chat</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

interface ComposerProps {
  value: string
  onChangeText: (value: string) => void
  onSend: () => void
  canSend: boolean
  isSending: boolean
  bottomPad: number
}

function Composer({ value, onChangeText, onSend, canSend, isSending, bottomPad }: ComposerProps): React.JSX.Element {
  return (
    <View style={[styles.composerArea, { paddingBottom: bottomPad }]}>
      <View style={styles.composer}>
        <View style={styles.composerIcon}>
          <Feather name="message-circle" size={18} color={colors.accent} />
        </View>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          style={styles.input}
          placeholder="Ask myFuturely AI anything..."
          placeholderTextColor={colors.textFaint}
          editable={!isSending}
          multiline
          maxLength={1200}
          returnKeyType="send"
          blurOnSubmit={false}
          accessibilityLabel="Ask myFuturely AI"
        />
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.sendButton,
            !canSend && styles.sendButtonDisabled,
            pressed && canSend && styles.sendButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          {isSending ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Feather name="send" size={17} color={colors.text} />
          )}
        </Pressable>
      </View>
      <Text style={styles.composerHint}>AI can make mistakes. Check important academic information.</Text>
    </View>
  )
}

const MessageBubble = React.memo(function MessageBubble({
  message,
}: {
  message: ChatMessage
}): React.JSX.Element {
  const isUser = message.role === 'user'

  return (
    <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAi]}>
      {!isUser ? (
        <View style={styles.messageAvatar}>
          <Image source={APP_LOGO} style={styles.messageLogo} resizeMode="contain" />
        </View>
      ) : null}

      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
        {!isUser ? <Text style={styles.messageAuthor}>myFuturely AI</Text> : null}
        <Text style={[styles.messageText, isUser && styles.userMessageText]}>{message.text}</Text>
      </View>
    </View>
  )
})

// Module-scope + trivial passthrough, so it's a stable renderItem identity that
// never forces FlatList to re-evaluate visible cells on unrelated screen re-renders
// (e.g. composer text state changing on every keystroke).
function renderMessageItem({ item }: { item: ChatMessage }): React.JSX.Element {
  return <MessageBubble message={item} />
}

function TypingIndicator(): React.JSX.Element {
  return (
    <View style={[styles.messageRow, styles.messageRowAi]}>
      <View style={styles.messageAvatar}>
        <Image source={APP_LOGO} style={styles.messageLogo} resizeMode="contain" />
      </View>
      <View style={[styles.messageBubble, styles.aiBubble, styles.typingBubble]}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.typingText}>Thinking...</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keyboardView: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
  header: {
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.ms,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.bg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  logoWrap: {
    width: 45,
    height: 45,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  headerLogo: {
    width: 37,
    height: 37,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  headerCopy: {
    gap: 3,
  },
  headerTitle: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 19,
    lineHeight: 23,
    letterSpacing: -0.35,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent2,
  },
  onlineText: {
    color: colors.accent2,
    ...typography.caption,
    fontFamily: fonts.bodyMedium,
  },
  historyButton: {
    minHeight: 39,
    paddingHorizontal: spacing.ms,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  historyButtonText: {
    color: colors.textDim,
    ...typography.label,
  },
  historyCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  historyCountText: {
    color: colors.text,
    ...typography.label,
    fontSize: 9,
  },
  homeScroll: {
    flex: 1,
  },
  homeContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    gap: 17,
  },
  heroCard: {
    padding: 17,
    borderRadius: radii.card,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroBadgeText: {
    color: colors.accent,
    ...typography.label,
    fontSize: 9,
  },
  secureBadge: {
    minHeight: 27,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.sm,
    backgroundColor: colors.accent2Dim,
    borderWidth: 1,
    borderColor: colors.accent2,
  },
  secureBadgeText: {
    color: colors.accent2,
    ...typography.caption,
    fontFamily: fonts.bodyMedium,
  },
  heroTitle: {
    maxWidth: 310,
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.65,
  },
  heroDescription: {
    marginTop: spacing.sm,
    color: colors.textDim,
    ...typography.body,
    maxWidth: 315,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionEyebrow: {
    color: colors.textFaint,
    ...typography.label,
    fontSize: 9,
  },
  sectionTitle: {
    marginTop: 3,
    color: colors.text,
    ...typography.h2,
  },
  promptGrid: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 11,
  },
  promptRow: {
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 11,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  historySheet: {
    maxHeight: '78%',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 28 : spacing.lg,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.cardBorder,
  },
  historySheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: spacing.md,
  },
  historyEyebrow: {
    color: colors.textFaint,
    ...typography.label,
    fontSize: 9,
  },
  historyTitle: {
    marginTop: 3,
    color: colors.text,
    ...typography.h1,
  },
  historySubtitle: {
    marginTop: 3,
    color: colors.textDim,
    ...typography.caption,
    lineHeight: 16,
  },
  historyCloseButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  historyList: {
    maxHeight: 390,
  },
  historyListContent: {
    gap: spacing.ms,
    paddingBottom: spacing.ms,
  },
  historyCard: {
    minHeight: 69,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.ms,
    borderRadius: radii.card,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  historyCardPressed: {
    opacity: 0.88,
    backgroundColor: colors.accentDim,
  },
  historyCardIcon: {
    width: 39,
    height: 39,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.accentDim,
  },
  historyCardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  historyCardTitle: {
    color: colors.text,
    ...typography.h3,
    fontSize: 13,
  },
  historyCardMeta: {
    color: colors.textFaint,
    ...typography.caption,
    fontSize: 10,
  },
  historyEmpty: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  historyEmptyIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.accentDim,
  },
  historyEmptyTitle: {
    marginTop: 11,
    color: colors.text,
    ...typography.h3,
  },
  historyEmptyText: {
    marginTop: 5,
    maxWidth: 250,
    color: colors.textDim,
    ...typography.caption,
    lineHeight: 16,
    textAlign: 'center',
  },
  historyNewButton: {
    minHeight: 48,
    marginTop: spacing.ms,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radii.button,
    backgroundColor: colors.accent,
  },
  historyNewButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  historyNewButtonText: {
    color: colors.text,
    ...typography.label,
    fontSize: 13,
  },
  chatList: {
    flex: 1,
  },
  chatContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  conversationIntro: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  conversationIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  conversationTitle: {
    marginTop: spacing.ms,
    color: colors.text,
    ...typography.h3,
  },
  conversationSubtitle: {
    marginTop: 5,
    maxWidth: 285,
    color: colors.textDim,
    ...typography.caption,
    lineHeight: 16,
    textAlign: 'center',
  },
  messageRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  messageRowAi: {
    justifyContent: 'flex-start',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 31,
    height: 31,
    marginRight: 7,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  messageLogo: {
    width: 25,
    height: 25,
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  aiBubble: {
    borderRadius: 17,
    borderBottomLeftRadius: 5,
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  userBubble: {
    borderRadius: 17,
    borderBottomRightRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accentDim,
  },
  messageAuthor: {
    marginBottom: 4,
    color: colors.accent,
    ...typography.label,
    fontSize: 9,
  },
  messageText: {
    color: colors.text,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
  },
  userMessageText: {
    color: colors.text,
  },
  typingBubble: {
    minWidth: 105,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    color: colors.textDim,
    ...typography.caption,
    fontFamily: fonts.bodyMedium,
  },
  chatFooterSpace: {
    height: spacing.xs,
  },
  composerArea: {
    paddingHorizontal: spacing.ms,
    paddingTop: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  composer: {
    minHeight: 54,
    maxHeight: 108,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: 7,
    borderRadius: radii.input,
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  composerIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.accentDim,
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 88,
    paddingHorizontal: 3,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 9 : 7,
    color: colors.text,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 38,
    height: 38,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  sendButtonDisabled: {
    backgroundColor: colors.cardBorder,
    opacity: 0.7,
  },
  sendButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  composerHint: {
    marginTop: 5,
    marginBottom: spacing.sm,
    color: colors.textFaint,
    ...typography.caption,
    fontSize: 9,
    textAlign: 'center',
  },
})
