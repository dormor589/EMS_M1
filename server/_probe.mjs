import { parseJsonReply } from './src/services/ai/AiProvider.js';
const KEY = process.env.NVIDIA_API_KEY;
const Q = 'Solve for y in the equation y - 3 = 7 and show your work.';
const A = 'y-3=7 -> y=3+7 -> y=11 solution';
const IMPROVED = `You are marking a student's exam answers.
Reply with a single valid JSON object and nothing else.
Schema: {"grades":[{"questionId":string,"score":integer,"feedback":string}]}

BEFORE scoring each answer you MUST:
  1. Work out the correct answer yourself, independently, from the question alone.
  2. Compare the student's answer against yours.
  3. If they disagree, the student is WRONG - however confident or well presented
     their working is. Do NOT invent a reading that makes them right.

Scoring:
- Correct method AND correct result: 90-100.
- Correct method, wrong result (e.g. an arithmetic slip): 40-60. State the correct result.
- Wrong method: 0-30.
- Blank or irrelevant: 0.

Never claim an answer is correct when it is not. Never write feedback that contradicts itself.`;
const USER = `--- Answer 1 ---\nquestionId: q1\nQuestion: ${Q}\nStudent's answer: ${A}`;

async function ask(model, label) {
  for (let i = 0; i < 3; i++) {
    const t = Date.now();
    try {
      const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{role:'system',content:IMPROVED},{role:'user',content:USER}], max_tokens: 1200, temperature: 0.1 }),
      });
      if (!r.ok) { console.log(`${label}: HTTP ${r.status} (attempt ${i+1})`); continue; }
      const g = parseJsonReply((await r.json()).choices[0].message.content).grades[0];
      console.log(`${label} [${((Date.now()-t)/1000).toFixed(0)}s] score=${g.score} ${g.score <= 65 ? 'CORRECTLY MARKED DOWN' : 'WRONGLY HIGH'}`);
      console.log(`   ${g.feedback.slice(0,220)}\n`);
      return;
    } catch (e) { console.log(`${label}: ${e.message.slice(0,70)} (attempt ${i+1})`); }
  }
}
await ask('meta/llama-3.3-70b-instruct', 'llama-3.3-70b IMPROVED');
await ask('openai/gpt-oss-120b',         'gpt-oss-120b  IMPROVED');
