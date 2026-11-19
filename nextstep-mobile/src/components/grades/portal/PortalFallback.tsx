import React from 'react'
import { Card } from '../../ui/Card'
import { RawDataView } from '../../ui/RawDataView'

interface PortalFallbackProps {
  data: unknown
}

// What every portal screen shows when the payload is not in a shape its parser
// recognises: the generic key/value view, so nothing the portal sent is hidden.
export function PortalFallback({ data }: PortalFallbackProps): React.JSX.Element {
  return (
    <Card>
      <RawDataView data={data} />
    </Card>
  )
}
