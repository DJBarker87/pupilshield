/**
 * Shared pipeline state for PupilSafe AI.
 * Single $state rune-based store — pipeline flows linearly through steps.
 */

import { Shield } from '@djb/shield';
import type { ParseResult } from 'papaparse';

export type ColumnType = 'name' | 'numerical' | 'categorical' | 'free-text' | 'date' | 'identifier';

export interface DetectedColumn {
	index: number;
	name: string;
	type: string;
	confidence: number;
	sensitive: boolean;
	reviewRequired: boolean;
}

export interface ColumnOverride {
	type: ColumnType;
	action?: 'keep' | 'remove' | 'redact';
}

export interface ParsedData {
	headers: string[];
	rows: string[][];
}

export interface AnonymiseResult {
	anonymised: ParsedData;
	mapping: Record<string, any>;
	risks: Record<string, any>;
	flags: Array<Record<string, any>>;
	detected: { columns: DetectedColumn[] };
	perturbationFailures: Record<number, number>;
}

export interface DeanonymiseResult {
	text?: string;
	parsed?: any;
	valid?: boolean;
	unmatched?: string[];
	stats: {
		idMatches: number;
		nameMatches: number;
		unmatched: string[];
	};
}

export type PipelineStep = 'input' | 'columns' | 'mode' | 'review' | 'prompt' | 'response' | 'output';

export type PrivacyMode = 'accurate' | 'anonymous';

function createPipelineState() {
	// Step tracking
	let currentStep = $state<PipelineStep>('input');

	// Step 1: Data input
	let rawInput = $state('');
	let parsedData = $state<ParsedData | null>(null);

	// Step 2: Column detection
	let detected = $state<DetectedColumn[]>([]);
	let columnOverrides = $state<Record<number, ColumnOverride>>({});
	let sensitiveColumnsReviewed = $state(false);

	// Step 3: Mode + config
	let mode = $state<PrivacyMode>('accurate');
	let genderMode = $state<'aware' | 'neutral'>('aware');
	let seed = $state<number>(Date.now());

	// Step 4: Anonymisation result
	let shieldInstance = $state<Shield | null>(null);
	let anonymiseResult = $state<AnonymiseResult | null>(null);
	let mapping = $state<Record<string, any> | null>(null);
	let risks = $state<Record<string, any> | null>(null);
	let flags = $state<Array<Record<string, any>>>([]);
	let perturbationFailures = $state<Record<number, number>>({});
	let flagsReviewed = $state(false);
	let dataReviewed = $state(false);

	// Step 5: Prompt
	let templateId = $state<string | null>(null);
	let answers = $state<Record<string, string>>({});
	let prompt = $state('');
	let deanonymiseStrategy = $state('id-first');

	// Step 6: AI response
	let aiResponse = $state('');

	// Step 7: Output
	let deanonymiseResult = $state<DeanonymiseResult | null>(null);

	function reset() {
		currentStep = 'input';
		rawInput = '';
		parsedData = null;
		detected = [];
		columnOverrides = {};
		sensitiveColumnsReviewed = false;
		mode = 'accurate';
		genderMode = 'aware';
		seed = Date.now();
		shieldInstance = null;
		anonymiseResult = null;
		mapping = null;
		risks = null;
		flags = [];
		perturbationFailures = {};
		flagsReviewed = false;
		dataReviewed = false;
		templateId = null;
		answers = {};
		prompt = '';
		deanonymiseStrategy = 'id-first';
		aiResponse = '';
		deanonymiseResult = null;
	}

	return {
		get currentStep() { return currentStep; },
		set currentStep(v: PipelineStep) { currentStep = v; },

		get rawInput() { return rawInput; },
		set rawInput(v: string) { rawInput = v; },

		get parsedData() { return parsedData; },
		set parsedData(v: ParsedData | null) { parsedData = v; },

		get detected() { return detected; },
		set detected(v: DetectedColumn[]) { detected = v; },

		get columnOverrides() { return columnOverrides; },
		set columnOverrides(v: Record<number, ColumnOverride>) { columnOverrides = v; },

		get sensitiveColumnsReviewed() { return sensitiveColumnsReviewed; },
		set sensitiveColumnsReviewed(v: boolean) { sensitiveColumnsReviewed = v; },

		get mode() { return mode; },
		set mode(v: PrivacyMode) { mode = v; },

		get genderMode() { return genderMode; },
		set genderMode(v: 'aware' | 'neutral') { genderMode = v; },

		get seed() { return seed; },
		set seed(v: number) { seed = v; },

		get shieldInstance() { return shieldInstance; },
		set shieldInstance(v: Shield | null) { shieldInstance = v; },

		get anonymiseResult() { return anonymiseResult; },
		set anonymiseResult(v: AnonymiseResult | null) { anonymiseResult = v; },

		get mapping() { return mapping; },
		set mapping(v: Record<string, any> | null) { mapping = v; },

		get risks() { return risks; },
		set risks(v: Record<string, any> | null) { risks = v; },

		get flags() { return flags; },
		set flags(v: Array<Record<string, any>>) { flags = v; },

		get perturbationFailures() { return perturbationFailures; },
		set perturbationFailures(v: Record<number, number>) { perturbationFailures = v; },

		get flagsReviewed() { return flagsReviewed; },
		set flagsReviewed(v: boolean) { flagsReviewed = v; },

		get dataReviewed() { return dataReviewed; },
		set dataReviewed(v: boolean) { dataReviewed = v; },

		get templateId() { return templateId; },
		set templateId(v: string | null) { templateId = v; },

		get answers() { return answers; },
		set answers(v: Record<string, string>) { answers = v; },

		get prompt() { return prompt; },
		set prompt(v: string) { prompt = v; },

		get deanonymiseStrategy() { return deanonymiseStrategy; },
		set deanonymiseStrategy(v: string) { deanonymiseStrategy = v; },

		get aiResponse() { return aiResponse; },
		set aiResponse(v: string) { aiResponse = v; },

		get deanonymiseResult() { return deanonymiseResult; },
		set deanonymiseResult(v: DeanonymiseResult | null) { deanonymiseResult = v; },

		reset,
	};
}

export const pipeline = createPipelineState();
