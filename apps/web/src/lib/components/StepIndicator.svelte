<script lang="ts">
	import type { PipelineStep } from '$lib/state.svelte';

	interface Step {
		id: PipelineStep;
		label: string;
	}

	const STEPS: Step[] = [
		{ id: 'input', label: 'Data' },
		{ id: 'columns', label: 'Columns' },
		{ id: 'mode', label: 'Mode' },
		{ id: 'review', label: 'Review' },
		{ id: 'prompt', label: 'Prompt' },
		{ id: 'response', label: 'AI Response' },
		{ id: 'output', label: 'Output' },
	];

	let { current }: { current: PipelineStep } = $props();

	function stepIndex(id: PipelineStep) {
		return STEPS.findIndex(s => s.id === id);
	}
</script>

<div class="step-indicator" role="navigation" aria-label="Pipeline steps">
	<ol class="steps">
		{#each STEPS as step, i}
			{@const currentIdx = stepIndex(current)}
			<li
				class="step"
				class:completed={i < currentIdx}
				class:active={i === currentIdx}
				class:upcoming={i > currentIdx}
				aria-current={i === currentIdx ? 'step' : undefined}
			>
				<span class="step-dot">
					{#if i < currentIdx}
						<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
							<path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					{:else}
						{i + 1}
					{/if}
				</span>
				<span class="step-label">{step.label}</span>
			</li>
		{/each}
	</ol>
</div>

<style>
	.steps {
		display: flex;
		list-style: none;
		gap: var(--space-1);
		padding: 0;
		margin: 0;
		overflow-x: auto;
	}

	.step {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		white-space: nowrap;
		font-size: var(--text-sm);
		border-radius: var(--radius-md);
	}

	.step-dot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		font-size: var(--text-xs);
		font-weight: 600;
		flex-shrink: 0;
	}

	.step-label {
		font-weight: 500;
	}

	.completed .step-dot {
		background: var(--color-success);
		color: white;
	}

	.completed .step-label {
		color: var(--color-success);
	}

	.active {
		background: var(--color-primary-light);
	}

	.active .step-dot {
		background: var(--color-primary);
		color: white;
	}

	.active .step-label {
		color: var(--color-primary);
		font-weight: 600;
	}

	.upcoming .step-dot {
		background: var(--color-bg-subtle);
		color: var(--color-text-light);
	}

	.upcoming .step-label {
		color: var(--color-text-light);
	}
</style>
