import { Punch } from '../models/punch.model.js';
import { formatHHMM, formatMinutes, parseHHMM } from './workday.service.js';

export const MAX_CONTINUOUS_MINUTES = 6 * 60;
export const MIN_LUNCH_MINUTES = 60;
export const MIN_EXTRA_BREAK_MINUTES = 15;
export const MAX_DAILY_MINUTES = 10 * 60 + 48;
export const WINDOW_START_MINUTES = 7 * 60;
export const WINDOW_END_MINUTES = 22 * 60;
export const MIN_REST_BETWEEN_DAYS_MINUTES = 11 * 60;
const MAX_PERIODS = 3;

export interface CltScenarios {
  hasPunches: boolean;
  assumedReturn: string | null;
  violations: string[];
  exitRegular: { time: string; remainingMinutes: number; needsBreak: boolean; breakMinutes: number; exceedsWindow: boolean } | null;
  exitTwoPeriods: { time: string; totalMinutes: number; limitedBy: '6h' | 'cap'; exceedsWindow: boolean } | null;
  exitThreePeriods: { secondPeriodEnd: string; breakEnd: string; finalExit: string; totalMinutes: number; exceedsWindow: boolean } | null;
  maxExit: { time: string; totalMinutes: number; limitedBy: 'cap' | 'window' | 'periods' } | null;
}

const EMPTY: CltScenarios = {
  hasPunches: false,
  assumedReturn: null,
  violations: [],
  exitRegular: null,
  exitTwoPeriods: null,
  exitThreePeriods: null,
  maxExit: null,
};

interface SimSegment {
  periodIndex: number;
  startMin: number;
  endMin: number;
  breakAfterMin: number | null;
}

interface SimResult {
  endMin: number;
  workedTotal: number;
  reachedTarget: boolean;
  segments: SimSegment[];
}

// Simula períodos de trabalho a partir de startMin, respeitando 6h corridas por período,
// 1h de intervalo após o 1º período e 15 min após o 2º.
function simulate(
  startMin: number,
  periodIndex: number,
  workedBefore: number,
  workTarget: number,
  maxPeriodIndex: number,
): SimResult {
  let t = startMin;
  let needed = workTarget;
  let worked = 0;
  let idx = periodIndex;
  const segments: SimSegment[] = [];

  while (needed > 0 && idx <= maxPeriodIndex) {
    const chunk = Math.min(needed, MAX_CONTINUOUS_MINUTES);
    const segStart = t;
    t += chunk;
    worked += chunk;
    needed -= chunk;

    let breakAfter: number | null = null;
    if (needed > 0 && idx < maxPeriodIndex) {
      const breakDuration = idx === 0 ? MIN_LUNCH_MINUTES : MIN_EXTRA_BREAK_MINUTES;
      t += breakDuration;
      breakAfter = t;
    }

    segments.push({ periodIndex: idx, startMin: segStart, endMin: segStart + chunk, breakAfterMin: breakAfter });
    idx++;
  }

  return { endMin: t, workedTotal: workedBefore + worked, reachedTarget: needed <= 0, segments };
}

