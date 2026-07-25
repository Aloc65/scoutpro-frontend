import React, { useEffect, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { WatchList } from '../../types';
import { IS_WEB, attachGlobalDrag } from './dragWeb';
import {
  STAGE_CONFIG,
  draftYearOf,
  hasActiveAflInterest,
  isStale,
  lastContactLabel,
} from './pipeline';

const ROW_HEIGHT = 60;

// Controller the drag handles call into. Kept in a ref so each handle attaches
// its web pointer listener exactly once (state updates during a drag must not
// tear down and re-create the listener, which would drop the pointer capture).
interface DragApi {
  start: (index: number, clientY: number) => void;
  move: (clientY: number) => void;
  end: () => void;
  tap: (index: number) => void;
}

// A single drag handle. On web it owns a Pointer Events drag bound once on
// mount; on native it feeds the shared PanResponder via pressedIndexRef.
function DragHandle({
  index,
  apiRef,
  nativeHandlers,
  setPressed,
}: {
  index: number;
  apiRef: React.MutableRefObject<DragApi>;
  nativeHandlers: any;
  setPressed: (i: number) => void;
}) {
  const ref = useRef<any>(null);

  // Web drag is handled by a single global window listener in TableView; the
  // pressed handle is identified via its data-draghandle attribute (= row index).
  const handlers = IS_WEB ? {} : nativeHandlers;
  return (
    <View
      ref={ref}
      style={styles.handleCol}
      onTouchStart={() => setPressed(index)}
      {...(IS_WEB ? { dataSet: { draghandle: String(index) } } : {})}
      {...handlers}
    >
      <Ionicons name="reorder-three" size={22} color={Colors.textMuted} />
    </View>
  );
}

interface Props {
  items: WatchList[];
  onRowPress: (item: WatchList) => void;
  // Called with the new full order of player IDs after a drag reorder.
  onReorder: (orderedPlayerIds: string[]) => void;
}

function RowContent({ item }: { item: WatchList }) {
  const cfg = STAGE_CONFIG[item.stage];
  const dy = draftYearOf(item);
  const stale = isStale(item.lastContactAt);
  return (
    <>
      <Text style={styles.rank}>{item.priorityRank ?? '—'}</Text>
      <View style={styles.nameCol}>
        <Text style={styles.name} numberOfLines={1}>{item.player?.fullName || '—'}</Text>
        <Text style={styles.nameSub} numberOfLines={1}>
          {[item.player?.team, dy ? `Draft ${dy}` : null].filter(Boolean).join('  ·  ') || '—'}
        </Text>
      </View>
      <View style={styles.aflCol}>
        {item.aflInterestClub ? (
          <View style={styles.aflChip}>
            <Ionicons name="flame" size={11} color={Colors.orange} />
            <Text style={styles.aflChipText} numberOfLines={1}>{item.aflInterestClub}</Text>
          </View>
        ) : (
          <Text style={styles.aflMuted}>—</Text>
        )}
      </View>
      <View style={styles.stageCol}>
        <View style={[styles.stagePill, { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}>
          <Text style={[styles.stagePillText, { color: cfg.color }]} numberOfLines={1}>{cfg.label}</Text>
        </View>
      </View>
      <Text style={[styles.lastCol, stale && { color: Colors.amber, fontWeight: '700' }]} numberOfLines={1}>
        {lastContactLabel(item.lastContactAt)}
      </Text>
    </>
  );
}

export default function TableView({ items, onRowPress, onReorder }: Props) {
  const [order, setOrder] = useState<WatchList[]>(items);
  const listRef = useRef<View>(null);
  const listTopRef = useRef(0);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [floatY, setFloatY] = useState(0);
  const grabYRef = useRef(0);
  const dragIndexRef = useRef<number | null>(null);
  const targetIndexRef = useRef<number | null>(null);
  const pressedIndexRef = useRef<number>(0);
  // Always-current copies for the stable responder's closures.
  const orderRef = useRef<WatchList[]>(items);
  const onReorderRef = useRef(onReorder);

  useEffect(() => { onReorderRef.current = onReorder; }, [onReorder]);
  useEffect(() => { orderRef.current = order; }, [order]);
  useEffect(() => { targetIndexRef.current = targetIndex; }, [targetIndex]);

  useEffect(() => {
    // Keep local order in sync when items change (filters, refresh) but not mid-drag.
    if (dragIndexRef.current === null) setOrder(items);
  }, [items]);

  // ── Shared drag mechanics (used by both web pointer drag and native PanResponder) ──
  const beginDrag = (index: number, listTop: number, clientY: number) => {
    listTopRef.current = listTop;
    dragIndexRef.current = index;
    grabYRef.current = clientY - (listTop + index * ROW_HEIGHT);
    setDragIndex(index);
    setTargetIndex(index);
    setFloatY(index * ROW_HEIGHT);
  };

  const moveDrag = (clientY: number) => {
    const relY = clientY - listTopRef.current - grabYRef.current;
    setFloatY(relY);
    const n = orderRef.current.length;
    let ti = Math.round(relY / ROW_HEIGHT);
    if (ti < 0) ti = 0;
    if (ti > n - 1) ti = n - 1;
    setTargetIndex(ti);
  };

  const commitDrag = () => {
    const from = dragIndexRef.current;
    const to = targetIndexRef.current;
    dragIndexRef.current = null;
    setDragIndex(null);
    setTargetIndex(null);
    if (from !== null && to !== null && from !== to) {
      setOrder((prev) => {
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        onReorderRef.current(next.map((i) => i.playerId));
        return next;
      });
    }
  };

  // Web drag API — reads the list's viewport top synchronously via the DOM node.
  const apiRef = useRef<DragApi>({
    start: () => {},
    move: () => {},
    end: () => {},
    tap: () => {},
  });
  apiRef.current = {
    start: (index, clientY) => {
      const node: any = listRef.current;
      const listTop =
        node && typeof node.getBoundingClientRect === 'function'
          ? node.getBoundingClientRect().top
          : listTopRef.current;
      beginDrag(index, listTop, clientY);
    },
    move: (clientY) => moveDrag(clientY),
    end: () => commitDrag(),
    tap: (index) => onRowPress(orderRef.current[index]),
  };

  // ── Web: single global pointer-drag controller ──────────────────────────
  // react-native-web swallows native pointer events at its root, so per-handle
  // listeners never fire. We attach ONE window listener and hit-test the pressed
  // handle via its data-draghandle attribute (= row index).
  useEffect(() => {
    if (!IS_WEB) return;
    return attachGlobalDrag(
      'draghandle',
      {
        onStart: (id, _x, y) => apiRef.current.start(parseInt(id, 10), y),
        onMove: (_x, y) => apiRef.current.move(y),
        onEnd: () => apiRef.current.end(),
        onTap: (id) => apiRef.current.tap(parseInt(id, 10)),
      },
      6,
    );
  }, []);

  // A single, stable PanResponder shared by every drag handle (native only).
  // The active row is captured via `pressedIndexRef` (set on touch-start of
  // each handle) so we never recreate the responder mid-gesture.
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !IS_WEB,
      onPanResponderGrant: (e) => {
        const index = pressedIndexRef.current;
        listRef.current?.measureInWindow((_x, y) => {
          beginDrag(index, y, e.nativeEvent.pageY);
        });
      },
      onPanResponderMove: (e) => moveDrag(e.nativeEvent.pageY),
      onPanResponderRelease: () => commitDrag(),
      onPanResponderTerminate: () => {
        dragIndexRef.current = null;
        setDragIndex(null);
        setTargetIndex(null);
      },
    }),
  ).current;

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.handleCol} />
        <Text style={[styles.headerText, styles.rank]}>#</Text>
        <Text style={[styles.headerText, styles.nameCol]}>Player</Text>
        <Text style={[styles.headerText, styles.aflCol]}>AFL</Text>
        <Text style={[styles.headerText, styles.stageCol]}>Stage</Text>
        <Text style={[styles.headerText, styles.lastCol]}>Contact</Text>
      </View>

      <View ref={listRef} collapsable={false} style={{ height: order.length * ROW_HEIGHT }}>
        {order.map((item, index) => {
          const isDragging = dragIndex === index;
          const active = hasActiveAflInterest(item);
          const showInsertLine = dragIndex !== null && targetIndex === index && !isDragging;
          return (
            <View key={item.id} style={[styles.rowAbsolute, { top: index * ROW_HEIGHT }, isDragging && styles.rowDim]}>
              {showInsertLine && <View style={styles.insertLine} />}
              <View style={[styles.row, active && styles.rowActive]}>
                <DragHandle
                  index={index}
                  apiRef={apiRef}
                  nativeHandlers={responder.panHandlers}
                  setPressed={(i) => { pressedIndexRef.current = i; }}
                />
                <TouchableOpacity style={styles.rowTouchable} activeOpacity={0.7} onPress={() => onRowPress(item)}>
                  <RowContent item={item} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Floating dragged row */}
        {dragIndex !== null && (
          <View style={[styles.rowAbsolute, styles.floatingRow, { top: floatY }]} pointerEvents="none">
            <View style={[styles.row, styles.rowLifted]}>
              <View style={styles.handleCol}>
                <Ionicons name="reorder-three" size={22} color={Colors.text} />
              </View>
              <View style={styles.rowTouchable}>
                <RowContent item={order[dragIndex]} />
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingBottom: 24 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  rowAbsolute: { position: 'absolute', left: 0, right: 0, height: ROW_HEIGHT, justifyContent: 'center' },
  floatingRow: { zIndex: 20, elevation: 8 },
  rowDim: { opacity: 0.25 },
  row: {
    flexDirection: 'row', alignItems: 'center', height: ROW_HEIGHT - 8,
    backgroundColor: Colors.card, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingRight: 10,
  },
  rowActive: { backgroundColor: 'rgba(249,115,22,0.08)', borderColor: 'rgba(249,115,22,0.35)' },
  rowLifted: {
    borderColor: Colors.accent, shadowColor: '#000', shadowOpacity: 0.4,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  rowTouchable: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  handleCol: { width: 40, alignItems: 'center', justifyContent: 'center' },
  rank: { width: 32, color: Colors.text, fontWeight: '800', fontSize: 14, textAlign: 'center' },
  nameCol: { flex: 1, paddingHorizontal: 8 },
  name: { color: Colors.text, fontWeight: '700', fontSize: 14 },
  nameSub: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  aflCol: { width: 96, paddingHorizontal: 4 },
  aflChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3,
  },
  aflChipText: { color: Colors.orange, fontSize: 11, fontWeight: '600' },
  aflMuted: { color: Colors.textMuted, fontSize: 12, paddingLeft: 4 },
  stageCol: { width: 96, paddingHorizontal: 4 },
  stagePill: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3, alignItems: 'center' },
  stagePillText: { fontSize: 10, fontWeight: '700' },
  lastCol: { width: 74, color: Colors.textMuted, fontSize: 11, textAlign: 'right' },
  insertLine: {
    position: 'absolute', top: 2, left: 0, right: 0, height: 3,
    backgroundColor: Colors.accent, borderRadius: 2,
  },
});
