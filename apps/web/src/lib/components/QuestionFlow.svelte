<script lang="ts">
	import { pipeline } from '$lib/state.svelte';
	import { getTemplate, assemblePrompt } from '@djb/prompts';
	import Papa from 'papaparse';

	let error = $state('');

	let template = $derived(pipeline.templateId ? getTemplate(pipeline.templateId) : null);

	let allRequiredAnswered = $derived(() => {
		if (!template) return false;
		return template.questions.every((q: any) => {
			if (!q.required) return true;
			return pipeline.answers[q.id] !== undefined && pipeline.answers[q.id] !== '';
		});
	});

	function updateAnswer(id: string, value: string) {
		pipeline.answers = { ...pipeline.answers, [id]: value };
	}

	function submit() {
		error = '';
		if (!pipeline.templateId || !pipeline.anonymiseResult) return;

		try {
			// Convert anonymised data to CSV string
			const { headers, rows } = pipeline.anonymiseResult.anonymised;
			const csvString = Papa.unparse({ fields: headers, data: rows });

			const result = assemblePrompt(pipeline.templateId, pipeline.answers, csvString);
			pipeline.prompt = result.prompt;
			pipeline.deanonymiseStrategy = result.deanonymiseStrategy;
			pipeline.currentStep = 'response';
		} catch (e: any) {
			error = e.message;
		}
	}

	function goBack() {
		pipeline.templateId = null;
	}
</script>

<div class="question-flow">
	{#if template}
		<h3>{template.name}</h3>
		<p class="desc">{template.description}</p>

		<form onsubmit={(e) => { e.preventDefault(); submit(); }}>
			{#each template.questions as q}
				<div class="field">
					<label class="label" for="q-{q.id}">
						{q.label}
						{#if q.required}<span class="required">*</span>{/if}
					</label>

					{#if q.type === 'text'}
						<input
							id="q-{q.id}"
							class="input"
							type="text"
							placeholder={q.placeholder ?? ''}
							value={pipeline.answers[q.id] ?? ''}
							oninput={(e) => updateAnswer(q.id, (e.target as HTMLInputElement).value)}
						/>
					{:else if q.type === 'dropdown'}
						<select
							id="q-{q.id}"
							class="select"
							value={pipeline.answers[q.id] ?? ''}
							onchange={(e) => updateAnswer(q.id, (e.target as HTMLSelectElement).value)}
						>
							<option value="" disabled>Select...</option>
							{#each q.options as opt}
								<option value={opt}>{opt}</option>
							{/each}
						</select>
					{/if}
				</div>
			{/each}

			{#if error}
				<div class="error" role="alert">{error}</div>
			{/if}

			<div class="actions">
				<button type="button" class="btn btn-secondary" onclick={goBack}>Back</button>
				<button type="submit" class="btn btn-primary" disabled={!allRequiredAnswered()}>
					Generate prompt
				</button>
			</div>
		</form>
	{/if}
</div>

<style>
	.question-flow {
		max-width: 32rem;
	}

	h3 {
		font-size: var(--text-lg);
		font-weight: 600;
		margin-bottom: var(--space-1);
	}

	.desc {
		font-size: var(--text-sm);
		color: var(--color-text-muted);
		margin-bottom: var(--space-6);
	}

	.field {
		margin-bottom: var(--space-4);
	}

	.required {
		color: var(--color-danger);
	}

	.error {
		padding: var(--space-3) var(--space-4);
		background: var(--color-danger-light);
		color: var(--color-danger);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		margin-bottom: var(--space-4);
	}

	.actions {
		display: flex;
		gap: var(--space-3);
		margin-top: var(--space-6);
	}
</style>
