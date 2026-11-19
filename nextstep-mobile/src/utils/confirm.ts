import { Alert, Platform } from 'react-native'

/**
 * Asks the user to confirm a destructive action before running `onConfirm`.
 * Web uses the browser's confirm dialog (Alert.alert is a no-op on
 * react-native-web); native uses an Alert with a destructive-styled button.
 * Cancelling does nothing.
 */
export function confirmDestructiveAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm()
    return
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ])
}
