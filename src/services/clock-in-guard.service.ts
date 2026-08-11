import { Punch } from '../models/punch.model.js';
import { formatHHMM, formatMinutes, parseHHMM } from './workday.service.js';
import { MIN_LUNCH_MINUTES, MIN_REST_BETWEEN_DAYS_MINUTES } from './clt-scenarios.service.js';

export type ClockInWarningCode = 'interjornada' | 'short_lunch';

export interface ClockInWarning {
  code: ClockInWarningCode;
  message: string;
}

// Verifica violações CLT ANTES de registrar uma batida. Retorna lista vazia
// quando a batida pode ser feita sem confirmação.
export function getClockInWarnings(
  todayPunches: Punch[],
  yesterdayLastExit: string | null,
  now: Date = new Date(),
): ClockInWarning[] {
  const warnings: ClockInWarning[] = [];
  const sorted = [...todayPunches].sort((a, b) => a.time.localeCompare(b.time));
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Interjornada: primeira batida do dia precisa respeitar 11h de descanso
  // desde a última saída de ontem.
  if (sorted.length === 0 && yesterdayLastExit) {
    const y = parseHHMM(yesterdayLastExit);
    if (y !== null) {
      const gap = nowMin + 24 * 60 - y;
      if (gap < MIN_REST_BETWEEN_DAYS_MINUTES) {
        warnings.push({
          code: 'interjornada',
          message: `Sua saída de ontem foi às ${yesterdayLastExit}. O descanso mínimo de 11h termina às ${formatHHMM(y + MIN_REST_BETWEEN_DAYS_MINUTES)} (descanso atual: ${formatMinutes(gap)}).`,
        });
      }
    }
  }

  // Volta do almoço: 3ª batida do dia exige intervalo mínimo de 1h.
  if (sorted.length === 2 && sorted[sorted.length - 1].type === 'EXIT') {
    const lastExit = parseHHMM(sorted[sorted.length - 1].time);
    if (lastExit !== null) {
      const gap = nowMin - lastExit;
      if (gap >= 0 && gap < MIN_LUNCH_MINUTES) {
        warnings.push({
          code: 'short_lunch',
          message: `Seu intervalo de almoço tem apenas ${formatMinutes(gap)} (mínimo de 1h).`,
        });
      }
    }
  }

  return warnings;
}