export function calculateCltScenarios(
  punches: Punch[],
  dailyMinutes: number,
  now: Date = new Date(),
  yesterdayLastExit: string | null = null,
): CltScenarios {
  const sorted = [...punches].sort((a, b) => a.time.localeCompare(b.time));
  if (sorted.length === 0) return { ...EMPTY };

  const violations: string[] = [];
  const minutes = sorted.map((p) => parseHHMM(p.time));

  sorted.forEach((p, i) => {
    const m = minutes[i];
    if (m !== null && (m < WINDOW_START_MINUTES || m > WINDOW_END_MINUTES)) {
      violations.push(`Batida ${p.name} ${p.time} fora da janela permitida (07:00–22:00).`);
    }
  });

  if (yesterdayLastExit) {
    const y = parseHHMM(yesterdayLastExit);
    const first = minutes[0];
    if (y !== null && first !== null && first !== undefined) {
      const gap = first + 24 * 60 - y;
      if (gap < MIN_REST_BETWEEN_DAYS_MINUTES) {
        violations.push(`Interjornada de ${formatMinutes(gap)} (mínimo de 11h entre a saída de ontem e a entrada de hoje).`);
      }
    }
  }

  const completedPeriods = Math.floor(sorted.length / 2);
  let workedBefore = 0;

  for (let i = 0; i < completedPeriods; i++) {
    const start = minutes[i * 2];
    const end = minutes[i * 2 + 1];
    if (start == null || end == null) continue;
    const duration = end - start;
    workedBefore += duration;
    if (duration > MAX_CONTINUOUS_MINUTES) {
      violations.push(`${i + 1}º período teve ${formatMinutes(duration)} corridas (máximo de 6h).`);
    }
  }

  for (let k = 0; k < completedPeriods; k++) {
    const entryIdx = 2 * k + 2;
    if (entryIdx >= sorted.length) break;
    const exitMin = minutes[2 * k + 1];
    const entryMin = minutes[entryIdx];
    if (exitMin == null || entryMin == null) continue;
    const gap = entryMin - exitMin;
    const minRequired = k === 0 ? MIN_LUNCH_MINUTES : MIN_EXTRA_BREAK_MINUTES;
    const label = k === 0 ? 'Intervalo de almoço' : 'Intervalo extra';
    if (gap < minRequired) {
      violations.push(`${label} de ${formatMinutes(gap)} (mínimo de ${formatMinutes(minRequired)}).`);
    }
  }

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isOpen = sorted.length % 2 !== 0;
  let currentStart: number;
  let assumedReturn: string | null = null;

  if (isOpen) {
    currentStart = minutes[minutes.length - 1] ?? nowMin;
    const elapsed = nowMin - currentStart;
    if (elapsed > MAX_CONTINUOUS_MINUTES) {
      violations.push(`Período atual já tem ${formatMinutes(elapsed)} corridas (máximo de 6h).`);
    }
  } else {
    const lastExit = minutes[minutes.length - 1] ?? nowMin;
    const minBreak = completedPeriods === 1 ? MIN_LUNCH_MINUTES : MIN_EXTRA_BREAK_MINUTES;
    currentStart = Math.max(nowMin, lastExit + minBreak);
    assumedReturn = formatHHMM(currentStart);
  }

  // Índice (0-based) do período atual/em aberto ou do próximo período a começar
  const upcomingPeriodIndex = completedPeriods;

  // Jornada já encerrada com 3 períodos: não há mais cenários
  if (upcomingPeriodIndex >= MAX_PERIODS) {
    return { ...EMPTY, hasPunches: true, violations };
  }

  const remainingRegular = dailyMinutes - workedBefore;
  let exitRegular: CltScenarios['exitRegular'] = null;
  if (remainingRegular > 0) {
    const sim = simulate(currentStart, upcomingPeriodIndex, workedBefore, remainingRegular, MAX_PERIODS - 1);
    if (sim.reachedTarget) {
      const breakMinutes = sim.segments.reduce(
        (acc, s) => acc + (s.breakAfterMin !== null ? s.breakAfterMin - s.endMin : 0),
        0,
      );
      exitRegular = {
        time: formatHHMM(sim.endMin),
        remainingMinutes: remainingRegular,
        needsBreak: breakMinutes > 0,
        breakMinutes,
        exceedsWindow: sim.endMin > WINDOW_END_MINUTES,
      };
    }
  }

  // "Dentro de 2 períodos": sem criar um novo intervalo extra — no máximo o almoço (índice 1),
  // ou apenas o período atual se ele já for o 2º/3º.
  const dailyCapRemaining = MAX_DAILY_MINUTES - workedBefore;
  let exitTwoPeriods: CltScenarios['exitTwoPeriods'] = null;
  let twoSim: SimResult | null = null;
  if (dailyCapRemaining > 0) {
    const maxTwoPeriodsIndex = Math.max(upcomingPeriodIndex, 1);
    twoSim = simulate(currentStart, upcomingPeriodIndex, workedBefore, dailyCapRemaining, maxTwoPeriodsIndex);
    exitTwoPeriods = {
      time: formatHHMM(twoSim.endMin),
      totalMinutes: twoSim.workedTotal,
      limitedBy: twoSim.reachedTarget ? 'cap' : '6h',
      exceedsWindow: twoSim.endMin > WINDOW_END_MINUTES,
    };
  }

  let exitThreePeriods: CltScenarios['exitThreePeriods'] = null;
  let threeSim: SimResult | null = null;
  if (twoSim && !twoSim.reachedTarget && upcomingPeriodIndex < MAX_PERIODS - 1) {
    threeSim = simulate(currentStart, upcomingPeriodIndex, workedBefore, dailyCapRemaining, MAX_PERIODS - 1);
    const current = threeSim.segments[0];
    exitThreePeriods = {
      secondPeriodEnd: formatHHMM(current.endMin),
      breakEnd: formatHHMM(current.breakAfterMin ?? current.endMin),
      finalExit: formatHHMM(threeSim.endMin),
      totalMinutes: threeSim.workedTotal,
      exceedsWindow: threeSim.endMin > WINDOW_END_MINUTES,
    };
  }

  let maxExit: CltScenarios['maxExit'] = null;
  const best = threeSim ?? twoSim;
  if (best) {
    if (best.endMin <= WINDOW_END_MINUTES) {
      maxExit = {
        time: formatHHMM(best.endMin),
        totalMinutes: best.workedTotal,
        limitedBy: best.reachedTarget ? 'cap' : 'periods',
      };
    } else {
      let worked = workedBefore;
      for (const seg of best.segments) {
        if (seg.startMin >= WINDOW_END_MINUTES) break;
        worked += Math.max(0, Math.min(seg.endMin, WINDOW_END_MINUTES) - seg.startMin);
        if (seg.breakAfterMin === null || seg.breakAfterMin >= WINDOW_END_MINUTES) break;
      }
      maxExit = { time: formatHHMM(WINDOW_END_MINUTES), totalMinutes: worked, limitedBy: 'window' };
    }
  }

  return { hasPunches: true, assumedReturn, violations, exitRegular, exitTwoPeriods, exitThreePeriods, maxExit };
}
