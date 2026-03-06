import { describe, it, expect } from 'vitest';

// Test the pipeline state creation and reset.
// The state module uses Svelte $state runes, so it requires the Svelte compiler
// via the vite plugin. Vitest picks this up from the vite.config.ts.
describe('pipeline state', () => {
	it('should initialise with default values', async () => {
		const { pipeline } = await import('./state.svelte');
		expect(pipeline.currentStep).toBe('input');
		expect(pipeline.mode).toBe('accurate');
		expect(pipeline.genderMode).toBe('aware');
		expect(pipeline.parsedData).toBeNull();
		expect(pipeline.flags).toEqual([]);
	});

	it('should allow setting currentStep', async () => {
		const { pipeline } = await import('./state.svelte');
		pipeline.currentStep = 'columns';
		expect(pipeline.currentStep).toBe('columns');
		// Reset for other tests
		pipeline.currentStep = 'input';
	});

	it('should reset all state to defaults', async () => {
		const { pipeline } = await import('./state.svelte');
		// Mutate some state
		pipeline.currentStep = 'output';
		pipeline.mode = 'anonymous';
		pipeline.genderMode = 'neutral';
		pipeline.rawInput = 'test data';
		pipeline.aiResponse = 'some response';
		pipeline.templateId = 'test-template';

		// Reset
		pipeline.reset();

		expect(pipeline.currentStep).toBe('input');
		expect(pipeline.mode).toBe('accurate');
		expect(pipeline.genderMode).toBe('aware');
		expect(pipeline.rawInput).toBe('');
		expect(pipeline.aiResponse).toBe('');
		expect(pipeline.templateId).toBeNull();
		expect(pipeline.parsedData).toBeNull();
		expect(pipeline.anonymiseResult).toBeNull();
		expect(pipeline.mapping).toBeNull();
		expect(pipeline.risks).toBeNull();
		expect(pipeline.flags).toEqual([]);
		expect(pipeline.deanonymiseResult).toBeNull();
	});
});
