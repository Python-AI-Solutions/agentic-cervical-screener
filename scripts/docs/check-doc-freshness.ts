import { promises as fs } from 'fs';
import path from 'path';

const DOC_PATH = path.resolve(process.cwd(), '..', 'docs', 'project_overview.md');
const MAX_AGE_DAYS = Number(process.env.DOCS_MAX_AGE_DAYS ?? 30);

function parseFrontMatter(content: string): Record<string, string> {
  const lines = content.split(/\r?\n/);
  if (!lines.length || lines[0].trim() !== '---') {
    return {};
  }
  let idx = 1;
  const metadata: Record<string, string> = {};
  for (; idx < lines.length; idx += 1) {
    const line = lines[idx].trim();
    if (line === '---') {
      break;
    }
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) continue;
    metadata[key.trim()] = rest.join(':').trim();
  }
  return metadata;
}

function daysBetween(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}

async function main() {
  try {
    const raw = await fs.readFile(DOC_PATH, 'utf-8');
    const metadata = parseFrontMatter(raw);
    const lastReviewed = metadata['last_reviewed'];
    if (!lastReviewed) {
      console.error('[docs:metrics] `last_reviewed` missing from project_overview.md front matter.');
      process.exit(1);
      return;
    }
    const reviewedDate = new Date(lastReviewed);
    if (Number.isNaN(reviewedDate.getTime())) {
      console.error(`[docs:metrics] Invalid last_reviewed date: ${lastReviewed}`);
      process.exit(1);
      return;
    }
    const age = daysBetween(reviewedDate, new Date());
    console.log(
      `[docs:metrics] project_overview.md last reviewed ${age.toFixed(1)} days ago (limit ${MAX_AGE_DAYS} days).`,
    );
    if (age > MAX_AGE_DAYS) {
      console.error(
        `[docs:metrics] Documentation is stale by ${(age - MAX_AGE_DAYS).toFixed(
          1,
        )} days. Update YAML front matter before merging.`,
      );
      process.exit(1);
    }
  } catch (error) {
    console.error(`[docs:metrics] Unable to evaluate freshness for ${DOC_PATH}:`, error);
    process.exit(1);
  }
}

void main();
