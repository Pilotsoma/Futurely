import React from 'react'
import { Screen } from '../../components/ui/Screen'
import { RoadmapPanel } from '../../components/future/RoadmapPanel'

export default function RoadmapScreen(): React.JSX.Element {
  return (
    <Screen edges={['left', 'right', 'bottom']} padded={false}>
      <RoadmapPanel />
    </Screen>
  )
}
