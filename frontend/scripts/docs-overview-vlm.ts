import { promises as fs } from 'fs';
import path from 'path';
import { execa } from 'execa';

type Options = {
  suite: string;
  modelOverride?: string;
  screenshotsDir?: string;
  llmArgs?: string;
};

type Finding = {
  image: string;
  summary: string;
  severity: string;
};

type ParsedSummary = {
  severity: string;
  notes: string;
};

function parseArgsValue(value?: string) {
  if (!value) return [];
  const args: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ' ' && !inQuotes) {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current) args.push(current);
  return args;
}

function parseOptions(): Options {
  const args = process.argv.slice(2);
  const opts: Options = {
    suite: process.env.DOCS_VLM_SUITE ?? 'docs-overview',
    modelOverride: process.env.DOCS_VLM_MODEL,
    screenshotsDir: process.env.DOCS_VLM_SCREENSHOTS,
    llmArgs: process.env.DOCS_VLM_ARGS,
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--suite' && args[i + 1]) {
      opts.suite = args[i + 1];
      i += 1;
    } else if (arg === '--model' && args[i + 1]) {
      opts.modelOverride = args[i + 1];
      i += 1;
    } else if (arg === '--screenshots' && args[i + 1]) {
      opts.screenshotsDir = args[i + 1];
      i += 1;
    } else if (arg === '--llm-args' && args[i + 1]) {
      opts.llmArgs = args[i + 1];
      i += 1;
    }
  }
  return opts;
}

function envKeyForSuite(suite: string, suffix: string) {
  return `${suite.replace(/-/g, '_').toUpperCase()}_${suffix}`;
}

function resolveScreenshotsDir(suite: string, dir?: string) {
  if (dir) {
    return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
  }
  return path.resolve(process.cwd(), 'playwright-artifacts', suite);
}

function resolveModelName(opts: Options) {
  return (
    opts.modelOverride ??
    process.env[envKeyForSuite(opts.suite, 'VLM_MODEL')] ??
    process.env.VLM_MODEL ??
    'llava'
  );
}

function resolveExtraArgs(opts: Options) {
  return parseArgsValue(
    opts.llmArgs ?? process.env[envKeyForSuite(opts.suite, 'VLM_ARGS')] ?? process.env.VLM_ARGS,
  );
}

function promptFor(imageName: string, suite: string) {
  const footer = `
Respond with a single \\\`\\\`\\\`json code block containing:
{"severity":"low|medium|high","notes":"short sentence describing any issues"}
`.trim();

  if (suite === 'viewer') {
    return `
You are a UI QA assistant reviewing a responsive viewer screenshot (${imageName}) from the Agentic Cervical Screener.
Focus on:
- Header/button alignment across breakpoints
- Drawer/drawer-toggle safe-area padding
- Canvas visibility (no occlusion by drawers or floating buttons)
- Legible labels for classification buttons and toolbars

${footer}
    `.trim();
  }

  return `
You are a UI QA assistant reviewing a documentation screenshot (${imageName}) from the Agentic Cervical Screener.
Focus on:
- Orientation Path visibility and clear instructions
- Drawer/menu safe-area padding plus dismiss controls
- Readability of metadata callouts, tables, and workflow notes
- Whether overlays obscure the Niivue viewer or buttons

${footer}
  `.trim();
}

function tagFor(imagePath: string, suite: string) {
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

function parseSummary(raw: string): ParsedSummary {
  const trimmed = raw.trim();
  const candidate = trimmed.startsWith('{') ? trimmed : trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (candidate) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed.severity === 'string' && typeof parsed.notes === 'string') {
        return { severity: parsed.severity.toLowerCase(), notes: parsed.notes.trim() };
      }
    } catch {
      // Fall through to default return below
    }
  }
  return {
    severity: 'medium',
    notes: `Unable to parse JSON response: ${trimmed}`,
  };
}

async function listScreenshots(root: string): Promise<string[]> {
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  const images: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isFile() && entry.name.endsWith('.png')) {
      images.push(fullPath);
    }
  }
  return images.sort();
}

async function ensureReportDir(root: string) {
  await fs.mkdir(root, { recursive: true });
}

