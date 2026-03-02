<script lang="ts">
	import { pipeline } from '$lib/state.svelte';

	let flagDecisions = $state<Record<number, 'accept' | 'reject'>>({});

	let allReviewed = $derived(
		pipeline.flags.length === 0 || pipeline.flags.every((_, i) => flagDecisions[i])
	);

	const TYPE_CHIPS: Record<string, { class: string; label: string }> = {
		name: { class: 'chip-blue', label: 'Name' },
		keyword: { class: 'chip-yellow', label: 'Keyword' },
		date: { class: 'chip-red', label: 'Date' },
		postcode: { class: 'chip-red', label: 'Postcode' },
		phone: { class: 'chip-red', label: 'Phone' },
		email: { class: 'chip-red', label: 'Email' },
		custom: { class: 'chip-gray', label: 'Custom' },
	};

	function getChip(type: string) {
		return TYPE_CHIPS[type] ?? TYPE_CHIPS.custom;
	}

	function acceptAll() {
		const decisions: Record<number, 'accept' | 'reject'> = {};
		pipeline.flags.forEach((_, i) => { decisions[i] = 'accept'; });
		flagDecisions = decisions;
	}

	function proceed() {
		pipeline.flagsReviewed = true;
		pipeline.currentStep = 'prompt';
	}

	function goBack() {
		pipeline.currentStep = 'mode';
	}
</script>

