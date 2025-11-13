import { promises as fs, readFileSync } from 'fs';
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
    'Qwen2-VL-2B'
  );
}

function resolveExtraArgs(opts: Options) {
  return parseArgsValue(
    opts.llmArgs ?? process.env[envKeyForSuite(opts.suite, 'VLM_ARGS')] ?? process.env.VLM_ARGS,
  );
}

function promptFor(imageName: string, suite: string): string {
  const promptsDir = path.resolve(process.cwd(), 'prompts', 'vlm');
  const promptFile = suite === 'viewer' ? 'viewer-audit.txt' : 'docs-audit.txt';
  const promptPath = path.join(promptsDir, promptFile);

  try {
    // Try to load prompt from file
    const promptContent = readFileSync(promptPath, 'utf-8');
    return promptContent.trim();
  } catch (error) {
    // Fallback to inline prompts if files don't exist
    console.warn(`[VLM] [WARN] Could not load prompt from ${promptPath}, using fallback`);

    if (suite === 'viewer') {
      return `
Analyze this medical viewer UI screenshot. Look for visual issues:
- Poor alignment or spacing
- Text that's hard to read
- Buttons or controls that overlap
- Elements that look broken or misaligned

Describe any problems you see in one sentence, or say "No major issues" if it looks good.
      `.trim();
    }

    return `
Analyze this medical documentation UI screenshot. Look for visual issues:
- Instructions that are hard to see
- Text that's cut off or overlapping
- Menus or buttons that look misplaced
- Any elements that appear broken

Describe any problems you see in one sentence, or say "No major issues" if it looks good.
    `.trim();
  }
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
  const trimmed = raw.trim().toLowerCase();

  // Simple heuristic: if response says "no issues" or "looks good", it's low severity
  // Otherwise, check for severity keywords
  let severity = 'low';
  const notes = raw.trim();

  if (trimmed.includes('no major issues') || trimmed.includes('looks good') || trimmed.includes('no issues')) {
    severity = 'low';
  } else if (trimmed.includes('broken') || trimmed.includes('unreadable') || trimmed.includes('critical') || trimmed.includes('major problem')) {
    severity = 'high';
  } else if (trimmed.includes('problem') || trimmed.includes('issue') || trimmed.includes('difficult') || trimmed.includes('hard to')) {
    severity = 'medium';
  }

  return { severity, notes };
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

const MODEL_READY_CACHE = new Map<string, boolean>();

async function isModelCached(llmBin: string, modelName: string): Promise<boolean> {
  // Quick test: if model is cached, it responds in ~1-2 seconds
  // If it takes longer, model is downloading or not available
  try {
    const testStart = Date.now();
    await execa(
      llmBin,
      ['-m', modelName, '--no-stream', '--no-log', 'test'],
      {
        timeout: 5000,  // 5 second timeout
        reject: false,  // Don't reject on non-zero exit
        input: '',
      }
    );
    const elapsed = Date.now() - testStart;
    // Cached models respond quickly (< 2 seconds), downloading takes much longer
    return elapsed < 2000;
  } catch {
    // Timeout or error means model is not cached
    return false;
  }
}

async function listAvailableMlxModels(llmBin: string): Promise<string[]> {
  const { stdout } = await execa(llmBin, ['models'], { timeout: 15000 });
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('MLX-VLM:'))
    .map((line) => line.replace('MLX-VLM:', '').trim().split(' ')[0])
    .filter(Boolean);
}

async function assertModelRegistered(llmBin: string, modelName: string) {
  console.log('[VLM] [INIT] Enumerating MLX-VLM models via `llm models`...');
  let models: string[] = [];
  try {
    models = await listAvailableMlxModels(llmBin);
  } catch (error) {
    throw new Error(
      `[VLM] Unable to read MLX-VLM models from '${llmBin} models'. Verify the llm CLI is installed (pixi run llm models).`,
      { cause: error instanceof Error ? error : undefined },
    );
  }

  if (!models.length) {
    throw new Error(
      '[VLM] No MLX-VLM models detected. Install the llm-mlx-vlm plugin (see external/llm-mlx-vlm/README.md) and re-run the audit.',
    );
  }

  console.log(`[VLM] [INIT] MLX-VLM models available: ${models.join(', ')}`);
  if (!models.includes(modelName)) {
    throw new Error(
      `[VLM] Model '${modelName}' is not registered with llm. Choose one from \`${models.join(', ')}\` or run \`pixi run llm models | grep MLX-VLM\` to inspect the list.`,
    );
  }
}

