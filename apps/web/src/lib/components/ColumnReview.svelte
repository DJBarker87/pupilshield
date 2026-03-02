<script lang="ts">
	import { pipeline, type ColumnType, type ColumnOverride } from '$lib/state.svelte';

	const COLUMN_TYPES: ColumnType[] = ['name', 'numerical', 'categorical', 'free-text', 'date', 'identifier'];

	const TYPE_COLORS: Record<string, string> = {
		name: 'chip-blue',
		numerical: 'chip-green',
		categorical: 'chip-gray',
		'free-text': 'chip-yellow',
		date: 'chip-gray',
		identifier: 'chip-red',
	};

	let sensitiveModal = $state<{ index: number; name: string; label: string } | null>(null);

	// Check for unreviewed sensitive columns
	let hasSensitiveColumns = $derived(
		pipeline.detected.some(c => c.sensitive)
	);

	let unreviewedSensitive = $derived(
		pipeline.detected.filter(c => c.sensitive && !pipeline.columnOverrides[c.index])
	);

	let canProceed = $derived(
		unreviewedSensitive.length === 0
	);

	function getEffectiveType(col: { index: number; type: string }): string {
		return pipeline.columnOverrides[col.index]?.type ?? col.type;
	}

	function handleTypeChange(index: number, newType: string) {
		pipeline.columnOverrides = {
			...pipeline.columnOverrides,
			[index]: { ...pipeline.columnOverrides[index], type: newType as ColumnType },
		};
	}

	function handleSensitiveClick(col: { index: number; name: string; sensitive: boolean }) {
		if (col.sensitive) {
			sensitiveModal = {
				index: col.index,
				name: col.name,
				label: col.name,
			};
		}
	}

	function handleSensitiveAction(action: 'remove' | 'redact' | 'keep') {
		if (!sensitiveModal) return;
		pipeline.columnOverrides = {
			...pipeline.columnOverrides,
			[sensitiveModal.index]: {
				type: 'identifier' as ColumnType,
				action,
			},
		};
		sensitiveModal = null;
	}

	function proceed() {
		pipeline.currentStep = 'mode';
	}

	function goBack() {
		pipeline.currentStep = 'input';
	}
</script>

