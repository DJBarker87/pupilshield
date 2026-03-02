<script lang="ts">
	import { pipeline } from '$lib/state.svelte';

	let copied = $state(false);

	// Run de-anonymisation
	$effect(() => {
		if (pipeline.currentStep === 'output' && pipeline.aiResponse && pipeline.mapping && pipeline.shieldInstance) {
			try {
				const result = pipeline.shieldInstance.deanonymise(
					pipeline.aiResponse,
					pipeline.mapping,
					{ strategy: pipeline.deanonymiseStrategy }
				);
				pipeline.deanonymiseResult = result;
			} catch (e: any) {
				pipeline.deanonymiseResult = {
					text: pipeline.aiResponse,
					stats: { idMatches: 0, nameMatches: 0, unmatched: [] },
				};
			}
		}
	});

	let outputText = $derived(() => {
		const r = pipeline.deanonymiseResult;
		if (!r) return '';
		if ('parsed' in r && r.valid && r.parsed) {
			return JSON.stringify(r.parsed, null, 2);
		}
		return r.text ?? '';
	});

	let isJsonOutput = $derived(() => {
		const r = pipeline.deanonymiseResult;
		return r && 'parsed' in r && r.valid;
	});

	let jsonGroups = $derived(() => {
		const r = pipeline.deanonymiseResult;
		if (!r || !('parsed' in r) || !r.valid || !r.parsed) return null;
		return r.parsed.groups ?? null;
	});

	let jsonSummary = $derived(() => {
		const r = pipeline.deanonymiseResult;
		if (!r || !('parsed' in r) || !r.valid || !r.parsed) return null;
		return r.parsed.summary ?? null;
	});

	async function copyOutput() {
		try {
			await navigator.clipboard.writeText(outputText());
			copied = true;
			setTimeout(() => copied = false, 2000);
		} catch {
			// fallback
		}
	}

	function startOver() {
		pipeline.reset();
	}

	function goBack() {
		pipeline.currentStep = 'response';
	}
</script>

<div class="output-display">
	<h2>Step 7: De-anonymised output</h2>

	{#if pipeline.deanonymiseResult}
		<div class="stats">
			<span class="chip chip-green">{pipeline.deanonymiseResult.stats.idMatches} ID matches</span>
			<span class="chip chip-blue">{pipeline.deanonymiseResult.stats.nameMatches} name matches</span>
			{#if pipeline.deanonymiseResult.stats.unmatched.length > 0}
				<span class="chip chip-yellow">{pipeline.deanonymiseResult.stats.unmatched.length} unmatched</span>
			{/if}
		</div>

		{#if pipeline.deanonymiseResult.stats.unmatched.length > 0}
			<div class="banner banner-warning">
				Some fake names could not be matched: {pipeline.deanonymiseResult.stats.unmatched.join(', ')}.
				These may appear in the output unchanged.
			</div>
		{/if}

		<!-- JSON output with formatted display -->
		{#if isJsonOutput() && jsonGroups()}
			<div class="json-output">
				{#if jsonSummary()}
					<div class="summary card">
						<h3>Summary</h3>
						<p>{jsonSummary()}</p>
					</div>
				{/if}

				{#each jsonGroups() as group}
					<div class="group card">
						<h3>{group.name}</h3>
						{#if group.recommendation}
							<p class="recommendation">{group.recommendation}</p>
						{/if}
						{#if group.students}
							<div class="table-wrapper">
								<table class="student-table">
									<thead>
										<tr>
											<th>Student</th>
											<th>Reason</th>
										</tr>
									</thead>
									<tbody>
										{#each group.students as student}
											<tr>
												<td class="student-name">{student.name}</td>
												<td>{student.reason}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<!-- Prose output -->
			<pre class="output-text">{outputText()}</pre>
		{/if}

		<div class="actions">
			<button class="btn btn-secondary" onclick={goBack}>Back</button>
			<button class="btn btn-primary" onclick={copyOutput}>
				{copied ? 'Copied!' : 'Copy output'}
			</button>
			<button class="btn btn-secondary" onclick={startOver}>Start over</button>
		</div>
	{:else}
		<p class="loading">Processing...</p>
	{/if}
</div>

<style>
	.output-display {
		max-width: 60rem;
	}

	h2 {
		font-size: var(--text-xl);
		font-weight: 600;
		margin-bottom: var(--space-4);
	}

	h3 {
		font-size: var(--text-base);
		font-weight: 600;
		margin-bottom: var(--space-2);
	}

	.stats {
		display: flex;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
		flex-wrap: wrap;
	}

	.banner {
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		margin-bottom: var(--space-4);
	}

	.banner-warning {
		background: var(--color-warning-light);
		color: var(--color-warning);
	}

	/* JSON output */
	.json-output {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin-bottom: var(--space-6);
	}

	.summary p {
		color: var(--color-text-muted);
		font-size: var(--text-sm);
		line-height: 1.6;
	}

	.group {
		border-left: 3px solid var(--color-primary);
	}

	.recommendation {
		font-size: var(--text-sm);
		color: var(--color-text-muted);
		margin-bottom: var(--space-3);
	}

	.table-wrapper {
		overflow-x: auto;
	}

	.student-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}

	.student-table th {
		text-align: left;
		padding: var(--space-2) var(--space-3);
		background: var(--color-bg-alt);
		font-weight: 600;
		border-bottom: 1px solid var(--color-border-light);
	}

	.student-table td {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--color-border-light);
	}

	.student-name {
		font-weight: 500;
		white-space: nowrap;
	}

	/* Prose output */
	.output-text {
		background: var(--color-bg-alt);
		border: 1px solid var(--color-border-light);
		border-radius: var(--radius-md);
		padding: var(--space-4);
		font-size: var(--text-sm);
		font-family: var(--font-mono);
		white-space: pre-wrap;
		word-break: break-word;
		overflow-y: auto;
		max-height: 32rem;
		line-height: 1.6;
		margin-bottom: var(--space-6);
	}

	.actions {
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.loading {
		color: var(--color-text-muted);
	}
</style>
