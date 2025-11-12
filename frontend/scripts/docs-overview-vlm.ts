import { promises as fs } from 'fs';
import path from 'path';
import { execa } from 'execa';

const REPORT_ROOT = path.resolve(process.cwd(), 'playwright-report', 'data', 'docs-overview');
const MODEL = process.argv.includes('--model')
  ? process.argv[process.argv.indexOf('--model') + 1]
  : process.env.DOCS_VLM_MODEL ?? 'mlx-community/llava-phi-3-mini-4k';

interface Finding {
  image: string;
  summary: string;
}

async function ensureOutputDir() {
  await fs.mkdir(REPORT_ROOT, { recursive: true });
}

async function listScreenshots(): Promise<string[]> {
  const entries = await fs.readdir(REPORT_ROOT, { withFileTypes: true });
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
  const reportPath = path.join(REPORT_ROOT, 'vlm-report.md');
  const lines = [
    '# VLM UX Audit',
    '',
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
  await ensureOutputDir();
  const images = await listScreenshots();
  if (!images.length) {
    console.warn(`No screenshots found in ${REPORT_ROOT}. Run Playwright docs-overview spec first.`);
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
      console.error(`Failed to evaluate ${image}:`, error);
      process.exitCode = 1;
    }
  }
  await writeReport(findings);
}

void main();
