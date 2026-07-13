import React, { useEffect, useRef, useCallback } from 'react';
import { Platform, View, AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import { useLiveGame } from './LiveGameContext';

/**
 * Auto-logout after a period of inactivity.
 *
 * If the signed-in user does not interact with the app for
 * {@link INACTIVITY_TIMEOUT_MS} (5 minutes) they are automatically logged out
 * and must sign in again. The timer is SUSPENDED while a live scouting game is
 * in progress (see LiveGameContext), so scouts are never kicked out mid-match.
 *
 * How activity is detected:
 *  - Web: passive listeners on window for pointer / key / scroll / touch.
 *  - Native (iOS/Android): a responder-capture wrapper that observes every
 *    touch start without stealing the gesture from the underlying UI.
 *
 * The check is timestamp-based (not a single setTimeout) so it stays correct
 * even if timers are throttled while the app is backgrounded — when the app
 * returns to the foreground we immediately re-evaluate elapsed idle time.
 */
export const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
// How often we check whether the idle threshold has been crossed.
const CHECK_INTERVAL_MS = 15 * 1000; // 15 seconds

export function InactivityManager({ children }: { children: React.ReactNode }) {
  const { user, logoutDueToInactivity } = useAuth();
  const { liveGameActive } = useLiveGame();

  // Timestamp of the last observed user activity.
  const lastActivityRef = useRef<number>(Date.now());
  // Keep the latest live-game flag readable from inside stable callbacks.
  const liveGameActiveRef = useRef<boolean>(liveGameActive);
  // Guard so we only fire the logout once per idle event.
  const loggingOutRef = useRef<boolean>(false);

  useEffect(() => {
    liveGameActiveRef.current = liveGameActive;
    // Whenever a game starts/ends, treat that as fresh activity so the timer
    // never fires immediately after a live game finishes.
    lastActivityRef.current = Date.now();
  }, [liveGameActive]);

  const registerActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // ─── Idle checking loop ────────────────────────────────────────────
  useEffect(() => {
    // Only run while a user is logged in.
    if (!user) return;

    loggingOutRef.current = false;
    lastActivityRef.current = Date.now();

    const maybeLogout = () => {
      if (loggingOutRef.current) return;
      // Never log out during a live scouting game.
      if (liveGameActiveRef.current) return;
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= INACTIVITY_TIMEOUT_MS) {
        loggingOutRef.current = true;
        console.warn(
          `[InactivityManager] No activity for ${Math.round(idleFor / 1000)}s — logging out.`,
        );
        logoutDueToInactivity();
      }
    };

    const interval = setInterval(maybeLogout, CHECK_INTERVAL_MS);

    // Re-check as soon as the app returns to the foreground (timers may have
    // been throttled/paused while backgrounded).
    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') maybeLogout();
    };
    const appStateSub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [user, logoutDueToInactivity]);

  // ─── Web activity listeners ────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!user) return;
    if (typeof window === 'undefined') return;

    const events = [
      'mousemove',
      'mousedown',
      'keydown',
      'wheel',
      'touchstart',
      'touchmove',
      'scroll',
      'click',
    ];
    const handler = () => registerActivity();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
    };
  }, [user, registerActivity]);

  // ─── Native touch detection ────────────────────────────────────────
  // On web we don't need the wrapper (window listeners cover it), so render
  // children directly to avoid any layout side-effects.
  if (Platform.OS === 'web') {
    return <>{children}</>;
  }

  return (
    <View
      style={{ flex: 1 }}
      // Capture the start of every touch without consuming it, so the
      // underlying components still receive the gesture.
      onStartShouldSetResponderCapture={() => {
        registerActivity();
        return false;
      }}
      onMoveShouldSetResponderCapture={() => {
        registerActivity();
        return false;
      }}
    >
      {children}
    </View>
  );
}
