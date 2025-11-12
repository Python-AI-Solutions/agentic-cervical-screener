import { promises as fs } from 'fs';
import path from 'path';

const LOG_PATH = path.resolve(process.cwd(), '..', 'docs', 'metrics', 'onboarding-log.csv');
const WINDOW_SIZE = Number(process.env.ONBOARDING_WINDOW ?? 10);
const REQUIRED_RATIO = Number(process.env.ONBOARDING_SUCCESS_RATIO ?? 0.9);

interface Entry {
  date: string;
  mentor: string;
  contributor: string;
  commandsRan: string;
  success: boolean;
  notes: string;
}

function parseCsv(raw: string): Entry[] {
  const [headerLine, ...rows] = raw.trim().split(/\r?\n/);
  if (!headerLine) {
    return [];
  }
  const entries: Entry[] = [];
  for (const row of rows) {
    if (!row.trim()) continue;
    const cells = row.split(',').map((cell) => cell.trim());
    entries.push({
      date: cells[0] ?? '',
      mentor: cells[1] ?? '',
      contributor: cells[2] ?? '',
      commandsRan: cells[3] ?? '',
      success: (cells[4] ?? '').toLowerCase() === 'true',
      notes: cells[5] ?? '',
    });
  }
  return entries;
}

async function main() {
  try {
    const raw = await fs.readFile(LOG_PATH, 'utf-8');
    const entries = parseCsv(raw);
    if (!entries.length) {
      console.error(`[docs:metrics] No entries found in ${LOG_PATH}.`);
      process.exit(1);
      return;
    }
    const window = entries.slice(-WINDOW_SIZE);
    const successes = window.filter((entry) => entry.success).length;
    const ratio = successes / window.length;
    console.log(
      `[docs:metrics] Onboarding success ratio over last ${window.length} sessions: ${(ratio * 100).toFixed(
        1,
      )}% (${successes}/${window.length}).`,
    );
    if (ratio < REQUIRED_RATIO) {
      console.error(
        `[docs:metrics] Ratio ${(ratio * 100).toFixed(
          1,
        )}% is below required ${(REQUIRED_RATIO * 100).toFixed(0)}%. Add more successful sessions or investigate blockers.`,
      );
      process.exit(1);
    }
  } catch (error) {
    console.error(`[docs:metrics] Failed to evaluate onboarding log at ${LOG_PATH}:`, error);
    process.exit(1);
  }
}

void main();
