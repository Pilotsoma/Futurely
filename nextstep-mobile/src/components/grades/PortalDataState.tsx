import React from 'react'
import { Feather } from '@expo/vector-icons'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRetryBlock } from '../ui/ErrorRetryBlock'
import { LoadingSkeleton } from '../ui/LoadingSkeleton'
import { UnsupportedPortalBlock } from '../ui/UnsupportedPortalBlock'

type FeatherName = React.ComponentProps<typeof Feather>['name']

interface PortalDataStateProps {
  loading: boolean
  /** True when the portal does not offer this feature (HAC-only endpoint, PowerSchool user). */
  unsupported: boolean
  error: string | null
  onRetry: () => void
  /** Feature name shown in the unsupported block, e.g. "Schedule". */
  feature: string
  isEmpty: boolean
  emptyIcon: FeatherName
  emptyTitle: string
  emptyMessage: string
  skeletonRows?: number
  /** Rendered only when the load succeeded and there is something to show. */
  children: React.ReactNode
}

// One state ladder for every portal-backed grades screen. Exactly one of
// loading / unsupported / error / empty / content is rendered, so a screen can
// never show an error next to an empty state.
export function PortalDataState({
  loading,
  unsupported,
  error,
  onRetry,
  feature,
  isEmpty,
  emptyIcon,
  emptyTitle,
  emptyMessage,
  skeletonRows = 4,
  children,
}: PortalDataStateProps): React.JSX.Element {
  if (loading) return <LoadingSkeleton rows={skeletonRows} />
  if (unsupported) return <UnsupportedPortalBlock feature={feature} />
  if (error) return <ErrorRetryBlock message={error} onRetry={onRetry} />
  if (isEmpty) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        message={emptyMessage}
        ctaLabel="Refresh"
        onPressCta={onRetry}
      />
    )
  }
  return <>{children}</>
}
