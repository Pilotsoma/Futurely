/**
 * ErrorRetryBlock
 *
 * Load-failure state: the shared EmptyState layout in its error tone with a
 * "Try again" button. Pass user-safe copy only (see utils/errorMessage).
 *
 * Props:
 *   message    string        - what went wrong, in plain words
 *   onRetry    () => void    - re-runs the failed load
 *   retrying?  boolean       - shows a spinner in the button and disables it
 *   title?     string        - default "Couldn't load this"
 */

import React from 'react'
import { EmptyState } from './EmptyState'

interface ErrorRetryBlockProps {
  message: string
  onRetry: () => void
  retrying?: boolean
  title?: string
}

export function ErrorRetryBlock({
  message,
  onRetry,
  retrying,
  title = "Couldn't load this",
}: ErrorRetryBlockProps): React.JSX.Element {
  return (
    <EmptyState
      tone="error"
      icon="alert-circle"
      title={title}
      message={message}
      ctaLabel="Try again"
      onPressCta={onRetry}
      ctaLoading={retrying}
    />
  )
}
