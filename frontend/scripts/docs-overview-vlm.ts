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
    'SmolVLM-500M'
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

async function checkModelAvailable(llmBin: string, modelName: string): Promise<boolean> {
  try {
    // Try a quick test run to see if model is cached
    // This will trigger download if needed (which is what we want!)
    console.log(`[VLM] [INIT] Testing model availability: ${modelName}...`);

    const testStart = Date.now();
    const result = await execa(
      llmBin,
      ['-m', modelName, '--no-stream', '--no-log', 'test'],
      {
        timeout: 15000,  // 15 second check timeout
        reject: false,
        input: '',
      }
    );
    const testDuration = Date.now() - testStart;

    // Check if we see download/fetch indicators in output
    const combined = result.stdout + result.stderr;
    const isDownloading = combined.includes('Fetching') ||
                          combined.includes('Downloading') ||
                          combined.includes('download');

    if (isDownloading) {
      console.log(`[VLM] [INIT] Model is downloading or needs setup (detected in ${testDuration}ms)`);
      return false;
    }

    // If test completed quickly without download messages, model is cached
    if (testDuration < 10000 && result.exitCode === 0) {
      console.log(`[VLM] [INIT] Model responded in ${testDuration}ms - appears cached`);
      return true;
    }

    // If it failed or took too long, assume it needs downloading
    console.log(`[VLM] [INIT] Model check inconclusive (${testDuration}ms, exit: ${result.exitCode}) - assuming needs download`);
    return false;
  } catch (error) {
    // Timeout or error means model likely needs downloading or setup
    console.log(`[VLM] [INIT] Model check failed - assuming needs download`);
    return false;
  }
}