async function runLlmOnImage(params: {
  imagePath: string;
  prompt: string;
  model: string;
  extraArgs: string[];
  suite: string;
  llmBin: string;
}) {
  // Use the cached value from main() initialization
  const modelCached = MODEL_READY_CACHE.get(params.model) ?? false;
  
  let timeoutMs: number;
  if (process.env.VLM_TIMEOUT_MS) {
    timeoutMs = parseInt(process.env.VLM_TIMEOUT_MS, 10);
  } else {
    timeoutMs = 180000;
  }

  const heartbeatInterval = parseInt(process.env.VLM_HEARTBEAT_MS ?? '5000', 10);
  const args = [
    '-m',
    params.model,
    '--no-stream',
    '--no-log',
    '-a',
    params.imagePath,
    ...params.extraArgs,
    params.prompt,
  ];
  const prefix = `[${params.suite}]`;

  console.log(`${prefix} [STEP 1] Starting processing for ${path.basename(params.imagePath)}`);
  console.log(`${prefix} [STEP 1] Model: ${params.model}`);
  console.log(`${prefix} [STEP 1] LLM binary: ${params.llmBin}`);
  console.log(`${prefix} [STEP 1] Image path: ${params.imagePath}`);
  console.log(`${prefix} [STEP 1] Timeout: ${timeoutMs}ms`);
  console.log(`${prefix} [STEP 1] Full command: ${params.llmBin} ${args.slice(0, 3).join(' ')} ... ${args.slice(-1)[0].substring(0, 50)}...`);

  const startTime = Date.now();
  let heartbeatTimer: NodeJS.Timeout | null = null;
  const pixiEnv = { ...process.env };
  if (params.llmBin !== 'llm') {
    const binDir = path.dirname(params.llmBin);
    const envDir = path.dirname(binDir);
    pixiEnv.PYTHONPATH = envDir;
    if (!pixiEnv.PATH?.includes(binDir)) {
      pixiEnv.PATH = `${binDir}:${pixiEnv.PATH}`;
    }
  }

  try {
    console.log(`${prefix} [STEP 2] Starting execa process...`);
    // Ensure HuggingFace cache is set for model reuse
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/root';
    const hfHome = pixiEnv.HF_HOME || `${homeDir}/.cache/huggingface`;
    pixiEnv.HF_HOME = hfHome;
    // Also set HF_HUB_CACHE where models are actually cached
    pixiEnv.HF_HUB_CACHE = pixiEnv.HF_HUB_CACHE || `${hfHome}/hub`;
    // Ensure we're not in offline mode
    pixiEnv.HF_HUB_OFFLINE = '0';
    console.log(`${prefix} [STEP 2] HF_HOME set to: ${pixiEnv.HF_HOME}`);
    console.log(`${prefix} [STEP 2] HF_HUB_CACHE set to: ${pixiEnv.HF_HUB_CACHE}`);
    
    const execaPromise = execa(params.llmBin, args, {
      env: pixiEnv,
      timeout: timeoutMs,
      input: '',
    });

    console.log(`${prefix} [STEP 2] Process started, PID should be available`);
    console.log(`${prefix} [STEP 3] Setting up heartbeat logging (every ${heartbeatInterval}ms)...`);
    const waitingForDownload = !modelCached;
    heartbeatTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.round((timeoutMs - elapsed) / 1000);

      if (waitingForDownload && elapsed < 60000) {
        console.log(`${prefix} [HEARTBEAT] Downloading model... (${Math.round(elapsed / 1000)}s elapsed, may take 1-3 minutes)`);
      } else if (waitingForDownload && elapsed < 120000) {
        console.log(`${prefix} [HEARTBEAT] Model download continuing... (${Math.round(elapsed / 1000)}s elapsed)`);
      } else {
        console.log(`${prefix} [HEARTBEAT] Processing... (${Math.round(elapsed / 1000)}s elapsed, ${remaining}s remaining)`);
      }
    }, heartbeatInterval);

    console.log(`${prefix} [STEP 4] Awaiting llm output...`);
    const { stdout } = await execaPromise;

    MODEL_READY_CACHE.set(params.model, true);
    const elapsed = Date.now() - startTime;
    console.log(`${prefix} [STEP 5] Promise resolved successfully`);
    console.log(`${prefix} [STEP 5] Received stdout (${stdout.length} chars)`);
    console.log(`${prefix} [STEP 5] Total time: ${elapsed}ms`);

    const assistantMatch = stdout.match(/Assistant:\s*\n\s*(.+?)(?=\n==========)/s);
    if (assistantMatch) {
      const answer = assistantMatch[1].trim();
      console.log(`${prefix} [STEP 6] Extracted answer (${answer.length} chars)`);
      return answer;
    } else {
      console.log(`${prefix} [STEP 6] Could not parse Assistant format, returning full output`);
      return stdout.trim();
    }
  } catch (error) {
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
      console.error(`${prefix} [ERROR] Unable to find the '${params.llmBin}' CLI. Ensure it's installed and in PATH.`);
      console.error(`${prefix} [ERROR] For MLX-VLM plugin: Install llm-mlx-vlm from external/llm-mlx-vlm/`);
    } else if (typeof stderr === 'string' && (/no such model/i.test(stderr) || /unknown model/i.test(stderr) || /Model not found/i.test(stderr))) {
      console.error(
        `${prefix} [ERROR] LLM reported that model '${params.model}' is unavailable.`,
      );
      console.error(`${prefix} [ERROR] Make sure you pick from 'pixi run llm models | grep MLX-VLM'.`);
    } else if (typeof stderr === 'string' && /mlx.*not.*installed/i.test(stderr)) {
      console.error(`${prefix} [ERROR] MLX-VLM dependencies not installed.`);
      console.error(`${prefix} [ERROR] Install from: external/llm-mlx-vlm/`);
    } else if (errorMessage.includes('timed out')) {
      console.error(`${prefix} [ERROR] The LLM call timed out after ${timeoutMs}ms.`);
      console.error(`${prefix} [ERROR] MLX-VLM typically responds in 5-15 seconds. This may indicate:`);
      console.error(`${prefix} [ERROR]   - First run (model downloading from HuggingFace)`);
      console.error(`${prefix} [ERROR]   - System under heavy load`);
      console.error(`${prefix} [ERROR] Try increasing VLM_TIMEOUT_MS=180000 for first run`);
    }
    throw new Error(
      `${prefix} Failed to process ${path.basename(params.imagePath)} with ${params.model}`,
      { cause: error instanceof Error ? error : undefined },
    );
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
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

  const llmBin = process.env.LLM_BIN ?? 'llm';
  console.log(`[VLM] [INIT] LLM binary: ${llmBin}`);
  await assertModelRegistered(llmBin, model);
  console.log('[VLM] [INIT] Model is registered. First inference will download weights if they are missing.');
  
  // Check if model is cached before processing images
  console.log(`[VLM] [INIT] Step 3.5: Testing if model '${model}' is cached...`);
  const cached = await isModelCached(llmBin, model);
  MODEL_READY_CACHE.set(model, cached);
  if (cached) {
    console.log(`[VLM] [INIT] ✓ Model is cached locally. Inference will be fast (5-15 seconds per image).`);
  } else {
    console.log(`[VLM] [INIT] ⚠ Model is not cached. First image will download it (1-3 minutes), then subsequent images will be fast.`);
  }
  
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
    
    console.log(`[VLM] [LOOP] Generating prompt for ${path.basename(image)}...`);
    const prompt = promptFor(path.basename(image), options.suite);
    console.log(`[VLM] [LOOP] Prompt length: ${prompt.length} chars`);

    console.log(`[VLM] [LOOP] Calling runLlmOnImage...`);
    let raw: string;
    try {
      raw = await runLlmOnImage({
        imagePath: image,
        prompt,
        model,
        extraArgs,
        suite: options.suite,
        llmBin,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[VLM] [LOOP] ✗ Failed to evaluate ${path.basename(image)}`);
      console.error(`[VLM] [LOOP] Error: ${errorMsg}`);
      if (error instanceof Error && error.stack) {
        console.error(`[VLM] [LOOP] Stack trace:`, error.stack);
      }
      throw error;
    }
    
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

void (async () => {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[VLM] [FATAL]', message);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  }
})();
