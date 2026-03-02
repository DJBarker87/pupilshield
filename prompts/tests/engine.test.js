import { describe, it, expect } from 'vitest';
import { listTemplates, getTemplate, assemblePrompt } from '../engine.js';

const SAMPLE_CSV = `ID,Name,Gender,Score,Grade
[S01],Alice Smith,F,72,B
[S02],Bob Jones,M,55,C
[S03],Charlie Brown,M,88,A`;

describe('listTemplates', () => {
  it('returns 3 templates', () => {
    const templates = listTemplates();
    expect(templates).toHaveLength(3);
  });

  it('each template has required summary fields', () => {
    const required = ['id', 'name', 'description', 'tier', 'outputFormat', 'deanonymiseStrategy'];
    for (const t of listTemplates()) {
      for (const field of required) {
        expect(t).toHaveProperty(field);
        expect(t[field]).toBeTruthy();
      }
    }
  });

  it('does not expose full template details (questions, jsonSchema)', () => {
    for (const t of listTemplates()) {
      expect(t).not.toHaveProperty('questions');
      expect(t).not.toHaveProperty('jsonSchema');
    }
  });
});

describe('getTemplate', () => {
  it('returns a full template by ID', () => {
    const tpl = getTemplate('analyse-class-performance');
    expect(tpl.id).toBe('analyse-class-performance');
    expect(tpl.questions).toBeDefined();
    expect(Array.isArray(tpl.questions)).toBe(true);
  });

  it('returns template with jsonSchema for analyse-class-performance', () => {
    const tpl = getTemplate('analyse-class-performance');
    expect(tpl.jsonSchema).toBeDefined();
    expect(tpl.jsonSchema.properties.groups).toBeDefined();
    expect(tpl.jsonSchema.properties.summary).toBeDefined();
  });

  it('returns template without jsonSchema for prose templates', () => {
    expect(getTemplate('write-report-comments').jsonSchema).toBeUndefined();
    expect(getTemplate('generate-differentiated-questions').jsonSchema).toBeUndefined();
  });

  it('throws for unknown template ID', () => {
    expect(() => getTemplate('nonexistent')).toThrow('Template not found: "nonexistent"');
  });
});

describe('assemblePrompt', () => {
  describe('all templates', () => {
    const allCases = [
      {
        id: 'analyse-class-performance',
        answers: { subject: 'Year 10 Maths', focus: 'trends' },
      },
      {
        id: 'write-report-comments',
        answers: { subject: 'Year 9 English', tone: 'encouraging', wordCount: '100' },
      },
      {
        id: 'generate-differentiated-questions',
        answers: { subjectAndTopic: 'GCSE Biology — Photosynthesis', difficultyLevels: '3', questionsPerLevel: '5' },
      },
    ];

    for (const { id, answers } of allCases) {
      it(`${id}: contains all 5 standard instructions`, () => {
        const { prompt } = assemblePrompt(id, answers, SAMPLE_CSV);
        expect(prompt).toContain('Always include student ID tokens');
        expect(prompt).toContain('full name');
        expect(prompt).toContain('structured output format');
        expect(prompt).toContain('Do not invent or fabricate');
        expect(prompt).toContain('character-for-character');
      });

      it(`${id}: contains the data block`, () => {
        const { prompt } = assemblePrompt(id, answers, SAMPLE_CSV);
        expect(prompt).toContain('```csv');
        expect(prompt).toContain(SAMPLE_CSV);
        expect(prompt).toContain('```');
      });

      it(`${id}: question answers appear in prompt`, () => {
        const { prompt } = assemblePrompt(id, answers, SAMPLE_CSV);
        for (const value of Object.values(answers)) {
          expect(prompt).toContain(value);
        }
      });
    }
  });

  describe('analyse-class-performance', () => {
    const baseAnswers = { subject: 'Year 10 Maths', focus: 'intervention' };

    it('returns deanonymiseStrategy "json"', () => {
      const result = assemblePrompt('analyse-class-performance', baseAnswers, SAMPLE_CSV);
      expect(result.deanonymiseStrategy).toBe('json');
    });

    it('includes JSON schema in prompt', () => {
      const { prompt } = assemblePrompt('analyse-class-performance', baseAnswers, SAMPLE_CSV);
      expect(prompt).toContain('Respond with valid JSON matching this schema');
      expect(prompt).toContain('"groups"');
      expect(prompt).toContain('"summary"');
    });

    it('includes optional context when provided', () => {
      const answers = { ...baseAnswers, context: 'Focus on PP students' };
      const { prompt } = assemblePrompt('analyse-class-performance', answers, SAMPLE_CSV);
      expect(prompt).toContain('Focus on PP students');
    });

    it('works without optional context', () => {
      const { prompt } = assemblePrompt('analyse-class-performance', baseAnswers, SAMPLE_CSV);
      expect(prompt).not.toContain('Additional context');
    });
  });

  describe('write-report-comments', () => {
    const answers = { subject: 'Year 9 English', tone: 'formal', wordCount: '150' };

    it('returns deanonymiseStrategy "id-first"', () => {
      const result = assemblePrompt('write-report-comments', answers, SAMPLE_CSV);
      expect(result.deanonymiseStrategy).toBe('id-first');
    });

    it('does not include JSON schema', () => {
      const { prompt } = assemblePrompt('write-report-comments', answers, SAMPLE_CSV);
      expect(prompt).not.toContain('Respond with valid JSON matching this schema');
    });

    it('includes tone and word count in preamble', () => {
      const { prompt } = assemblePrompt('write-report-comments', answers, SAMPLE_CSV);
      expect(prompt).toContain('formal');
      expect(prompt).toContain('150');
    });
  });

  describe('generate-differentiated-questions', () => {
    const answers = { subjectAndTopic: 'GCSE Biology — Photosynthesis', difficultyLevels: '2', questionsPerLevel: '3' };

    it('returns deanonymiseStrategy "id-first"', () => {
      const result = assemblePrompt('generate-differentiated-questions', answers, SAMPLE_CSV);
      expect(result.deanonymiseStrategy).toBe('id-first');
    });

    it('does not include JSON schema', () => {
      const { prompt } = assemblePrompt('generate-differentiated-questions', answers, SAMPLE_CSV);
      expect(prompt).not.toContain('Respond with valid JSON matching this schema');
    });

    it('includes levels and questions per level', () => {
      const { prompt } = assemblePrompt('generate-differentiated-questions', answers, SAMPLE_CSV);
      expect(prompt).toContain('2 difficulty levels');
      expect(prompt).toContain('3 questions per level');
    });
  });

  describe('validation', () => {
    it('throws for unknown template ID', () => {
      expect(() => assemblePrompt('nonexistent', {}, SAMPLE_CSV)).toThrow('Template not found');
    });

    it('throws for missing required answer', () => {
      expect(() => assemblePrompt('write-report-comments', { subject: 'Maths' }, SAMPLE_CSV))
        .toThrow('Missing required answer');
    });

    it('throws with descriptive message naming the missing field', () => {
      try {
        assemblePrompt('write-report-comments', { subject: 'Maths', tone: 'formal' }, SAMPLE_CSV);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e.message).toContain('wordCount');
        expect(e.message).toContain('Approximate word count');
      }
    });

    it('throws for empty string as required answer', () => {
      expect(() =>
        assemblePrompt('write-report-comments', { subject: '', tone: 'formal', wordCount: '100' }, SAMPLE_CSV)
      ).toThrow('Missing required answer');
    });
  });
});
