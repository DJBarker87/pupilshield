<script lang="ts">
	import { pipeline, type PipelineStep } from '$lib/state.svelte';
	import StepIndicator from '$lib/components/StepIndicator.svelte';
	import DataInput from '$lib/components/DataInput.svelte';
	import ColumnReview from '$lib/components/ColumnReview.svelte';
	import ModeSelector from '$lib/components/ModeSelector.svelte';
	import FlagReview from '$lib/components/FlagReview.svelte';
	import TemplateGrid from '$lib/components/TemplateGrid.svelte';
	import QuestionFlow from '$lib/components/QuestionFlow.svelte';
	import SplitView from '$lib/components/SplitView.svelte';
	import OutputDisplay from '$lib/components/OutputDisplay.svelte';

	function handleStepNavigate(step: PipelineStep) {
		const steps: PipelineStep[] = ['input', 'columns', 'mode', 'review', 'prompt', 'response', 'output'];
		const currentIdx = steps.indexOf(pipeline.currentStep);
		const targetIdx = steps.indexOf(step);
		if (targetIdx < currentIdx) {
			pipeline.currentStep = step;
		}
	}

	// Beforeunload navigation guard
	$effect(() => {
		if (pipeline.currentStep !== 'input') {
			const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
			window.addEventListener('beforeunload', handler);
			return () => window.removeEventListener('beforeunload', handler);
		}
	});
</script>

<svelte:head>
	<title>PupilSafe AI — Tool</title>
</svelte:head>

<div class="app-page container">
	<StepIndicator current={pipeline.currentStep} onNavigate={handleStepNavigate} />

	{#if pipeline.currentStep !== 'input'}
		<button class="start-over" onclick={() => pipeline.reset()} type="button">Start over</button>
	{/if}

	<div class="step-content">
		{#if pipeline.currentStep === 'input'}
			<DataInput />
		{:else if pipeline.currentStep === 'columns'}
			<ColumnReview />
		{:else if pipeline.currentStep === 'mode'}
			<ModeSelector />
		{:else if pipeline.currentStep === 'review'}
			<FlagReview />
		{:else if pipeline.currentStep === 'prompt'}
			{#if pipeline.templateId}
				<QuestionFlow />
			{:else}
				<TemplateGrid />
			{/if}
		{:else if pipeline.currentStep === 'response'}
			<SplitView />
		{:else if pipeline.currentStep === 'output'}
			<OutputDisplay />
		{/if}
	</div>
</div>

<style>
	.app-page {
		padding: var(--space-6) var(--space-4);
	}

	.step-content {
		margin-top: var(--space-6);
	}

	.start-over {
		background: none;
		border: none;
		color: var(--color-text-light);
		font-size: var(--text-sm);
		cursor: pointer;
		padding: var(--space-1) 0;
		margin-top: var(--space-2);
	}

	.start-over:hover {
		color: var(--color-danger);
		text-decoration: underline;
	}
</style>
