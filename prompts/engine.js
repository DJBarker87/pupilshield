/**
 * @module engine
 * Prompt assembly engine for PupilSafe AI.
 *
 * Three exports — all pure functions, zero dependencies, stateless.
 *
 * Usage:
 *   import { listTemplates, getTemplate, assemblePrompt } from './engine.js';
 *   const templates = listTemplates();
 *   const prompt = assemblePrompt('write-report-comments', answers, anonCSV);
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load all template JSON files from the templates/ directory.
 * @returns {object[]}
 */
function loadTemplates() {
  const dir = join(__dirname, 'templates');
  const files = [
    'analyse-class-performance.json',
    'write-report-comments.json',
    'generate-differentiated-questions.json',
  ];
  return files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf-8')));
}

const TEMPLATES = loadTemplates();

/**
 * The 5 standard instructions appended to every prompt.
 * These ensure AI output is de-anonymisable.
 */
const STANDARD_INSTRUCTIONS = [
  'Always include student ID tokens (e.g. [S01], [S02]) whenever you refer to a student.',
  'Always use each student\'s full name — never use first name only, initials, or abbreviations.',
  'Use a structured output format: either tables or prefix each student reference with "STUDENT: Name [ID]".',
  'Do not invent or fabricate any student names — only use names exactly as they appear in the data provided.',
  'Copy all student names and ID tokens character-for-character from the data. Do not alter spelling, capitalisation, or spacing.',
];

/**
 * List all available templates (summary view).
 *
 * @returns {{ id: string, name: string, description: string, tier: string, outputFormat: string, deanonymiseStrategy: string }[]}
 *
 * @example
 *   const templates = listTemplates();
 *   // [{ id: 'analyse-class-performance', name: 'Analyse Class Performance', ... }, ...]
 */
export function listTemplates() {
  return TEMPLATES.map(({ id, name, description, tier, outputFormat, deanonymiseStrategy }) => ({
    id,
    name,
    description,
    tier,
    outputFormat,
    deanonymiseStrategy,
  }));
}

/**
 * Get a full template by ID.
 *
 * @param {string} id - Template identifier
 * @returns {object} Full template object
 * @throws {Error} If template not found
 *
 * @example
 *   const tpl = getTemplate('write-report-comments');
 */
export function getTemplate(id) {
  const tpl = TEMPLATES.find((t) => t.id === id);
  if (!tpl) {
    throw new Error(`Template not found: "${id}"`);
  }
  return tpl;
}

/**
 * Build the task preamble from a template and user answers.
 * @param {object} template
 * @param {object} answers
 * @returns {string}
 */
function buildPreamble(template, answers) {
  switch (template.id) {
    case 'analyse-class-performance': {
      const focus = answers.focus;
      const subject = answers.subject;
      let preamble = `Analyse the following ${subject} class data. Focus on: ${focus}.`;
      if (answers.context) {
        preamble += ` Additional context: ${answers.context}`;
      }
      return preamble;
    }
    case 'write-report-comments': {
      const subject = answers.subject;
      const tone = answers.tone;
      const wordCount = answers.wordCount;
      return `Write individual report comments for each student in the following ${subject} class data. Use a ${tone} tone. Each comment should be approximately ${wordCount} words.`;
    }
    case 'generate-differentiated-questions': {
      const subjectAndTopic = answers.subjectAndTopic;
      const levels = answers.difficultyLevels;
      const perLevel = answers.questionsPerLevel;
      return `Using the following class data, generate differentiated questions for ${subjectAndTopic}. Create ${levels} difficulty levels with ${perLevel} questions per level. Tailor the difficulty to the student groups visible in the data.`;
    }
    default:
      throw new Error(`No preamble builder for template: "${template.id}"`);
  }
}

/**
 * Assemble a complete prompt from a template, user answers, and anonymised data.
 *
 * @param {string} id - Template identifier
 * @param {object} answers - Map of question ID → answer value
 * @param {string} anonDataString - Anonymised data as CSV string
 * @returns {{ prompt: string, deanonymiseStrategy: string }}
 * @throws {Error} If template not found or required answers missing
 *
 * @example
 *   const { prompt, deanonymiseStrategy } = assemblePrompt(
 *     'write-report-comments',
 *     { subject: 'Year 9 English', tone: 'encouraging', wordCount: '100' },
 *     anonymisedCSV
 *   );
 */
export function assemblePrompt(id, answers, anonDataString) {
  const template = getTemplate(id);

  // Validate required answers
  for (const q of template.questions) {
    if (q.required && (answers[q.id] === undefined || answers[q.id] === null || answers[q.id] === '')) {
      throw new Error(`Missing required answer for "${q.label}" (${q.id})`);
    }
  }

  const parts = [];

  // 1. Task preamble
  parts.push(buildPreamble(template, answers));

  // 2. Data block
  parts.push('');
  parts.push('```csv');
  parts.push(anonDataString);
  parts.push('```');

  // 3. Standard instructions
  parts.push('');
  parts.push('Important instructions:');
  for (let i = 0; i < STANDARD_INSTRUCTIONS.length; i++) {
    parts.push(`${i + 1}. ${STANDARD_INSTRUCTIONS[i]}`);
  }

  // 4. JSON schema (only for templates with jsonSchema)
  if (template.jsonSchema) {
    parts.push('');
    parts.push('Respond with valid JSON matching this schema:');
    parts.push('```json');
    parts.push(JSON.stringify(template.jsonSchema, null, 2));
    parts.push('```');
  }

  return {
    prompt: parts.join('\n'),
    deanonymiseStrategy: template.deanonymiseStrategy,
  };
}
