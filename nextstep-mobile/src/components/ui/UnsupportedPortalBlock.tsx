import React from 'react'
import { EmptyState } from './EmptyState'

interface UnsupportedPortalBlockProps {
  /** e.g. "Schedule", "Report Card", "Progress Report" */
  feature: string
}

// Renders when the backend returns error.code === 'UNSUPPORTED' - the HAC-only
// grades endpoints (schedule/classwork/report-card/progress-report/attendance/
// contact-teachers) return this for PowerSchool-connected users. There is no
// CTA because nothing the student can do changes it.
export function UnsupportedPortalBlock({ feature }: UnsupportedPortalBlockProps): React.JSX.Element {
  return (
    <EmptyState
      icon="info"
      title="Not available for your school"
      message={`${feature} isn't offered by your school's portal.`}
    />
  )
}
