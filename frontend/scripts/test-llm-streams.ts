import { execa } from 'execa';
import path from 'path';

async function test() {
  const imagePath = path.resolve('playwright-artifacts/viewer/viewer-desktop-viewer-context.png');
  console.log('Testing which stream has the output');

  try {
    const result = await execa(
      'llm',
      [
        '-m',
        'SmolVLM-500M',
        '-a',
        imagePath,
        'What is in this image? Respond in one short sentence.',
      ],
      { timeout: 60000, reject: false, all: true }
    );

    console.log('\n=== STDOUT ===');
    console.log(`Length: ${result.stdout.length}`);
    console.log(result.stdout);

    console.log('\n=== STDERR ===');
    console.log(`Length: ${result.stderr.length}`);
    console.log(result.stderr);

    console.log('\n=== ALL (combined) ===');
    console.log(`Length: ${result.all?.length ?? 0}`);
    console.log(result.all);

    console.log('\n=== Exit code ===');
    console.log(result.exitCode);
  } catch (error) {
    console.error('FAILED:', error);
  }
}

void test();
