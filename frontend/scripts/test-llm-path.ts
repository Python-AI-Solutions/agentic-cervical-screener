import { execa } from 'execa';

async function test() {
  console.log('PATH:', process.env.PATH);
  console.log('Testing llm command...');
  try {
    const result = await execa('llm', ['models'], { timeout: 5000 });
    console.log('SUCCESS! First 5 lines of output:');
    console.log(result.stdout.split('\n').slice(0, 5).join('\n'));
  } catch (error) {
    console.error('FAILED:', error);
  }
}

void test();
