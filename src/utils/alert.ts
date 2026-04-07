import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alert that works on both web and native.
 * On web, React Native's Alert.alert() with callbacks doesn't work reliably,
 * so we fall back to window.alert() and call the callback directly.
 */
export function showAlert(title: string, message: string, onOk?: () => void) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    onOk?.();
  } else {
    Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
  }
}

/**
 * Cross-platform confirm dialog.
 * On web, uses window.confirm(). On native, uses Alert.alert() with Cancel/Confirm buttons.
 */
export function showConfirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  }
}
