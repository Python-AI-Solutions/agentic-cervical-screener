import { execa } from 'execa';
import path from 'path';

async function test() {
  const imagePath = path.resolve('playwright-artifacts/viewer/viewer-desktop-viewer-context.png');
  console.log('Testing llm with image:', imagePath);
  console.log('Command: llm -m SmolVLM-500M "test prompt" --no-stream --no-log -a <image>');

  const startTime = Date.now();
  let heartbeat = setInterval(() => {
    console.log(`... ${Math.round((Date.now() - startTime) / 1000)}s elapsed`);
  }, 5000);

  try {
    const result = await execa(
      'llm',
      [
        '-m',
        'SmolVLM-500M',
        '--no-stream',
        '--no-log',
        '-a',
        imagePath,
        'What is in this image? Respond in one short sentence.',
      ],
      { timeout: 60000 }
    );
    clearInterval(heartbeat);
    const elapsed = Date.now() - startTime;
    console.log(`SUCCESS after ${elapsed}ms!`);
    console.log('Output:', result.stdout);
  } catch (error) {
    clearInterval(heartbeat);
    const elapsed = Date.now() - startTime;
    console.error(`FAILED after ${elapsed}ms:`, error);
    if (error && typeof error === 'object' && 'stderr' in error) {
      console.error('stderr:', (error as any).stderr);
    }
  }
}

void test();