async function writeReport(root: string, suite: string, model: string, findings: Finding[]) {
  await ensureReportDir(root);
  const reportPath = path.join(root, 'vlm-report.md');
  const lines = [
    '# VLM UX Audit',
    '',
    `Suite: ${suite}`,
    `Model: ${model}`,
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

async function runLlmOnImage(params: {
  imagePath: string;
  prompt: string;
  model: string;
  extraArgs: string[];
  suite: string;
}) {
  const llmBin = process.env.LLM_BIN ?? 'llm';
  const timeoutMs = parseInt(process.env.VLM_TIMEOUT_MS ?? '120000', 10); // Default 2 minutes
  const heartbeatInterval = parseInt(process.env.VLM_HEARTBEAT_MS ?? '10000', 10); // Log every 10s
  const args = [
    '-m',
    params.model,
    '--no-stream',
    '--no-log',
    '-x',
    '-a',
    params.imagePath,
    ...params.extraArgs,
    params.prompt,
  ];
  const prefix = `[${params.suite}]`;
  
  console.log(`${prefix} [STEP 1] Starting processing for ${path.basename(params.imagePath)}`);
  console.log(`${prefix} [STEP 1] Model: ${params.model}`);
  console.log(`${prefix} [STEP 1] LLM binary: ${llmBin}`);
  console.log(`${prefix} [STEP 1] Image path: ${params.imagePath}`);
  console.log(`${prefix} [STEP 1] Timeout: ${timeoutMs}ms`);
  console.log(`${prefix} [STEP 1] Full command: ${llmBin} ${args.slice(0, 3).join(' ')} ... ${args.slice(-1)[0].substring(0, 50)}...`);
  
  const startTime = Date.now();
  let heartbeatTimer: NodeJS.Timeout | null = null;
  
  try {
    console.log(`${prefix} [STEP 2] Setting up timeout promise (${timeoutMs}ms)...`);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        console.log(`${prefix} [STEP 2] Timeout promise fired after ${timeoutMs}ms`);
        reject(new Error(`LLM call timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    console.log(`${prefix} [STEP 3] Starting execa process...`);
    const execaPromise = execa(llmBin, args, { 
      env: { ...process.env },
      timeout: timeoutMs,
    });
    
    console.log(`${prefix} [STEP 3] Process started, PID should be available`);
    console.log(`${prefix} [STEP 4] Setting up heartbeat logging (every ${heartbeatInterval}ms)...`);
    
    // Set up heartbeat logging
    heartbeatTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      console.log(`${prefix} [HEARTBEAT] Still waiting... (${elapsed}ms elapsed, ${Math.round((timeoutMs - elapsed) / 1000)}s remaining)`);
    }, heartbeatInterval);
    
    console.log(`${prefix} [STEP 5] Waiting for Promise.race (execa vs timeout)...`);
    const { stdout } = await Promise.race([execaPromise, timeoutPromise]);
    
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`${prefix} [STEP 6] Promise resolved successfully`);
    console.log(`${prefix} [STEP 6] Received stdout (${stdout.length} chars)`);
    console.log(`${prefix} [STEP 6] Total time: ${elapsed}ms`);
    
    const trimmed = stdout.trim();
    console.log(`${prefix} [STEP 7] Trimmed stdout (${trimmed.length} chars)`);
    return trimmed;
  } catch (error) {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    
    const elapsed = Date.now() - startTime;
    const stderr = typeof error === 'object' && error && 'stderr' in error ? (error as any).stderr : '';
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as NodeJS.ErrnoException).code;
    
    console.error(`${prefix} [ERROR] LLM call failed after ${elapsed}ms`);
    console.error(`${prefix} [ERROR] Error message: ${errorMessage}`);
    console.error(`${prefix} [ERROR] Error code: ${errorCode ?? '(none)'}`);
    
    if (stderr) {
      console.error(`${prefix} [ERROR] stderr output:`);
      console.error(stderr);
    }
    
    if (errorCode === 'ENOENT') {
      console.error(`${prefix} [ERROR] Unable to find the '${llmBin}' CLI. Ensure Pixi's bin directory is on PATH.`);
    } else if (typeof stderr === 'string' && (/no such model/i.test(stderr) || /unknown model/i.test(stderr))) {
      console.error(
        `${prefix} [ERROR] LLM reported that model '${params.model}' is unavailable. Confirm that Ollama is running and that you've pulled the model (e.g. 'ollama pull ${params.model}').`,
      );
    } else if (typeof stderr === 'string' && /connection refused/i.test(stderr)) {
      console.error(`${prefix} [ERROR] Could not reach the Ollama server. Did you start it with 'ollama serve'?`);
    } else if (errorMessage.includes('timed out')) {
      console.error(`${prefix} [ERROR] The LLM call timed out. Try increasing VLM_TIMEOUT_MS or check if the model is responding.`);
    }
    throw error;
  }
}

async function main() {
  console.log('[VLM] ========================================');
  console.log('[VLM] Starting VLM audit script');
  console.log('[VLM] ========================================');
  
  console.log('[VLM] [INIT] Step 1: Parsing options...');
  const options = parseOptions();
  console.log(`[VLM] [INIT] Suite: ${options.suite}`);
  
  console.log('[VLM] [INIT] Step 2: Resolving screenshots directory...');
  const screenshotsDir = resolveScreenshotsDir(options.suite, options.screenshotsDir);
  console.log(`[VLM] [INIT] Screenshots directory: ${screenshotsDir}`);
  
  console.log('[VLM] [INIT] Step 3: Resolving model name...');
  const model = resolveModelName(options);
  console.log(`[VLM] [INIT] Model: ${model}`);
  
  console.log('[VLM] [INIT] Step 4: Resolving extra args...');
  const extraArgs = resolveExtraArgs(options);
  console.log(`[VLM] [INIT] Extra args: ${extraArgs.length > 0 ? extraArgs.join(' ') : '(none)'}`);
  
  console.log('[VLM] [INIT] Step 5: Scanning for screenshots...');
  const images = await listScreenshots(screenshotsDir);
  console.log(`[VLM] [INIT] Found ${images.length} screenshot(s)`);
  
  if (images.length > 0) {
    console.log('[VLM] [INIT] Screenshot files:');
    images.forEach((img, idx) => {
      console.log(`[VLM] [INIT]   ${idx + 1}. ${path.basename(img)}`);
    });
  }

  if (!images.length) {
    console.error(
      `[VLM] [ERROR] No screenshots found in ${screenshotsDir}. Run the Playwright suite (e.g. docs-overview or viewer) before invoking the VLM audit.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log('[VLM] ========================================');
  console.log('[VLM] Starting image processing loop');
  console.log('[VLM] ========================================');
  console.log(`[VLM] [LOOP] About to start loop with ${images.length} images`);
  
  const findings: Finding[] = [];
  console.log(`[VLM] [LOOP] Initialized findings array`);
  
  for (let i = 0; i < images.length; i++) {
    console.log(`[VLM] [LOOP] Loop iteration ${i + 1} starting...`);
    const image = images[i];
    console.log(`[VLM] [LOOP] ========================================`);
    console.log(`[VLM] [LOOP] Image ${i + 1}/${images.length}: ${path.basename(image)}`);
    console.log(`[VLM] [LOOP] Full path: ${image}`);
    console.log(`[VLM] [LOOP] ========================================`);
    
    try {
      console.log(`[VLM] [LOOP] Generating prompt for ${path.basename(image)}...`);
      const prompt = promptFor(path.basename(image), options.suite);
      console.log(`[VLM] [LOOP] Prompt length: ${prompt.length} chars`);
      
      console.log(`[VLM] [LOOP] Calling runLlmOnImage...`);
      const raw = await runLlmOnImage({
        imagePath: image,
        prompt,
        model,
        extraArgs,
        suite: options.suite,
      });
      
      console.log(`[VLM] [LOOP] Received response, length: ${raw.length} chars`);
      console.log(`[VLM] [LOOP] Response preview: ${raw.substring(0, 100)}...`);
      
      console.log(`[VLM] [LOOP] Parsing response...`);
      const parsed = parseSummary(raw);
      console.log(`[VLM] [LOOP] Parsed severity: ${parsed.severity}`);
      console.log(`[VLM] [LOOP] Parsed notes: ${parsed.notes}`);
      
      const severity = (parsed.severity ?? 'unknown').toLowerCase();
      const tag = tagFor(image, options.suite);
      console.log(`[VLM] [LOOP] Tag: ${tag || '(none)'}`);
      
      const summaryJson = JSON.stringify(
        { severity, notes: parsed.notes, tag: tag || undefined },
        null,
        2,
      );
      findings.push({
        image,
        summary: summaryJson,
        severity,
      });
      console.log(`[VLM] [LOOP] ✓ Successfully processed ${path.basename(image)}: ${severity} severity`);
      
      if (['medium', 'high'].includes(severity)) {
        console.error(`[VLM] [LOOP] ⚠ VLM flagged ${severity} issue in ${path.basename(image)}: ${parsed.notes}`);
        process.exitCode = 1;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[VLM] [LOOP] ✗ Failed to evaluate ${path.basename(image)}`);
      console.error(`[VLM] [LOOP] Error: ${errorMsg}`);
      if (error instanceof Error && error.stack) {
        console.error(`[VLM] [LOOP] Stack trace:`, error.stack);
      }
      process.exitCode = 1;
    }
    
    console.log(`[VLM] [LOOP] Completed image ${i + 1}/${images.length}`);
  }

  console.log('[VLM] ========================================');
  console.log('[VLM] Image processing complete');
  console.log(`[VLM] Total findings: ${findings.length}`);
  console.log('[VLM] ========================================');
  
  console.log(`[VLM] [REPORT] Writing report to ${screenshotsDir}/vlm-report.md...`);
  await writeReport(screenshotsDir, options.suite, model, findings);
  console.log(`[VLM] [REPORT] ✓ Report written successfully`);
  console.log('[VLM] ========================================');
  console.log('[VLM] Script completed');
  console.log('[VLM] ========================================');
}

void main();
