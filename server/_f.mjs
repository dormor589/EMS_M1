import AiService from './src/services/AiService.js';
const ai = new AiService();
const q = (t) => ({ id:'q1', type:'open-text', text:t, isMultipleChoice:()=>false, isOpenText:()=>true });
const CASES = [
  ['G your original bug',      'Solve for y in the equation y - 3 = 7 and show your work.', 'y-3=7 -> y=3+7 -> y=11 solution'],
  ['D right answer, bad steps','Solve for x in the equation 2x + 4 = 10 and show your work.', '2x + 4 = 10, so 2x = 10 + 4 = 14, then x = 14 - 11 = 3.'],
  ['A nonsense method',        'Simplify the fraction 16/64 and show your work.', 'You cancel the 6 on the top with the 6 on the bottom, which leaves 1/4.'],
  ['E no working shown',       'Solve for y in the equation y - 3 = 7 and show your work.', 'y = 10'],
  ['C order of operations',    'Evaluate 2 + 3 x 4 and show your work.', 'First 2 + 3 = 5, then 5 x 4 = 20. The answer is 20.'],
  ['F control fully correct',  'Solve for x in the equation 2x + 4 = 10 and show your work.', '2x + 4 = 10. Subtract 4 from both sides: 2x = 6. Divide both sides by 2: x = 3.'],
];
for (const [label, question, answer] of CASES) {
  let g = null;
  for (let i = 0; i < 3 && !g; i++) {
    const { grades } = await ai.gradeOpenAnswers({ questions:[q(question)] }, { answers:[{ questionId:'q1', value: answer }] });
    if (grades[0]?.methodIsSound !== null) g = grades[0]; else if (i<2) await new Promise(r=>setTimeout(r,6000)); else g = grades[0];
  }
  console.log(`${label.padEnd(28)} score=${String(g.score).padStart(3)}  correct=${String(g.studentIsCorrect).padEnd(5)} methodSound=${String(g.methodIsSound).padEnd(5)}${g.methodIsSound===null?' [FELL BACK]':''}`);
  await new Promise(r=>setTimeout(r,3500));
}
