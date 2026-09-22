import { getPathFromState, getStateFromPath } from '@react-navigation/native'

import { linking } from '../linking'

describe('application linking', () => {
  // Dashboard/AIChat/Grades/Planner/Roadmap all live one level deeper than
  // before, nested under the MainTabs bottom-tab navigator inside the outer
  // MainStack. Settings/Colleges/GpaSimulator moved the other way — out of
  // the tab navigator to become top-level MainStack siblings, so their path
  // still resolves directly at routes[0].
  it('maps every top-level destination to a stable web path', () => {
    const config = linking.config
    expect(getStateFromPath('/dashboard', config)?.routes[0]?.name).toBe('MainTabs')
    expect(getStateFromPath('/dashboard', config)?.routes[0]?.state?.routes[0]?.name).toBe('Dashboard')
    expect(getStateFromPath('/ai', config)?.routes[0]?.state?.routes[0]?.name).toBe('AIChat')
    expect(getStateFromPath('/settings', config)?.routes[0]?.name).toBe('Settings')
  })

  it('maps nested grade routes and can serialize them again', () => {
    const config = linking.config
    const state = getStateFromPath('/grades/classwork', config)
    expect(state?.routes[0]?.name).toBe('MainTabs')
    const tabsState = state?.routes[0]?.state
    expect(tabsState?.routes[0]?.name).toBe('Grades')
    expect(tabsState?.routes[0]?.state?.routes[0]?.name).toBe('Classwork')
    expect(state ? getPathFromState(state, config) : null).toBe('/grades/classwork')
  })

  it('parses and serializes an assignment destination', () => {
    const config = linking.config
    const state = getStateFromPath('/planner/42', config)
    const tabsState = state?.routes[0]?.state
    expect(tabsState?.routes[0]?.name).toBe('Planner')
    expect(tabsState?.routes[0]?.params).toEqual({ assignmentId: 42 })
    expect(state ? getPathFromState(state, config) : null).toBe('/planner/42')
  })

  it('resolves the promoted Roadmap tab and re-homed Colleges/GpaSimulator screens', () => {
    const config = linking.config
    expect(getStateFromPath('/roadmap', config)?.routes[0]?.state?.routes[0]?.name).toBe('Roadmap')
    expect(getStateFromPath('/colleges', config)?.routes[0]?.name).toBe('Colleges')
    expect(getStateFromPath('/what-if', config)?.routes[0]?.name).toBe('GpaSimulator')
  })
})
