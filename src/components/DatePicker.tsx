import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal } from 'react-native';
import { Colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

/** Format date as DD/MM/YYYY (Australian format) */
function formatAU(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/** Parse YYYY-MM-DD to Date */
function parseISO(dateStr: string): Date {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return new Date();
}

interface DatePickerProps {
  label: string;
  /** Date value in YYYY-MM-DD format */
  value: string;
  /** Called with YYYY-MM-DD string */
  onChange: (dateStr: string) => void;
}

export default function DatePicker({ label, value, onChange }: DatePickerProps) {
  const selectedDate = value ? parseISO(value) : new Date();
  const [showPicker, setShowPicker] = useState(false);
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const displayValue = value ? formatAU(parseISO(value)) : 'Select date...';

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${viewYear}-${m}-${d}`);
    setShowPicker(false);
  };

  const handleToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    setViewYear(y);
    setViewMonth(now.getMonth());
    onChange(`${y}-${m}-${d}`);
    setShowPicker(false);
  };

  const openPicker = () => {
    // Sync view to current selected date
    const d = value ? parseISO(value) : new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setShowPicker(true);
  };

  const isSelectedDay = (day: number) => {
    if (!value) return false;
    const sel = parseISO(value);
    return sel.getFullYear() === viewYear && sel.getMonth() === viewMonth && sel.getDate() === day;
  };

  const isToday = (day: number) => {
    const now = new Date();
    return now.getFullYear() === viewYear && now.getMonth() === viewMonth && now.getDate() === day;
  };

  // Build calendar grid
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const calendarContent = (
    <View style={styles.calendarContainer}>
      {/* Header */}
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.monthYearText}>{MONTHS[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Weekday headers */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((wd) => (
          <Text key={wd} style={styles.weekDayText}>{wd}</Text>
        ))}
      </View>

      {/* Days grid */}
      <View style={styles.daysGrid}>
        {cells.map((day, idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.dayCell,
              day && isSelectedDay(day) && styles.dayCellSelected,
              day && isToday(day) && !isSelectedDay(day) && styles.dayCellToday,
            ]}
            onPress={() => day && handleSelectDay(day)}
            disabled={!day}
            activeOpacity={0.6}
          >
            {day ? (
              <Text style={[
                styles.dayText,
                isSelectedDay(day) && styles.dayTextSelected,
                isToday(day) && !isSelectedDay(day) && styles.dayTextToday,
              ]}>{day}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      {/* Today button */}
      <TouchableOpacity onPress={handleToday} style={styles.todayButton}>
        <Text style={styles.todayButtonText}>Today</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.inputButton} onPress={openPicker} activeOpacity={0.7}>
        <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
        <Text style={[styles.inputText, !value && { color: Colors.textMuted }]}>{displayValue}</Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            {calendarContent}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  label: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    minHeight: 48,
  },
  inputText: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  calendarContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    width: 330,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: Colors.elevated,
  },
  monthYearText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  dayCellSelected: {
    backgroundColor: Colors.accent,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  dayText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  dayTextToday: {
    color: Colors.accent,
    fontWeight: '700',
  },
  todayButton: {
    marginTop: 12,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  todayButtonText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
});
