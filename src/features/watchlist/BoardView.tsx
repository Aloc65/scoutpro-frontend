import React, { useRef, useState } from 'react';
import {
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { PIPELINE_STAGES, PipelineStage, WatchList } from '../../types';
import {
  STAGE_CONFIG,
  draftYearOf,
  hasActiveAflInterest,
  isStale,
  lastContactLabel,
} from './pipeline';

const COLUMN_WIDTH = 240;
const DRAG_THRESHOLD = 8;

interface Props {
  items: WatchList[];
  onCardPress: (item: WatchList) => void;
  onStageChange: (playerId: string, newStage: PipelineStage) => void;
}

// ─── Card content (shared by in-column card and the floating drag clone) ──
function CardBody({ item }: { item: WatchList }) {
  const active = hasActiveAflInterest(item);
  const stale = isStale(item.lastContactAt);
  const dy = draftYearOf(item);
  return (
    <View style={[styles.card, active && styles.cardAccent]}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardName} numberOfLines={1}>{item.player?.fullName || '—'}</Text>
        {active && <Ionicons name="flame" size={15} color={Colors.orange} />}
      </View>
      <Text style={styles.cardSub} numberOfLines={1}>
        {[item.player?.team, item.player?.state, dy ? `'${String(dy).slice(-2)}` : null]
          .filter(Boolean)
          .join('  ·  ') || '—'}
      </Text>
      {item.aflInterestClub ? (
        <Text style={styles.cardAfl} numberOfLines={1}>{item.aflInterestClub}</Text>
      ) : (
        <Text style={styles.cardAflMuted} numberOfLines={1}>No AFL interest</Text>
      )}
      <View style={styles.cardBottomRow}>
        <Ionicons name="time-outline" size={11} color={stale ? Colors.amber : Colors.textMuted} />
        <Text style={[styles.cardRecency, stale && { color: Colors.amber }]}>
          {lastContactLabel(item.lastContactAt)}
        </Text>
      </View>
    </View>
  );
}

// ─── Draggable card (owns its PanResponder) ──────────────────────────────
function BoardCard({
  item,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTap,
  hidden,
}: {
  item: WatchList;
  onDragStart: (item: WatchList, pageX: number, pageY: number, grabX: number, grabY: number) => void;
  onDragMove: (pageX: number, pageY: number) => void;
  onDragEnd: (pageX: number, pageY: number) => void;
  onTap: (item: WatchList) => void;
  hidden: boolean;
}) {
  const cardRef = useRef<View>(null);
  const movedRef = useRef(false);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > DRAG_THRESHOLD || Math.abs(g.dy) > DRAG_THRESHOLD,
      onPanResponderGrant: () => {
        movedRef.current = false;
      },
      onPanResponderMove: (e, g) => {
        if (!movedRef.current && (Math.abs(g.dx) > DRAG_THRESHOLD || Math.abs(g.dy) > DRAG_THRESHOLD)) {
          movedRef.current = true;
          const { pageX, pageY } = e.nativeEvent;
          // Measure this card to compute the grab offset within it.
          cardRef.current?.measureInWindow((x, y) => {
            onDragStart(item, pageX, pageY, pageX - x, pageY - y);
          });
        }
        if (movedRef.current) {
          onDragMove(e.nativeEvent.pageX, e.nativeEvent.pageY);
        }
      },
      onPanResponderRelease: (e) => {
        if (movedRef.current) {
          onDragEnd(e.nativeEvent.pageX, e.nativeEvent.pageY);
        } else {
          onTap(item);
        }
        movedRef.current = false;
      },
      onPanResponderTerminate: (e) => {
        if (movedRef.current) onDragEnd(e.nativeEvent.pageX, e.nativeEvent.pageY);
        movedRef.current = false;
      },
    }),
  ).current;

  return (
    <View ref={cardRef} {...responder.panHandlers} style={[hidden && styles.cardHidden]}>
      <CardBody item={item} />
    </View>
  );
}

