import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

/**
 * Tracks whether the user currently has a live scouting game in progress.
 *
 * When a live game is active the inactivity auto-logout timer is suspended,
 * so scouts are never kicked out mid-match while watching the game (there may
 * be long stretches with no taps between passages of play).
 *
 * The live-tracking screens (tracking / grid-tracking) flip this flag on when
 * focused and off when they lose focus / unmount.
 */
interface LiveGameState {
  /** True while a live scouting game is being actively tracked. */
  liveGameActive: boolean;
  /** Mark a live game as active/inactive. */
  setLiveGameActive: (active: boolean) => void;
}

const LiveGameContext = createContext<LiveGameState>({
  liveGameActive: false,
  setLiveGameActive: () => {},
});

export const useLiveGame = () => useContext(LiveGameContext);

export function LiveGameProvider({ children }: { children: React.ReactNode }) {
  // We use a counter internally so overlapping focus/blur callbacks from
  // different screens can't leave the flag stuck. Each "activate" increments,
  // each "deactivate" decrements; active when the count is > 0.
  const activeCountRef = useRef(0);
  const [liveGameActive, setActive] = useState(false);

  const setLiveGameActive = useCallback((active: boolean) => {
    if (active) {
      activeCountRef.current += 1;
    } else {
      activeCountRef.current = Math.max(0, activeCountRef.current - 1);
    }
    setActive(activeCountRef.current > 0);
  }, []);

  return (
    <LiveGameContext.Provider value={{ liveGameActive, setLiveGameActive }}>
      {children}
    </LiveGameContext.Provider>
  );
}
