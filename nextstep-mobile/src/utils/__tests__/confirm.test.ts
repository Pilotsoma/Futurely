import { Alert, Platform } from 'react-native'
import { confirmDestructiveAction } from '../confirm'

describe('confirmDestructiveAction', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('asks through a native alert and only confirms from the destructive button', () => {
    jest.replaceProperty(Platform, 'OS', 'ios')
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    const onConfirm = jest.fn()

    confirmDestructiveAction('Delete task?', '"Essay" will be removed.', 'Delete', onConfirm)

    expect(alertSpy).toHaveBeenCalledTimes(1)
    const [title, message, buttons] = alertSpy.mock.calls[0]
    expect(title).toBe('Delete task?')
    expect(message).toBe('"Essay" will be removed.')
    expect(buttons).toHaveLength(2)
    expect(buttons?.[0]).toMatchObject({ text: 'Cancel', style: 'cancel' })
    expect(buttons?.[1]).toMatchObject({ text: 'Delete', style: 'destructive' })
    expect(onConfirm).not.toHaveBeenCalled()

    buttons?.[0].onPress?.()
    expect(onConfirm).not.toHaveBeenCalled()

    buttons?.[1].onPress?.()
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  describe('on web', () => {
    const originalConfirm = window.confirm

    afterEach(() => {
      window.confirm = originalConfirm
    })

    it('runs the action only when the browser dialog is accepted', () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
      const onConfirm = jest.fn()

      window.confirm = jest.fn(() => false)
      confirmDestructiveAction('Delete task?', 'Gone for good.', 'Delete', onConfirm)
      expect(window.confirm).toHaveBeenCalledWith('Delete task?\n\nGone for good.')
      expect(onConfirm).not.toHaveBeenCalled()

      window.confirm = jest.fn(() => true)
      confirmDestructiveAction('Delete task?', 'Gone for good.', 'Delete', onConfirm)
      expect(onConfirm).toHaveBeenCalledTimes(1)
      expect(alertSpy).not.toHaveBeenCalled()
    })
  })
})
