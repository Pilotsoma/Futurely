import React from 'react'
import { StyleSheet, View } from 'react-native'
import { StatBlock } from '../../ui/StatBlock'
import { colors } from '../../../theme/tokens'
import { PortalCard } from './PortalCard'

interface StatStripItem {
  value: string
  label: string
  color?: string
  testID?: string
}

interface StatStripProps {
  /** 2 to 4 items read best; one works too. */
  items: StatStripItem[]
  testID?: string
}

// A row of figures in one card, separated by hairline dividers.
export function StatStrip({ items, testID }: StatStripProps): React.JSX.Element {
  return (
    <PortalCard testID={testID}>
      <View style={styles.row}>
        {items.map((item, index) => (
          <React.Fragment key={item.label}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <StatBlock
              size="sm"
              value={item.value}
              label={item.label}
              color={item.color}
              testID={item.testID}
              style={styles.cell}
            />
          </React.Fragment>
        ))}
      </View>
    </PortalCard>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, minWidth: 0 },
  divider: { width: 1, height: 32, backgroundColor: colors.borderSubtle },
})
