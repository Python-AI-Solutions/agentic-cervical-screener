import { spawn } from 'child_process';
import path from 'path';

async function test() {
  const imagePath = path.resolve('playwright-artifacts/viewer/viewer-desktop-viewer-context.png');
  console.log('Testing with child_process.spawn');

  return new Promise((resolve, reject) => {
    const proc = spawn('llm', [
      '-m',
      'SmolVLM-500M',
      '-a',
      imagePath,
      'What is in this image? Respond in one short sentence.',
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      const chunk = data.toString();
      console.log('[STDOUT chunk]:', chunk);
      stdout += chunk;
    });

    proc.stderr?.on('data', (data) => {
      const chunk = data.toString();
      console.log('[STDERR chunk]:', chunk);
      stderr += chunk;
    });

    proc.on('close', (code) => {
      console.log('\n=== PROCESS CLOSED ===');
      console.log('Exit code:', code);
      console.log('\n=== FULL STDOUT ===');
      console.log(stdout);
      console.log('\n=== FULL STDERR ===');
      console.log(stderr);
      resolve({ stdout, stderr, code });
    });

    proc.on('error', (error) => {
      console.error('Process error:', error);
      reject(error);
    });

    setTimeout(() => {
      console.log('Timeout - killing process');
      proc.kill();
      reject(new Error('Timeout'));
    }, 60000);
  });
}

void test().catch(console.error);
