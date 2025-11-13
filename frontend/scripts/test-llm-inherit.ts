import { execa } from 'execa';
import path from 'path';

async function test() {
  const imagePath = path.resolve('playwright-artifacts/viewer/viewer-desktop-viewer-context.png');
  console.log('Testing llm WITH stdio inherit');

  const startTime = Date.now();

  try {
    await execa(
      'llm',
      [
        '-m',
        'SmolVLM-500M',
        '-a',
        imagePath,
        'What is in this image? Respond in one short sentence.',
      ],
      { timeout: 60000, stdio: 'inherit' }
    );
    const elapsed = Date.now() - startTime;
    console.log(`SUCCESS after ${elapsed}ms!`);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`FAILED after ${elapsed}ms:`, error);
  }
}

void test();
