import { describe, it, expect } from 'vitest';
import { detectColumns } from '../src/columns.js';

/**
 * Helper: generate N rows of a single-column dataset.
 */
function singleColumnRows(values) {
  return values.map((v) => [v]);
}

/**
 * Helper: repeat values to fill out rows.
 */
function repeat(arr, n) {
  const result = [];
  for (let i = 0; i < n; i++) {
    result.push(arr[i % arr.length]);
  }
  return result;
}

describe('columns.js — detectColumns', () => {
  // ─── Name detection ──────────────────────────────────────────────

  describe('Name columns', () => {
    it('detects "First Last" strings as name with confidence >= 90%', () => {
      const headers = ['Student Name'];
      const names = [
        'James Chen', 'Emily Barker', 'Mohammed Ali', 'Sophie Williams',
        'Oliver Brown', 'Amara Okafor', 'Liam O\'Brien', 'Charlotte Davis',
        'Noah Smith', 'Isla Johnson', 'Jack Wilson', 'Mia Taylor',
        'Harry Anderson', 'Olivia Thomas', 'George Jackson', 'Ava White',
        'Leo Harris', 'Ella Martin', 'Oscar Clark', 'Grace Lewis',
      ];
      const rows = singleColumnRows(names);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.type).toBe('name');
      expect(col.confidence).toBeGreaterThanOrEqual(0.9);
      expect(col.reviewRequired).toBe(false);
    });

    it('detects surname-first format "Barker, Dominic" as name', () => {
      const headers = ['Name'];
      const names = [
        'Barker, Dominic', 'Chen, James', 'Ali, Mohammed', 'Williams, Sophie',
        'Brown, Oliver', 'Okafor, Amara', 'Davis, Charlotte', 'Smith, Noah',
        'Johnson, Isla', 'Wilson, Jack', 'Taylor, Mia', 'Anderson, Harry',
        'Thomas, Olivia', 'Jackson, George', 'White, Ava', 'Harris, Leo',
        'Martin, Ella', 'Clark, Oscar', 'Lewis, Grace', 'Roberts, Freya',
      ];
      const rows = singleColumnRows(names);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.type).toBe('name');
      expect(col.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('does not classify code formats as names', () => {
      const headers = ['Code'];
      const codes = repeat(['DBa', 'JCh', 'MAl', 'SW', 'OB', 'AO'], 20);
      const rows = singleColumnRows(codes);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.type).not.toBe('name');
    });

    it('header containing "name" boosts name confidence', () => {
      const headers = ['Student Name'];
      // Mix of names and a few ambiguous values
      const values = [
        'James Chen', 'Emily Barker', 'Mohammed Ali', 'Sophie Williams',
        'Oliver Brown', 'Amara Okafor', 'Charlotte Davis', 'Noah Smith',
        'Isla Johnson', 'Jack Wilson',
      ];
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.type).toBe('name');
      expect(col.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });

  // ─── Numerical detection ─────────────────────────────────────────

  describe('Numerical columns', () => {
    it('detects numbers with occasional "Absent" as numerical', () => {
      const headers = ['Maths Score'];
      const values = [
        '85', '72', '91', '68', 'Absent', '77', '83', '90',
        '65', '88', '74', '69', '92', '81', '76', '70',
        '87', '79', '84', '73',
      ];
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.type).toBe('numerical');
      expect(col.confidence).toBeGreaterThanOrEqual(0.75);
      expect(col.reviewRequired).toBe(false);
    });

    it('allows N/A and X as numeric exceptions', () => {
      const headers = ['Score'];
      const values = [
        '55', '62', 'N/A', '78', '45', 'X', '90', '67',
        '82', '71', '-', '88', '59', '73', '91', '84',
        '66', '77', '80', '63',
      ];
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.type).toBe('numerical');
    });

    it('header containing "score" boosts numerical confidence', () => {
      const headers = ['KS2 Scaled Score'];
      const values = repeat(['100', '105', '110', '98', '103', '107', '112', '99'], 20);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.type).toBe('numerical');
      expect(col.confidence).toBeGreaterThanOrEqual(0.75);
    });
  });

  // ─── Categorical detection ───────────────────────────────────────

  describe('Categorical columns', () => {
    it('detects 3-4 repeated values as categorical', () => {
      const headers = ['Gender'];
      const values = repeat(['Male', 'Female', 'Male', 'Female', 'Male', 'Female'], 20);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.type).toBe('categorical');
      expect(col.confidence).toBeGreaterThanOrEqual(0.75);
      expect(col.reviewRequired).toBe(false);
    });

    it('UK MIS headers boost categorical classification', () => {
      const headers = ['SEN Stage'];
      const values = repeat(['N', 'K', 'E', 'N', 'N', 'K'], 20);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.type).toBe('categorical');
      expect(col.confidence).toBeGreaterThanOrEqual(0.75);
    });

    it('recognises PP column as categorical', () => {
      const headers = ['PP'];
      const values = repeat(['Y', 'N', 'N', 'Y', 'N', 'N', 'Y', 'N'], 20);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.type).toBe('categorical');
    });
  });

  // ─── Free-text detection ─────────────────────────────────────────

  describe('Free-text columns', () => {
    it('detects long varied strings as free-text', () => {
      const headers = ['Teacher Comments'];
      const values = [
        'James has shown excellent progress in mathematics this term, particularly in algebra.',
        'Emily needs to work on her essay structure and use more evidence from texts.',
        'Mohammed is a diligent student who consistently produces high quality work.',
        'Sophie has struggled with concentration this term but shows ability in practical work.',
        'Oliver is making good progress and is on track to meet his target grade.',
        'Amara has excellent attendance and always participates actively in class discussions.',
        'Charlotte has shown significant improvement in her written communication skills.',
        'Noah needs to complete homework more consistently to achieve his full potential.',
        'Isla demonstrates strong analytical skills and is a pleasure to teach.',
        'Jack should focus on showing his working more clearly in exam-style questions.',
        'Mia is a creative thinker who brings original ideas to class discussions.',
        'Harry has made steady progress and should continue revising key topics regularly.',
        'Olivia shows great enthusiasm for the subject and helps other students too.',
        'George needs to manage his time better during timed assessments and mock exams.',
        'Ava has been working hard this term and her effort is reflected in improved grades.',
      ];
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.type).toBe('free-text');
      expect(col.confidence).toBeGreaterThanOrEqual(0.85);
      expect(col.reviewRequired).toBe(false);
    });

    it('header containing "comment" boosts free-text detection', () => {
      const headers = ['Comment'];
      const values = [
        'Good progress shown this term in all areas of the subject.',
        'Needs to improve homework completion and meet all deadlines.',
        'Excellent participation in class and group work activities.',
        'Working below target due to inconsistent effort and focus.',
        'Shows strong understanding of key concepts in recent tests.',
        'Behaviour has been a concern and needs addressing promptly.',
        'Confident learner who is on track to achieve target grade.',
        'Should read more widely to improve depth of understanding.',
        'Very good effort this term with a positive attitude shown.',
        'Would benefit from attending revision sessions after school.',
      ];
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.type).toBe('free-text');
    });
  });

  // ─── Date detection ──────────────────────────────────────────────

  describe('Date columns', () => {
    it('detects dd/mm/yyyy values as date', () => {
      const headers = ['Enrolment Date'];
      const values = repeat(
        ['01/09/2023', '15/09/2023', '03/09/2023', '22/08/2023', '01/09/2023', '10/09/2023'],
        20
      );
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.type).toBe('date');
      expect(col.confidence).toBeGreaterThanOrEqual(0.8);
      expect(col.reviewRequired).toBe(false);
    });

    it('detects yyyy-mm-dd values as date', () => {
      const headers = ['Date'];
      const values = repeat(
        ['2023-09-01', '2023-09-15', '2023-09-03', '2023-08-22', '2023-09-01'],
        20
      );
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.type).toBe('date');
    });

    it('header containing "dob" boosts date confidence', () => {
      const headers = ['DOB'];
      const values = repeat(
        ['15/03/2008', '22/07/2008', '03/11/2008', '18/01/2009', '09/05/2008'],
        20
      );
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      // DOB header also triggers sensitive identifier detection
      expect(col.sensitive).toBe(true);
      expect(col.type).toBe('identifier');
    });
  });

  // ─── Sensitive identifier detection ──────────────────────────────

  describe('Always-sensitive identifiers', () => {
    it('marks "UPN" header as sensitive', () => {
      const headers = ['UPN'];
      const values = repeat(['A123456789012', 'B234567890123'], 10);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.sensitive).toBe(true);
      expect(col.type).toBe('identifier');
      expect(col.reviewRequired).toBe(false);
    });

    it('marks "Date of Birth" header as sensitive', () => {
      const headers = ['Date of Birth'];
      const values = repeat(['15/03/2008', '22/07/2008'], 10);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.sensitive).toBe(true);
      expect(col.type).toBe('identifier');
    });

    it('marks "Postcode" header as sensitive', () => {
      const headers = ['Postcode'];
      const values = repeat(['SW1A 1AA', 'EC2R 8AH', 'M1 1AA'], 10);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.sensitive).toBe(true);
      expect(col.type).toBe('identifier');
    });

    it('marks "Email" header as sensitive', () => {
      const headers = ['Email Address'];
      const values = repeat(['student@school.co.uk'], 10);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.sensitive).toBe(true);
      expect(col.type).toBe('identifier');
    });

    it('marks "Phone" header as sensitive', () => {
      const headers = ['Phone Number'];
      const values = repeat(['07700900000'], 10);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.sensitive).toBe(true);
      expect(col.type).toBe('identifier');
    });

    it('marks "NHS" header as sensitive', () => {
      const headers = ['NHS Number'];
      const values = repeat(['1234567890'], 10);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.sensitive).toBe(true);
      expect(col.type).toBe('identifier');
    });

    it('marks "Candidate No" header as sensitive', () => {
      const headers = ['Candidate No'];
      const values = repeat(['1234'], 10);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.sensitive).toBe(true);
    });

    it('marks "Admission No" header as sensitive', () => {
      const headers = ['Admission No'];
      const values = repeat(['ADM001'], 10);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.sensitive).toBe(true);
    });

    it('sensitive detection is case-insensitive', () => {
      const headers = ['upn', 'POSTCODE', 'Email'];
      const rows = repeat([['X123', 'SW1A 1AA', 'a@b.com']], 10);
      const result = detectColumns(headers, rows);

      expect(result.columns[0].sensitive).toBe(true);
      expect(result.columns[1].sensitive).toBe(true);
      expect(result.columns[2].sensitive).toBe(true);
    });
  });

  // ─── UK MIS recognition ──────────────────────────────────────────

  describe('UK MIS column recognition', () => {
    it('classifies "KS2 Scaled Score" correctly', () => {
      const headers = ['KS2 Scaled Score'];
      const values = repeat(['100', '105', '110', '98', '103'], 20);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      // Should be numerical (all numbers) — KS2 boosts categorical but the content is numeric
      expect(col.type).toBe('numerical');
      expect(col.confidence).toBeGreaterThanOrEqual(0.75);
    });

    it('classifies "SEN Stage" with few categories correctly', () => {
      const headers = ['SEN Stage'];
      const values = repeat(['N', 'K', 'E', 'N', 'N', 'K'], 20);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.type).toBe('categorical');
      expect(col.confidence).toBeGreaterThanOrEqual(0.75);
    });

    it('classifies "Form" with repeated groups correctly', () => {
      const headers = ['Form'];
      const values = repeat(['9A', '9B', '9C', '9D', '9A', '9B'], 20);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.type).toBe('categorical');
    });

    it('classifies "House" with repeated values correctly', () => {
      const headers = ['House'];
      const values = repeat(['Tudor', 'Stuart', 'Windsor', 'Tudor', 'Stuart'], 20);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.type).toBe('categorical');
    });
  });

  // ─── Below-threshold / review required ───────────────────────────

  describe('Review required', () => {
    it('flags column for review when confidence is below threshold', () => {
      const headers = ['Ambiguous'];
      // Mix of values that don't clearly match any type
      const values = [
        'Alpha 1', '42', 'Beta', 'Some longer text here maybe', '99',
        'Gamma', 'Delta 2', '77', 'Short', 'Another value here',
      ];
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      // With such mixed data, no type should reach its threshold
      expect(col.reviewRequired).toBe(true);
    });

    it('sensitive identifiers are never review-required', () => {
      const headers = ['UPN'];
      const values = repeat(['mixed123data'], 10);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col.sensitive).toBe(true);
      expect(col.reviewRequired).toBe(false);
    });
  });

  // ─── Mixed-type column handling ──────────────────────────────────

  describe('Mixed-type columns', () => {
    it('handles a column with a mix of numbers and text', () => {
      const headers = ['Result'];
      const values = [
        '85', '72', 'Pass', '91', 'Fail', '68', '77', 'Merit',
        '83', '90', '65', 'Distinction', '88', '74', '69', '92',
        '81', '76', '70', '87',
      ];
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      // Should still produce a result without error
      expect(col).toHaveProperty('type');
      expect(col).toHaveProperty('confidence');
    });
  });

  // ─── Empty columns ──────────────────────────────────────────────

  describe('Empty columns', () => {
    it('handles a column with all empty values', () => {
      const headers = ['Empty Col'];
      const values = repeat(['', '', ''], 10);
      const rows = singleColumnRows(values);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col).toHaveProperty('type');
      expect(col.confidence).toBe(0);
    });

    it('handles no rows', () => {
      const headers = ['Name', 'Score'];
      const rows = [];
      const result = detectColumns(headers, rows);

      expect(result.columns).toHaveLength(2);
    });

    it('handles no headers', () => {
      const result = detectColumns([], []);
      expect(result.columns).toHaveLength(0);
    });
  });

  // ─── Multi-column datasets ──────────────────────────────────────

  describe('Multi-column datasets', () => {
    it('correctly classifies a typical school dataset', () => {
      const headers = ['Student Name', 'Gender', 'Maths Score', 'Teacher Comment', 'DOB'];
      const rows = [
        ['James Chen', 'Male', '85', 'James has shown excellent progress in maths this term.', '15/03/2008'],
        ['Emily Barker', 'Female', '72', 'Emily needs to focus more on algebra and problem solving.', '22/07/2008'],
        ['Mohammed Ali', 'Male', '91', 'Mohammed consistently produces outstanding work in class.', '03/11/2008'],
        ['Sophie Williams', 'Female', '68', 'Sophie has improved but still needs extra support in class.', '18/01/2009'],
        ['Oliver Brown', 'Male', '77', 'Oliver is making good progress and meets target expectations.', '09/05/2008'],
        ['Amara Okafor', 'Female', '83', 'Amara participates well and has strong analytical abilities.', '27/06/2008'],
        ['Charlotte Davis', 'Female', '90', 'Charlotte is a highly motivated student and a role model.', '14/02/2009'],
        ['Noah Smith', 'Male', '65', 'Noah needs to complete homework consistently to improve grade.', '30/08/2008'],
        ['Isla Johnson', 'Female', '88', 'Isla demonstrates great understanding of key mathematical topics.', '21/12/2008'],
        ['Jack Wilson', 'Male', '74', 'Jack should show his working more clearly in all assessments.', '05/10/2008'],
        ['Mia Taylor', 'Female', '69', 'Mia is a creative thinker but needs to improve time management.', '11/04/2008'],
        ['Harry Anderson', 'Male', '92', 'Harry has excellent mathematical ability and helps his peers.', '28/09/2008'],
        ['Olivia Thomas', 'Female', '81', 'Olivia shows great enthusiasm for the subject this year.', '17/07/2008'],
        ['George Jackson', 'Male', '76', 'George should revise key topics more regularly before exams.', '02/06/2008'],
        ['Ava White', 'Female', '70', 'Ava has been working hard and her effort is paying off well.', '19/11/2008'],
      ];

      const result = detectColumns(headers, rows);

      // Student Name → name
      expect(result.columns[0].type).toBe('name');
      expect(result.columns[0].confidence).toBeGreaterThanOrEqual(0.9);

      // Gender → categorical
      expect(result.columns[1].type).toBe('categorical');

      // Maths Score → numerical
      expect(result.columns[2].type).toBe('numerical');

      // Teacher Comment → free-text
      expect(result.columns[3].type).toBe('free-text');

      // DOB → identifier (sensitive)
      expect(result.columns[4].type).toBe('identifier');
      expect(result.columns[4].sensitive).toBe(true);
    });
  });

  // ─── Output shape ────────────────────────────────────────────────

  describe('Output shape', () => {
    it('returns correct structure for each column', () => {
      const headers = ['Name'];
      const rows = singleColumnRows(['James Chen', 'Emily Barker', 'Mohammed Ali']);
      const result = detectColumns(headers, rows);
      const col = result.columns[0];

      expect(col).toHaveProperty('index', 0);
      expect(col).toHaveProperty('name', 'Name');
      expect(col).toHaveProperty('type');
      expect(col).toHaveProperty('confidence');
      expect(col).toHaveProperty('sensitive');
      expect(col).toHaveProperty('reviewRequired');
      expect(typeof col.confidence).toBe('number');
      expect(typeof col.sensitive).toBe('boolean');
      expect(typeof col.reviewRequired).toBe('boolean');
    });

    it('index matches column position', () => {
      const headers = ['A', 'B', 'C'];
      const rows = [['1', '2', '3']];
      const result = detectColumns(headers, rows);

      expect(result.columns[0].index).toBe(0);
      expect(result.columns[1].index).toBe(1);
      expect(result.columns[2].index).toBe(2);
    });
  });
});
