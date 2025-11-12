import { promises as fs } from 'fs';
import path from 'path';
import { execa } from 'execa';
import type { ExecaError } from 'execa';

type Options = {
  suite: string;
  model: string;
  screenshotsDir?: string;
};

function parseOptions(): Options {
  const args = process.argv.slice(2);
  const opts: Options = {
    suite: process.env.DOCS_VLM_SUITE ?? 'docs-overview',
    model: process.env.DOCS_VLM_MODEL ?? 'mlx-community/llava-phi-3-mini-4k',
    screenshotsDir: process.env.DOCS_VLM_SCREENSHOTS,
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--suite' && args[i + 1]) {
      opts.suite = args[i + 1];
      i += 1;
    } else if (arg === '--model' && args[i + 1]) {
      opts.model = args[i + 1];
      i += 1;
    } else if (arg === '--screenshots' && args[i + 1]) {
      opts.screenshotsDir = args[i + 1];
      i += 1;
    }
  }
  return opts;
}

function resolveScreenshotsDir(suite: string, dir?: string) {
  if (dir) {
    return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
  }
  return path.resolve(process.cwd(), 'playwright-artifacts', suite);
}

const { suite, model, screenshotsDir } = parseOptions();
const REPORT_ROOT = resolveScreenshotsDir(suite, screenshotsDir);
const MODEL = model;

interface Finding {
  image: string;
  summary: string;
}

async function listScreenshots(): Promise<string[]> {
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(REPORT_ROOT, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  const images: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(REPORT_ROOT, entry.name);
    if (entry.isFile() && entry.name.endsWith('.png')) {
      images.push(fullPath);
    }
  }
  return images;
}

function promptFor(imageName: string) {
  return `
You are reviewing a responsive documentation page screenshot (${imageName}) from the Agentic Cervical Screener.
Check for:
- Orientation Path visibility (callouts above the fold)
- Case Management drawer dismiss control visibility and safe-area padding
- Readability and contrast of tables and metadata callouts
- Any obstructions of underlying imagery
Respond with JSON: {"severity":"low|medium|high","notes":"concise text"}
`.trim();
}

function tagFor(imagePath: string) {
  const lower = imagePath.toLowerCase();
  if (suite === 'viewer') {
    if (lower.includes('desktop')) return '[Viewer-Desktop]';
    if (lower.includes('tablet')) return '[Viewer-Tablet]';
    if (lower.includes('phone')) return '[Viewer-Mobile]';
    return '[Viewer]';
  }
  if (lower.includes('orientation')) return '[US1]';
  if (lower.includes('reference')) return '[US2]';
  if (lower.includes('metadata')) return '[US3]';
  return '';
}

async function runVlm(imagePath: string) {
  const prompt = promptFor(path.basename(imagePath));
  const args = [
    '-m',
    'mlx_lm.generate',
    '--model',
    MODEL,
    '--prompt',
    prompt,
    '--image',
    imagePath,
  ];
  const { stdout } = await execa('python', args, { env: { ...process.env } });
  return stdout.trim();
}

async function writeReport(findings: Finding[]) {
  await fs.mkdir(REPORT_ROOT, { recursive: true });
  const reportPath = path.join(REPORT_ROOT, 'vlm-report.md');
  const lines = [
    '# VLM UX Audit',
    '',
    `Suite: ${suite}`,
    `Model: ${MODEL}`,
    `Generated: ${new Date().toISOString()}`,
    '',
  ];
  findings.forEach((finding) => {
    lines.push(`## ${path.basename(finding.image)}`);
    lines.push('');
    lines.push('```json');
    lines.push(finding.summary);
    lines.push('```');
    lines.push('');
  });
  await fs.writeFile(reportPath, lines.join('\n'), 'utf-8');
}

async function main() {
  const images = await listScreenshots();
  if (!images.length) {
    console.error(
      `No screenshots found in ${REPORT_ROOT}. Run the Playwright suite (e.g. docs-overview or viewer) before invoking the VLM audit.`,
    );
    process.exitCode = 1;
    return;
  }
  const findings: Finding[] = [];
  for (const image of images) {
    try {
      const rawSummary = await runVlm(image);
      const tag = tagFor(image);
      const summary = tag ? `${tag} ${rawSummary}` : rawSummary;
      findings.push({ image, summary });
      if (summary.toLowerCase().includes('"severity":"medium"') || summary.toLowerCase().includes('"severity":"high"')) {
        console.error(`VLM flagged issue in ${image}`);
        await writeReport(findings);
        process.exitCode = 1;
      }
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'stderr' in error &&
        typeof (error as ExecaError).stderr === 'string' &&
        (error as ExecaError).stderr.includes("No module named 'mlx_lm'")
      ) {
        console.error(
          'mlx_lm is not installed. Install it with `pip install mlx-lm` and ensure the MLX runtime is available before running docs:vlm-review.',
        );
      }
      console.error(`Failed to evaluate ${image}:`, error);
      process.exitCode = 1;
    }
  }
  await writeReport(findings);
}

void main();
