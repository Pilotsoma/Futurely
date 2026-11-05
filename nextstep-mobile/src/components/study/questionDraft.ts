import type { Question, QuestionInput, QuestionType } from '../../api/setsApi'

/** Editable form state for one question. `id` is set for questions that already exist on the server. */
export interface QuestionDraft {
  key: string
  id?: number
  questionText: string
  questionType: QuestionType
  options: string[]
  /** Option index as a string, matching the backend/web shape. */
  correctAnswer: string
  timeLimit: string
}

let counter = 0
const nextKey = (): string => `q${Date.now()}_${counter++}`

export function blankDraft(): QuestionDraft {
  return {
    key: nextKey(),
    questionText: '',
    questionType: 'MULTIPLE_CHOICE',
    options: ['', '', '', ''],
    correctAnswer: '0',
    timeLimit: '20',
  }
}

export function draftFromQuestion(q: Question): QuestionDraft {
  return {
    key: `id${q.id}`,
    id: q.id,
    questionText: q.questionText,
    questionType: q.questionType,
    options: q.questionType === 'TRUE_FALSE' ? ['True', 'False'] : [...q.options],
    correctAnswer: q.correctAnswer,
    timeLimit: String(q.timeLimit),
  }
}

export function changeType(d: QuestionDraft, type: QuestionType): QuestionDraft {
  if (d.questionType === type) return d
  return {
    ...d,
    questionType: type,
    options: type === 'TRUE_FALSE' ? ['True', 'False'] : ['', '', '', ''],
    correctAnswer: '0',
  }
}

export function validateDraft(d: QuestionDraft): string | null {
  if (!d.questionText.trim()) return 'Every question needs text.'
  if (d.questionText.trim().length > 500) return 'Question text is limited to 500 characters.'
  if (d.questionType === 'MULTIPLE_CHOICE' && d.options.some((o) => !o.trim())) {
    return 'Fill in all four answer options.'
  }
  const t = Number(d.timeLimit)
  if (!Number.isInteger(t) || t < 5 || t > 120) return 'Time limit must be 5-120 seconds.'
  return null
}

export function draftToInput(d: QuestionDraft): QuestionInput {
  return {
    questionText: d.questionText.trim(),
    questionType: d.questionType,
    options: d.questionType === 'TRUE_FALSE' ? ['True', 'False'] : d.options.map((o) => o.trim()),
    correctAnswer: d.correctAnswer,
    timeLimit: Number(d.timeLimit),
  }
}
