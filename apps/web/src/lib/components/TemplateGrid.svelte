<script lang="ts">
	import { pipeline } from '$lib/state.svelte';
	import { listTemplates } from '@djb/prompts';

	const templates = listTemplates();

	const FORMAT_CHIPS: Record<string, { class: string; label: string }> = {
		json: { class: 'chip-blue', label: 'Structured JSON' },
		prose: { class: 'chip-green', label: 'Prose' },
	};

	function select(id: string) {
		pipeline.templateId = id;
		pipeline.answers = {};
	}

	function goBack() {
		pipeline.currentStep = 'review';
	}
</script>

<div class="template-grid-wrapper">
	<h2>Step 5: Choose a prompt template</h2>
	<p class="hint">What would you like the AI to do with your data?</p>

	<div class="template-grid">
		{#each templates as tpl}
			{@const chip = FORMAT_CHIPS[tpl.outputFormat] ?? { class: 'chip-gray', label: tpl.outputFormat }}
			<button
				class="template-card card"
				class:selected={pipeline.templateId === tpl.id}
				onclick={() => select(tpl.id)}
			>
				<div class="template-header">
					<h3>{tpl.name}</h3>
					<span class="chip {chip.class}">{chip.label}</span>
				</div>
				<p>{tpl.description}</p>
			</button>
		{/each}
	</div>

	<div class="actions">
		<button class="btn btn-secondary" onclick={goBack}>Back</button>
	</div>
</div>

<style>
	.template-grid-wrapper {
		max-width: 60rem;
	}

	h2 {
		font-size: var(--text-xl);
		font-weight: 600;
		margin-bottom: var(--space-2);
	}

	.hint {
		color: var(--color-text-muted);
		font-size: var(--text-sm);
		margin-bottom: var(--space-6);
	}

	.template-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: var(--space-4);
		margin-bottom: var(--space-6);
	}

	.template-card {
		text-align: left;
		cursor: pointer;
		border: 2px solid var(--color-border-light);
		transition: border-color 0.15s ease;
		font-family: inherit;
		font-size: inherit;
		background: white;
	}

	.template-card:hover {
		border-color: var(--color-primary);
	}

	.template-card.selected {
		border-color: var(--color-primary);
		background: var(--color-primary-bg);
	}

	.template-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.template-card h3 {
		font-size: var(--text-base);
		font-weight: 600;
	}

	.template-card p {
		font-size: var(--text-sm);
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	.actions {
		display: flex;
		gap: var(--space-3);
	}
</style>