async function runLlmOnImage(params: {
  imagePath: string;
  prompt: string;
  model: string;
  extraArgs: string[];
  suite: string;
}) {
  // Use 'llm' from PATH (pixi sets this up)
  const llmBin = 'llm';

  // Check if model is available (cached locally)
  const modelAvailable = await checkModelAvailable(llmBin, params.model);

  // Adjust timeout based on whether model needs downloading
  let timeoutMs: number;
  if (process.env.VLM_TIMEOUT_MS) {
    // User explicitly set timeout
    timeoutMs = parseInt(process.env.VLM_TIMEOUT_MS, 10);
  } else if (!modelAvailable) {
    // First run - model needs downloading (~1GB)
    timeoutMs = 180000; // 3 minutes for download + inference
    console.log(`[${params.suite}] [INFO] Model '${params.model}' not cached locally - will download on first use`);
    console.log(`[${params.suite}] [INFO] Using extended timeout: ${timeoutMs}ms (3 minutes) for model download`);
    console.log(`[${params.suite}] [INFO] Subsequent runs will be much faster (5-15 seconds)`);
  } else {
    // Model cached - use normal timeout
    timeoutMs = 30000; // 30 seconds
  }

  const heartbeatInterval = parseInt(process.env.VLM_HEARTBEAT_MS ?? '5000', 10); // Log every 5s
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

    // Get the pixi environment's PATH and PYTHONPATH
    const pixiEnv = { ...process.env };
    if (llmBin !== 'llm') {
      // If using absolute path, ensure Python env vars are set
      const binDir = path.dirname(llmBin);
      const envDir = path.dirname(binDir);
      pixiEnv.PYTHONPATH = envDir;
      if (!pixiEnv.PATH?.includes(binDir)) {
        pixiEnv.PATH = `${binDir}:${pixiEnv.PATH}`;
      }
    }

    const execaPromise = execa(llmBin, args, {
      env: pixiEnv,
      timeout: timeoutMs,
      input: '', // Close stdin immediately (MLX-VLM waits for stdin to close)
    });
    
    console.log(`${prefix} [STEP 3] Process started, PID should be available`);
    console.log(`${prefix} [STEP 4] Setting up heartbeat logging (every ${heartbeatInterval}ms)...`);
    
    // Set up heartbeat logging
    heartbeatTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.round((timeoutMs - elapsed) / 1000);

      if (!modelAvailable && elapsed < 60000) {
        // First minute - likely downloading
        console.log(`${prefix} [HEARTBEAT] Downloading model... (${Math.round(elapsed / 1000)}s elapsed, may take 1-3 minutes)`);
      } else if (!modelAvailable && elapsed < 120000) {
        // 1-2 minutes - still downloading or loading
        console.log(`${prefix} [HEARTBEAT] Model download continuing... (${Math.round(elapsed / 1000)}s elapsed)`);
      } else {
        // Normal inference or subsequent run
        console.log(`${prefix} [HEARTBEAT] Processing... (${Math.round(elapsed / 1000)}s elapsed, ${remaining}s remaining)`);
      }
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

    // Extract the answer from MLX-VLM output format:
    // The output contains debug info, then "Assistant:\n<answer>\n=========="
    // We need to extract just the <answer> part
    const assistantMatch = stdout.match(/Assistant:\s*\n\s*(.+?)(?=\n==========)/s);
    if (assistantMatch) {
      const answer = assistantMatch[1].trim();
      console.log(`${prefix} [STEP 7] Extracted answer (${answer.length} chars)`);
      return answer;
    } else {
      // Fallback to returning everything if we can't parse it
      console.log(`${prefix} [STEP 7] Could not parse Assistant format, returning full output`);
      return stdout.trim();
    }
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
      console.error(`${prefix} [ERROR] Unable to find the '${llmBin}' CLI. Ensure it's installed and in PATH.`);
      console.error(`${prefix} [ERROR] For MLX-VLM plugin: Install llm-mlx-vlm from external/llm-mlx-vlm/`);
    } else if (typeof stderr === 'string' && (/no such model/i.test(stderr) || /unknown model/i.test(stderr) || /Model not found/i.test(stderr))) {
      console.error(
        `${prefix} [ERROR] LLM reported that model '${params.model}' is unavailable.`,
      );
      console.error(`${prefix} [ERROR] For MLX-VLM models (SmolVLM-500M, SmolVLM-256M, Qwen2-VL-2B):`);
      console.error(`${prefix} [ERROR]   1. cd external/llm-mlx-vlm`);
      console.error(`${prefix} [ERROR]   2. pixi install && pixi run install-dev`);
      console.error(`${prefix} [ERROR]   3. Verify with: pixi run llm models | grep MLX-VLM`);
    } else if (typeof stderr === 'string' && /mlx.*not.*installed/i.test(stderr)) {
      console.error(`${prefix} [ERROR] MLX-VLM dependencies not installed.`);
      console.error(`${prefix} [ERROR] Install from: external/llm-mlx-vlm/`);
    } else if (errorMessage.includes('timed out')) {
      console.error(`${prefix} [ERROR] The LLM call timed out after ${timeoutMs}ms.`);
      console.error(`${prefix} [ERROR] MLX-VLM typically responds in 5-15 seconds. This may indicate:`);
      console.error(`${prefix} [ERROR]   - First run (model downloading from HuggingFace)`);
      console.error(`${prefix} [ERROR]   - System under heavy load`);
      console.error(`${prefix} [ERROR] Try increasing VLM_TIMEOUT_MS=60000 for first run`);
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

  console.log('[VLM] [INIT] Step 3a: Checking model availability...');
  const llmBin = process.env.LLM_BIN ?? 'llm';
  const modelCached = await checkModelAvailable(llmBin, model);
  if (modelCached) {
    console.log(`[VLM] [INIT] ✓ Model '${model}' is cached locally`);
    console.log(`[VLM] [INIT] Expected response time: 5-15 seconds per image`);
  } else {
    console.log(`[VLM] [INIT] ⚠ Model '${model}' not cached - will download on first use`);
    console.log(`[VLM] [INIT] Model size: ~1GB, download time: 1-3 minutes (one-time only)`);
    console.log(`[VLM] [INIT] Subsequent runs will be fast (5-15 seconds)`);
    console.log(`[VLM] [INIT] Using extended timeout: 3 minutes for first image`);
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