export default function BoardView({ items, onCardPress, onStageChange }: Props) {
  const columnRefs = useRef<Record<string, View | null>>({});
  const columnRectsRef = useRef<{ stage: PipelineStage; x: number; width: number }[]>([]);

  const [dragging, setDragging] = useState<WatchList | null>(null);
  const [floatPos, setFloatPos] = useState({ x: 0, y: 0 });
  const grabRef = useRef({ x: 0, y: 0 });
  const [targetStage, setTargetStage] = useState<PipelineStage | null>(null);

  const grouped = React.useMemo(() => {
    const map: Record<PipelineStage, WatchList[]> = {
      NOT_CONTACTED: [], INITIAL_CALL: [], FAMILY_MEETING: [], OFFER_MADE: [], SIGNED: [],
    };
    for (const it of items) (map[it.stage] || map.NOT_CONTACTED).push(it);
    return map;
  }, [items]);

  const measureColumns = () => {
    const rects: { stage: PipelineStage; x: number; width: number }[] = [];
    let pending = PIPELINE_STAGES.length;
    PIPELINE_STAGES.forEach((stage) => {
      const ref = columnRefs.current[stage];
      if (ref) {
        ref.measureInWindow((x, _y, width) => {
          rects.push({ stage, x, width });
          pending -= 1;
          if (pending === 0) columnRectsRef.current = rects;
        });
      } else {
        pending -= 1;
      }
    });
  };

  const stageAtX = (pageX: number): PipelineStage | null => {
    for (const r of columnRectsRef.current) {
      if (pageX >= r.x && pageX <= r.x + r.width) return r.stage;
    }
    return null;
  };

  const handleDragStart = (item: WatchList, pageX: number, pageY: number, grabX: number, grabY: number) => {
    grabRef.current = { x: grabX, y: grabY };
    measureColumns();
    setDragging(item);
    setFloatPos({ x: pageX - grabX, y: pageY - grabY });
    setTargetStage(item.stage);
  };

  const handleDragMove = (pageX: number, pageY: number) => {
    setFloatPos({ x: pageX - grabRef.current.x, y: pageY - grabRef.current.y });
    setTargetStage(stageAtX(pageX));
  };

  const handleDragEnd = (pageX: number) => {
    const dropStage = stageAtX(pageX);
    const dragged = dragging;
    setDragging(null);
    setTargetStage(null);
    if (dragged && dropStage && dropStage !== dragged.stage) {
      onStageChange(dragged.playerId, dropStage);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        scrollEnabled={!dragging}
        contentContainerStyle={styles.boardRow}
      >
        {PIPELINE_STAGES.map((stage) => {
          const cfg = STAGE_CONFIG[stage];
          const colItems = grouped[stage];
          const isTarget = targetStage === stage && dragging;
          return (
            <View
              key={stage}
              ref={(r) => { columnRefs.current[stage] = r; }}
              collapsable={false}
              style={[styles.column, isTarget && styles.columnTarget]}
            >
              <View style={styles.columnHeader}>
                <View style={[styles.stageDot, { backgroundColor: cfg.color }]} />
                <Text style={styles.columnTitle} numberOfLines={1}>{cfg.label}</Text>
                <Text style={styles.columnCount}>{colItems.length}</Text>
              </View>
              <ScrollView
                style={styles.columnScroll}
                showsVerticalScrollIndicator={false}
                scrollEnabled={!dragging}
                contentContainerStyle={{ paddingBottom: 12, gap: 8 }}
              >
                {colItems.length === 0 ? (
                  <Text style={styles.columnEmpty}>—</Text>
                ) : (
                  colItems.map((item) => (
                    <BoardCard
                      key={item.id}
                      item={item}
                      hidden={dragging?.id === item.id}
                      onDragStart={handleDragStart}
                      onDragMove={handleDragMove}
                      onDragEnd={handleDragEnd}
                      onTap={onCardPress}
                    />
                  ))
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      {/* Floating drag clone (full-screen overlay so page coords map directly) */}
      {dragging && (
        <View style={styles.dragOverlay} pointerEvents="none">
          <View style={[styles.floating, { left: floatPos.x, top: floatPos.y }]}>
            <CardBody item={dragging} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  boardRow: { paddingHorizontal: 12, paddingBottom: 8, gap: 10 },
  column: {
    width: COLUMN_WIDTH,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  columnTarget: { borderColor: Colors.accent, backgroundColor: 'rgba(6,182,212,0.06)' },
  columnHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginBottom: 10 },
  stageDot: { width: 10, height: 10, borderRadius: 5 },
  columnTitle: { color: Colors.text, fontWeight: '800', fontSize: 13, flex: 1 },
  columnCount: {
    color: Colors.textSecondary, fontWeight: '700', fontSize: 12,
    backgroundColor: Colors.elevated, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden',
  },
  columnScroll: { maxHeight: '100%' },
  columnEmpty: { color: Colors.textMuted, textAlign: 'center', paddingVertical: 16 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  cardAccent: { borderLeftWidth: 3, borderLeftColor: Colors.orange },
  cardHidden: { opacity: 0.3 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { color: Colors.text, fontWeight: '700', fontSize: 14, flex: 1 },
  cardSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 3 },
  cardAfl: { color: Colors.orange, fontSize: 12, fontWeight: '600', marginTop: 6 },
  cardAflMuted: { color: Colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 6 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  cardRecency: { color: Colors.textMuted, fontSize: 11 },

  dragOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  floating: { position: 'absolute', width: COLUMN_WIDTH - 16, opacity: 0.95, transform: [{ rotate: '2deg' }] },
});