<div class="flag-review">
	<h2>Step 4: Review flagged content</h2>

	{#if pipeline.flags.length === 0}
		<div class="empty card">
			<p>No sensitive content was flagged in the free-text columns.</p>
		</div>
	{:else}
		<div class="checklist card">
			<h3>What to look for</h3>
			<ul>
				<li>Student or staff names mentioned in comments</li>
				<li>Medical conditions, safeguarding terms, family details</li>
				<li>Dates, postcodes, phone numbers, email addresses</li>
			</ul>
		</div>

		<p class="count">{pipeline.flags.length} item{pipeline.flags.length === 1 ? '' : 's'} flagged</p>

		<button class="btn btn-sm btn-secondary" onclick={acceptAll} style="margin-bottom: var(--space-4);">
			Accept all flags
		</button>

		<div class="flags">
			{#each pipeline.flags as flag, i}
				{@const chip = getChip(flag.type)}
				<div class="flag-item card" class:accepted={flagDecisions[i] === 'accept'} class:rejected={flagDecisions[i] === 'reject'}>
					<div class="flag-header">
						<span class="chip {chip.class}">{chip.label}</span>
						{#if flag.subtype}
							<span class="chip chip-gray">{flag.subtype}</span>
						{/if}
						<span class="flag-value">"{flag.value}"</span>
					</div>
					<p class="flag-context">{flag.context}</p>
					{#if flag.rowIndex !== undefined}
						<p class="flag-location">Row {flag.rowIndex + 1}, Column {flag.colIndex + 1}</p>
					{/if}
					<div class="flag-actions">
						<button
							class="btn btn-sm"
							class:btn-primary={flagDecisions[i] === 'accept'}
							class:btn-secondary={flagDecisions[i] !== 'accept'}
							onclick={() => flagDecisions = { ...flagDecisions, [i]: 'accept' }}
						>
							Redact
						</button>
						<button
							class="btn btn-sm"
							class:btn-danger={flagDecisions[i] === 'reject'}
							class:btn-secondary={flagDecisions[i] !== 'reject'}
							onclick={() => flagDecisions = { ...flagDecisions, [i]: 'reject' }}
						>
							Ignore
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Risk summary -->
	{#if pipeline.risks}
		<div class="risk-section">
			<h3>Risk summary</h3>
			{#if pipeline.risks.recommendations}
				{#each pipeline.risks.recommendations as rec}
					<p class="rec">{rec}</p>
				{/each}
			{/if}

			{#if pipeline.risks.rareCategories?.length > 0}
				<h4>Rare categories</h4>
				{#each pipeline.risks.rareCategories as rare}
					<div class="rare-item">
						<span>"{rare.value}" in {rare.columnName} ({rare.count} occurrence{rare.count === 1 ? '' : 's'})</span>
						{#if rare.suggestion}
							<span class="chip chip-yellow">Generalise to "{rare.suggestion}"</span>
						{/if}
					</div>
				{/each}
			{/if}

			{#if Object.keys(pipeline.perturbationFailures).length > 0}
				<div class="banner banner-warning">
					Some values could not be perturbed (narrow grade bands). These values are unchanged.
				</div>
			{/if}
		</div>
	{/if}

	<!-- Preview pane -->
	{#if pipeline.anonymiseResult}
		<div class="preview-section">
			<h3>Anonymised data preview</h3>
			<p class="privacy-note">Real student names never leave your browser. Only this anonymised version is copied.</p>

			<div class="table-wrapper">
				<table class="preview-table">
					<thead>
						<tr>
							{#each pipeline.anonymiseResult.anonymised.headers as header}
								<th>{header}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each pipeline.anonymiseResult.anonymised.rows.slice(0, 8) as row}
							<tr>
								{#each row as cell}
									<td>{cell}</td>
								{/each}
							</tr>
						{/each}
						{#if pipeline.anonymiseResult.anonymised.rows.length > 8}
							<tr>
								<td colspan={pipeline.anonymiseResult.anonymised.headers.length} class="more-rows">
									... {pipeline.anonymiseResult.anonymised.rows.length - 8} more rows
								</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>

			<label class="review-checkbox">
				<input type="checkbox" bind:checked={pipeline.dataReviewed} />
				I have reviewed the anonymised data and am happy for it to be sent to an AI assistant.
			</label>

			<div class="copy-section">
				<button
					class="btn btn-primary"
					disabled={!pipeline.dataReviewed || !allReviewed}
					onclick={proceed}
				>
					{#if !allReviewed}
						Review all flags first
					{:else if !pipeline.dataReviewed}
						Confirm review above
					{:else}
						Continue to prompt
					{/if}
				</button>
			</div>
		</div>
	{/if}

	<div class="actions">
		<button class="btn btn-secondary" onclick={goBack}>Back</button>
	</div>
</div>

<style>
	.flag-review {
		max-width: 60rem;
	}

	h2 {
		font-size: var(--text-xl);
		font-weight: 600;
		margin-bottom: var(--space-4);
	}

	h3 {
		font-size: var(--text-lg);
		font-weight: 600;
		margin-bottom: var(--space-3);
	}

	h4 {
		font-size: var(--text-base);
		font-weight: 600;
		margin-top: var(--space-4);
		margin-bottom: var(--space-2);
	}

	.empty p {
		color: var(--color-text-muted);
	}

	.checklist {
		margin-bottom: var(--space-4);
		background: var(--color-bg-alt);
	}

	.checklist ul {
		list-style: disc;
		padding-left: var(--space-6);
		color: var(--color-text-muted);
		font-size: var(--text-sm);
	}

	.count {
		font-size: var(--text-sm);
		color: var(--color-text-muted);
		margin-bottom: var(--space-3);
	}

	.flags {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-bottom: var(--space-6);
	}

	.flag-item {
		padding: var(--space-3) var(--space-4);
	}

	.flag-item.accepted {
		border-left: 3px solid var(--color-success);
	}

	.flag-item.rejected {
		border-left: 3px solid var(--color-text-light);
		opacity: 0.6;
	}

	.flag-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
		flex-wrap: wrap;
	}

	.flag-value {
		font-weight: 600;
		font-size: var(--text-sm);
	}

	.flag-context {
		font-size: var(--text-sm);
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		margin-bottom: var(--space-1);
	}

	.flag-location {
		font-size: var(--text-xs);
		color: var(--color-text-light);
		margin-bottom: var(--space-2);
	}

	.flag-actions {
		display: flex;
		gap: var(--space-2);
	}

	/* Risk section */
	.risk-section {
		margin-top: var(--space-6);
		padding: var(--space-4);
		border: 1px solid var(--color-border-light);
		border-radius: var(--radius-lg);
		margin-bottom: var(--space-6);
	}

	.rec {
		font-size: var(--text-sm);
		color: var(--color-text-muted);
		margin-bottom: var(--space-2);
	}

	.rare-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
		padding: var(--space-2) 0;
		flex-wrap: wrap;
	}

	.banner {
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		margin-top: var(--space-4);
	}

	.banner-warning {
		background: var(--color-warning-light);
		color: var(--color-warning);
	}

	/* Preview section */
	.preview-section {
		margin-top: var(--space-6);
		margin-bottom: var(--space-6);
	}

	.privacy-note {
		font-size: var(--text-sm);
		color: var(--color-success);
		margin-bottom: var(--space-4);
	}

	.table-wrapper {
		overflow-x: auto;
		border: 1px solid var(--color-border-light);
		border-radius: var(--radius-lg);
		margin-bottom: var(--space-4);
	}

	.preview-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-xs);
	}

	.preview-table th {
		text-align: left;
		padding: var(--space-2) var(--space-3);
		background: var(--color-bg-alt);
		font-weight: 600;
		border-bottom: 1px solid var(--color-border-light);
		white-space: nowrap;
	}

	.preview-table td {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--color-border-light);
		max-width: 12rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.more-rows {
		text-align: center;
		color: var(--color-text-light);
		font-style: italic;
	}

	.review-checkbox {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		font-size: var(--text-sm);
		cursor: pointer;
		margin-bottom: var(--space-4);
	}

	.review-checkbox input {
		margin-top: 0.2em;
	}

	.copy-section {
		margin-bottom: var(--space-4);
	}

	.actions {
		display: flex;
		gap: var(--space-3);
	}
</style>
