/**
 * @module engine.browser
 * Browser-compatible prompt assembly engine for PupilSafe AI.
 * Identical logic to engine.js but with templates inlined (no node:fs).
 */

import analyseClassPerformance from './templates/analyse-class-performance.json' with { type: 'json' };
import writeReportComments from './templates/write-report-comments.json' with { type: 'json' };
import generateDifferentiatedQuestions from './templates/generate-differentiated-questions.json' with { type: 'json' };

const TEMPLATES = [analyseClassPerformance, writeReportComments, generateDifferentiatedQuestions];

const STANDARD_INSTRUCTIONS = [
  'Always include student ID tokens (e.g. [S01], [S02]) whenever you refer to a student.',
  'Always use each student\'s full name — never use first name only, initials, or abbreviations.',
  'Use a structured output format: either tables or prefix each student reference with "STUDENT: Name [ID]".',
  'Do not invent or fabricate any student names — only use names exactly as they appear in the data provided.',
  'Copy all student names and ID tokens character-for-character from the data. Do not alter spelling, capitalisation, or spacing.',
];

/** @returns {{ id: string, name: string, description: string, tier: string, outputFormat: string, deanonymiseStrategy: string }[]} */
export function listTemplates() {
  return TEMPLATES.map(({ id, name, description, tier, outputFormat, deanonymiseStrategy }) => ({
    id, name, description, tier, outputFormat, deanonymiseStrategy,
  }));
}

/** @param {string} id */
export function getTemplate(id) {
  const tpl = TEMPLATES.find((t) => t.id === id);
  if (!tpl) throw new Error(`Template not found: "${id}"`);
  return tpl;
}

function buildPreamble(template, answers) {
  switch (template.id) {
    case 'analyse-class-performance': {
      let preamble = `Analyse the following ${answers.subject} class data. Focus on: ${answers.focus}.`;
      if (answers.context) preamble += ` Additional context: ${answers.context}`;
      return preamble;
    }
    case 'write-report-comments':
      return `Write individual report comments for each student in the following ${answers.subject} class data. Use a ${answers.tone} tone. Each comment should be approximately ${answers.wordCount} words.`;
    case 'generate-differentiated-questions':
      return `Using the following class data, generate differentiated questions for ${answers.subjectAndTopic}. Create ${answers.difficultyLevels} difficulty levels with ${answers.questionsPerLevel} questions per level. Tailor the difficulty to the student groups visible in the data.`;
    default:
      throw new Error(`No preamble builder for template: "${template.id}"`);
  }
}

/** @param {string} id @param {object} answers @param {string} anonDataString */
export function assemblePrompt(id, answers, anonDataString) {
  const template = getTemplate(id);
  for (const q of template.questions) {
    if (q.required && (answers[q.id] === undefined || answers[q.id] === null || answers[q.id] === '')) {
      throw new Error(`Missing required answer for "${q.label}" (${q.id})`);
    }
  }

  const parts = [buildPreamble(template, answers), '', '```csv', anonDataString, '```', '', 'Important instructions:'];
  for (let i = 0; i < STANDARD_INSTRUCTIONS.length; i++) {
    parts.push(`${i + 1}. ${STANDARD_INSTRUCTIONS[i]}`);
  }
  if (template.jsonSchema) {
    parts.push('', 'Respond with valid JSON matching this schema:', '```json', JSON.stringify(template.jsonSchema, null, 2), '```');
  }

  return { prompt: parts.join('\n'), deanonymiseStrategy: template.deanonymiseStrategy };
}