<div class="column-review">
	<h2>Step 2: Review detected columns</h2>
	<p class="hint">
		PupilSafe has classified each column. Check the types below and override any that are wrong.
		{#if hasSensitiveColumns}
			<strong>Sensitive columns</strong> (highlighted in red) need your attention before proceeding.
		{/if}
	</p>

	<div class="table-wrapper">
		<table class="col-table">
			<thead>
				<tr>
					<th>Column</th>
					<th>Detected type</th>
					<th>Confidence</th>
					<th>Override</th>
				</tr>
			</thead>
			<tbody>
				{#each pipeline.detected as col}
					{@const override = pipeline.columnOverrides[col.index]}
					<tr class:sensitive={col.sensitive} class:review={col.reviewRequired && !override}>
						<td class="col-name">
							{col.name}
							{#if col.sensitive}
								<button
									class="sensitive-badge"
									onclick={() => handleSensitiveClick(col)}
									title="Sensitive column — click to review"
								>
									{#if override?.action}
										{override.action === 'remove' ? 'Will remove' : override.action === 'redact' ? 'Will redact' : 'Keeping'}
									{:else}
										Needs review
									{/if}
								</button>
							{/if}
							{#if col.reviewRequired && !col.sensitive && !override}
								<span class="chip chip-yellow">Low confidence</span>
							{/if}
						</td>
						<td>
							<span class="chip {TYPE_COLORS[col.type] ?? 'chip-gray'}">{col.type}</span>
						</td>
						<td>
							<div class="confidence-bar">
								<div class="confidence-fill" style:width="{col.confidence * 100}%"></div>
							</div>
							<span class="confidence-text">{Math.round(col.confidence * 100)}%</span>
						</td>
						<td>
							<select
								class="select type-select"
								value={getEffectiveType(col)}
								onchange={(e) => handleTypeChange(col.index, (e.target as HTMLSelectElement).value)}
							>
								{#each COLUMN_TYPES as t}
									<option value={t}>{t}</option>
								{/each}
							</select>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if pipeline.parsedData}
		<p class="data-summary">
			{pipeline.parsedData.rows.length} students, {pipeline.parsedData.headers.length} columns
		</p>
	{/if}

	<div class="actions">
		<button class="btn btn-secondary" onclick={goBack}>Back</button>
		<button class="btn btn-primary" onclick={proceed} disabled={!canProceed}>
			{#if !canProceed}
				Review sensitive columns first
			{:else}
				Continue
			{/if}
		</button>
	</div>
</div>

<!-- Sensitive column modal -->
{#if sensitiveModal}
	<div class="modal-backdrop" onclick={() => sensitiveModal = null} role="presentation">
		<!-- svelte-ignore a11y_interactive_supports_focus a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
		<div class="modal card" onclick={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Escape') sensitiveModal = null; }} role="dialog" tabindex="-1" aria-label="Sensitive column options">
			<h3>Sensitive column: {sensitiveModal.name}</h3>
			<p>This column appears to contain personally identifiable information. What would you like to do?</p>
			<div class="modal-actions">
				<button class="btn btn-danger" onclick={() => handleSensitiveAction('remove')}>
					Remove column (recommended)
				</button>
				<button class="btn btn-secondary" onclick={() => handleSensitiveAction('redact')}>
					Redact values
				</button>
				<button class="btn btn-secondary" onclick={() => handleSensitiveAction('keep')}>
					Keep as-is (not recommended)
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.column-review {
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
		margin-bottom: var(--space-4);
	}

	.table-wrapper {
		overflow-x: auto;
		border: 1px solid var(--color-border-light);
		border-radius: var(--radius-lg);
	}

	.col-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}

	.col-table th {
		text-align: left;
		padding: var(--space-3) var(--space-4);
		background: var(--color-bg-alt);
		font-weight: 600;
		border-bottom: 1px solid var(--color-border-light);
	}

	.col-table td {
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--color-border-light);
		vertical-align: middle;
	}

	.col-table tr:last-child td {
		border-bottom: none;
	}

	tr.sensitive {
		background: var(--color-danger-light);
	}

	tr.review {
		background: var(--color-warning-light);
	}

	.col-name {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: 500;
		flex-wrap: wrap;
	}

	.sensitive-badge {
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-xs);
		font-weight: 600;
		background: var(--color-danger);
		color: white;
		border: none;
		border-radius: 9999px;
		cursor: pointer;
	}

	.sensitive-badge:hover {
		background: #b91c1c;
	}

	.confidence-bar {
		width: 4rem;
		height: 0.375rem;
		background: var(--color-bg-subtle);
		border-radius: 9999px;
		overflow: hidden;
		display: inline-block;
		vertical-align: middle;
		margin-right: var(--space-2);
	}

	.confidence-fill {
		height: 100%;
		background: var(--color-primary);
		border-radius: 9999px;
		transition: width 0.3s ease;
	}

	.confidence-text {
		font-size: var(--text-xs);
		color: var(--color-text-muted);
	}

	.type-select {
		width: auto;
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-xs);
	}

	.data-summary {
		margin-top: var(--space-4);
		font-size: var(--text-sm);
		color: var(--color-text-muted);
	}

	.actions {
		margin-top: var(--space-6);
		display: flex;
		gap: var(--space-3);
		justify-content: flex-end;
	}

	/* Modal */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
	}

	.modal {
		max-width: 28rem;
		width: 90%;
	}

	.modal h3 {
		font-size: var(--text-lg);
		font-weight: 600;
		margin-bottom: var(--space-2);
	}

	.modal p {
		color: var(--color-text-muted);
		font-size: var(--text-sm);
		margin-bottom: var(--space-4);
	}

	.modal-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
</style>
