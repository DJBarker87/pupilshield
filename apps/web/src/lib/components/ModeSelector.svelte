<script lang="ts">
	import { pipeline } from '$lib/state.svelte';
	import { Shield } from '@djb/shield';

	let showNudge = $state(false);
	let nudgeType = $state<'sensitive' | 'small-cohort' | null>(null);

	// Check for sensitive columns that suggest anonymous mode
	let hasSensitiveCategories = $derived(
		pipeline.detected.some(c => {
			const name = c.name.toLowerCase();
			return /ehcp|lac|safeguard/i.test(name);
		})
	);

	let isSmallCohort = $derived(
		(pipeline.parsedData?.rows.length ?? 0) < 15
	);

	function selectMode(mode: 'accurate' | 'anonymous') {
		pipeline.mode = mode;

		// Check if we should nudge
		if (mode === 'accurate' && hasSensitiveCategories) {
			nudgeType = 'sensitive';
			showNudge = true;
			return;
		}

		proceed();
	}

	function confirmMode() {
		showNudge = false;
		proceed();
	}

	function switchToAnonymous() {
		pipeline.mode = 'anonymous';
		showNudge = false;
		proceed();
	}

	function proceed() {
		runAnonymisation();
	}

	function runAnonymisation() {
		if (!pipeline.parsedData) return;

		const shield = new Shield({
			mode: pipeline.mode,
			seed: pipeline.seed,
			gender: pipeline.genderMode,
		});
		pipeline.shieldInstance = shield;

		// Build column config from overrides
		const nameColIndex = pipeline.detected.find(c => {
			const override = pipeline.columnOverrides[c.index];
			return (override?.type ?? c.type) === 'name';
		})?.index ?? 0;

		const genderColIndex = pipeline.detected.find(c => {
			return /gender/i.test(c.name);
		})?.index;

		const numericColIndices = pipeline.detected
			.filter(c => {
				const override = pipeline.columnOverrides[c.index];
				return (override?.type ?? c.type) === 'numerical';
			})
			.map(c => c.index);

		// Filter out removed columns
		const removedIndices = new Set(
			Object.entries(pipeline.columnOverrides)
				.filter(([, v]) => v.action === 'remove')
				.map(([k]) => Number(k))
		);

		let data = pipeline.parsedData;
		if (removedIndices.size > 0) {
			const keptIndices = data.headers.map((_, i) => i).filter(i => !removedIndices.has(i));
			data = {
				headers: keptIndices.map(i => data!.headers[i]),
				rows: data.rows.map(row => keptIndices.map(i => row[i])),
			};
		}

		const result = shield.anonymise(data, {
			nameColIndex: removedIndices.size > 0 ? undefined : nameColIndex,
			genderColIndex: removedIndices.size > 0 ? undefined : genderColIndex,
			numericColIndices: removedIndices.size > 0 ? undefined : numericColIndices,
		});

		pipeline.anonymiseResult = result;
		pipeline.mapping = result.mapping;
		pipeline.risks = result.risks;
		pipeline.flags = result.flags;
		pipeline.perturbationFailures = result.perturbationFailures;
		pipeline.currentStep = 'review';
	}

	function goBack() {
		pipeline.currentStep = 'columns';
	}
</script>

<div class="mode-selector">
	<h2>Step 3: Choose privacy mode</h2>
	<p class="hint">How much protection does this data need?</p>

	{#if isSmallCohort}
		<div class="banner banner-warning">
			Small cohort ({pipeline.parsedData?.rows.length} students). Anonymous mode is recommended to reduce re-identification risk.
		</div>
	{/if}

	<div class="mode-cards">
		<button
			class="mode-card card"
			class:selected={pipeline.mode === 'accurate'}
			onclick={() => selectMode('accurate')}
		>
			<h3>Accurate</h3>
			<p>Names changed, scores exact</p>
			<ul>
				<li>Real names replaced with fake names</li>
				<li>Scores and percentages unchanged</li>
				<li>Best for: report writing, detailed analysis</li>
			</ul>
		</button>

		<button
			class="mode-card card"
			class:selected={pipeline.mode === 'anonymous'}
			onclick={() => selectMode('anonymous')}
		>
			<h3>Anonymous</h3>
			<p>Names changed + statistical noise</p>
			<ul>
				<li>Real names replaced with fake names</li>
				<li>Scores shifted by small random amounts</li>
				<li>Best for: sensitive data, small cohorts, EHCP/LAC columns</li>
			</ul>
		</button>
	</div>

	<div class="gender-toggle">
		<span class="label">Gender handling</span>
		<div class="toggle-row">
			<button
				class="btn btn-sm"
				class:btn-primary={pipeline.genderMode === 'aware'}
				class:btn-secondary={pipeline.genderMode !== 'aware'}
				onclick={() => pipeline.genderMode = 'aware'}
			>
				Gender-aware names
			</button>
			<button
				class="btn btn-sm"
				class:btn-primary={pipeline.genderMode === 'neutral'}
				class:btn-secondary={pipeline.genderMode !== 'neutral'}
				onclick={() => pipeline.genderMode = 'neutral'}
			>
				Gender-neutral (they/them)
			</button>
		</div>
	</div>

	<div class="actions">
		<button class="btn btn-secondary" onclick={goBack}>Back</button>
	</div>
</div>

<!-- Nudge modal -->
{#if showNudge}
	<div class="modal-backdrop" onclick={() => showNudge = false} role="presentation">
		<!-- svelte-ignore a11y_interactive_supports_focus a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
		<div class="modal card" onclick={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Escape') showNudge = false; }} role="dialog" tabindex="-1" aria-label="Privacy mode nudge">
			{#if nudgeType === 'sensitive'}
				<h3>Sensitive data detected</h3>
				<p>Your data appears to include EHCP, LAC, or safeguarding columns. Anonymous mode adds statistical noise to reduce re-identification risk.</p>
			{/if}
			<div class="modal-actions">
				<button class="btn btn-primary" onclick={switchToAnonymous}>Switch to Anonymous</button>
				<button class="btn btn-secondary" onclick={confirmMode}>Continue in Accurate</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.mode-selector {
		max-width: 48rem;
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

	.mode-cards {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
		margin-bottom: var(--space-6);
	}

	.mode-card {
		text-align: left;
		cursor: pointer;
		border: 2px solid var(--color-border-light);
		transition: border-color 0.15s ease;
		font-family: inherit;
		font-size: inherit;
		background: white;
	}

	.mode-card:hover {
		border-color: var(--color-primary);
	}

	.mode-card.selected {
		border-color: var(--color-primary);
		background: var(--color-primary-bg);
	}

	.mode-card h3 {
		font-size: var(--text-lg);
		font-weight: 600;
		margin-bottom: var(--space-1);
	}

	.mode-card > p {
		color: var(--color-text-muted);
		font-size: var(--text-sm);
		margin-bottom: var(--space-3);
	}

	.mode-card ul {
		list-style: none;
		padding: 0;
	}

	.mode-card li {
		font-size: var(--text-sm);
		color: var(--color-text-muted);
		padding: var(--space-1) 0;
		padding-left: var(--space-4);
		position: relative;
	}

	.mode-card li::before {
		content: '\2022';
		position: absolute;
		left: var(--space-1);
		color: var(--color-primary);
	}

	.gender-toggle {
		margin-bottom: var(--space-6);
	}

	.toggle-row {
		display: flex;
		gap: var(--space-2);
	}

	.actions {
		display: flex;
		gap: var(--space-3);
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

	@media (max-width: 640px) {
		.mode-cards {
			grid-template-columns: 1fr;
		}
	}
</style>
