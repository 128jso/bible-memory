import { useEffect, useState } from 'react';
import type { Verse } from '../types';
import * as firestore from '../lib/firestore';
import { isDueForReview, getMasteryLevel, getMasteryColor, type MasteryLevel } from '../lib/sm2';
import './StatsView.css';

interface Props {
  onBack: () => void;
}

interface Stats {
  totalVerses: number;
  masteredVerses: number;
  currentStreak: number;
  averageAccuracy: number;
  dueToday: number;
  last7Days: { date: string; label: string; accuracy: number | null }[];
  masteryBreakdown: Record<MasteryLevel, number>;
}

const MASTERED_INTERVAL_DAYS = 21;

export function StatsView({ onBack }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    const cols = await firestore.getCollections();
    const allVerses: Verse[] = [];
    for (const col of cols) {
      const verses = await firestore.getVerses(col.id);
      allVerses.push(...verses);
    }
    setStats(computeStats(allVerses));
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="stats">
        <div className="stats-header">
          <button className="back-btn" onClick={onBack}>&larr; Back</button>
          <h2>Progress</h2>
        </div>
        <p className="stats-empty">Loading...</p>
      </div>
    );
  }

  if (!stats || stats.totalVerses === 0) {
    return (
      <div className="stats">
        <div className="stats-header">
          <button className="back-btn" onClick={onBack}>&larr; Back</button>
          <h2>Progress</h2>
        </div>
        <p className="stats-empty">No verses in your library yet. Add some to start tracking progress.</p>
      </div>
    );
  }

  const maxBarAccuracy = Math.max(
    ...stats.last7Days.map((d) => d.accuracy ?? 0),
    0.01,
  );

  return (
    <div className="stats">
      <div className="stats-header">
        <button className="back-btn" onClick={onBack}>&larr; Back</button>
        <h2>Progress</h2>
      </div>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalVerses}</div>
          <div className="stat-label">Total Verses</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.masteredVerses}</div>
          <div className="stat-label">Mastered</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.currentStreak}</div>
          <div className="stat-label">Day Streak</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatPercent(stats.averageAccuracy)}</div>
          <div className="stat-label">Avg Accuracy</div>
        </div>
        <div className="stat-card stat-card-wide">
          <div className="stat-value">{stats.dueToday}</div>
          <div className="stat-label">Due Today</div>
        </div>
      </section>

      <section className="mastery-section">
        <h3>Mastery Levels</h3>
        <div className="mastery-grid">
          {(['new', 'apprentice', 'guru', 'master', 'enlightened', 'burned'] as MasteryLevel[]).map((level) => (
            <div key={level} className="mastery-item">
              <div className="mastery-count" style={{ color: getMasteryColor(level) }}>
                {stats.masteryBreakdown[level]}
              </div>
              <div className="mastery-label" style={{ color: getMasteryColor(level) }}>
                {level}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="chart-section">
        <h3>Accuracy — Last 7 Days</h3>
        <div className="chart">
          {stats.last7Days.map((day) => {
            const heightPct = day.accuracy === null
              ? 0
              : Math.max(4, (day.accuracy / maxBarAccuracy) * 100);
            return (
              <div key={day.date} className="chart-col">
                <div className="chart-bar-wrap">
                  <div
                    className={`chart-bar ${day.accuracy === null ? 'chart-bar-empty' : ''}`}
                    style={{ height: `${heightPct}%` }}
                    title={day.accuracy === null ? 'No practice' : formatPercent(day.accuracy)}
                  />
                </div>
                <div className="chart-value">
                  {day.accuracy === null ? '—' : formatPercent(day.accuracy)}
                </div>
                <div className="chart-label">{day.label}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function computeStats(verses: Verse[]): Stats {
  const totalVerses = verses.length;
  const masteredVerses = verses.filter((v) => v.progress.interval >= MASTERED_INTERVAL_DAYS).length;
  const dueToday = verses.filter((v) => isDueForReview(v.progress)).length;

  const masteryBreakdown: Record<MasteryLevel, number> = {
    new: 0, apprentice: 0, guru: 0, master: 0, enlightened: 0, burned: 0,
  };
  for (const v of verses) {
    masteryBreakdown[getMasteryLevel(v.progress)]++;
  }

  const attempts = verses.flatMap((v) => v.progress.history);
  const averageAccuracy = attempts.length === 0
    ? 0
    : attempts.reduce((sum, a) => sum + a.accuracy, 0) / attempts.length;

  const practiceDates = new Set(attempts.map((a) => a.date));
  const currentStreak = computeStreak(practiceDates);

  const last7Days = computeLast7Days(attempts);

  return {
    totalVerses,
    masteredVerses,
    currentStreak,
    averageAccuracy,
    dueToday,
    last7Days,
    masteryBreakdown,
  };
}

function computeStreak(practiceDates: Set<string>): number {
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  if (!practiceDates.has(toDateString(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!practiceDates.has(toDateString(cursor))) {
      return 0;
    }
  }

  while (practiceDates.has(toDateString(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function computeLast7Days(attempts: { date: string; accuracy: number }[]) {
  const byDate = new Map<string, { total: number; count: number }>();
  for (const a of attempts) {
    const entry = byDate.get(a.date) ?? { total: 0, count: 0 };
    entry.total += a.accuracy;
    entry.count += 1;
    byDate.set(a.date, entry);
  }

  const days: { date: string; label: string; accuracy: number | null }[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - 6);

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 0; i < 7; i++) {
    const dateStr = toDateString(cursor);
    const entry = byDate.get(dateStr);
    days.push({
      date: dateStr,
      label: dayLabels[cursor.getDay()],
      accuracy: entry ? entry.total / entry.count : null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
