<svelte:head>
	<title>How it works — PupilSafe AI</title>
</svelte:head>

<div class="container page">
	<h1>How it works</h1>
	<p class="intro">PupilSafe AI has three layers that work together: Shield (anonymise), Prompt (ask AI), and Translate (de-anonymise).</p>

	<section class="layer">
		<div class="layer-header">
			<div class="layer-number">1</div>
			<h2>Shield — Anonymise your data</h2>
		</div>
		<p>When you paste your class data, PupilSafe:</p>
		<ul>
			<li><strong>Detects column types</strong> automatically — names, scores, categories, free text, dates, and sensitive identifiers like UPN, DOB, and postcode.</li>
			<li><strong>Replaces real names</strong> with realistic fake names from a UK-diverse name bank. Each student gets a unique ID token like [S01], [S02] that survives the AI round-trip.</li>
			<li><strong>Scans free-text fields</strong> for student names, medical terms, safeguarding language, dates, postcodes, phone numbers, and email addresses.</li>
			<li><strong>Checks re-identification risk</strong> using k-anonymity. If a student has a unique combination of attributes (e.g. the only EAL boy with SEN), PupilSafe warns you.</li>
		</ul>

		<div class="card mode-compare">
			<h3>Two privacy modes</h3>
			<div class="modes-grid">
				<div>
					<h4>Accurate</h4>
					<p>Names changed. Scores unchanged. Best for report writing and detailed analysis where exact marks matter.</p>
				</div>
				<div>
					<h4>Anonymous</h4>
					<p>Names changed + statistical noise added to scores. Scores stay within grade bands. Best for sensitive data, small cohorts, and EHCP/LAC columns.</p>
				</div>
			</div>
		</div>
	</section>

	<section class="layer">
		<div class="layer-header">
			<div class="layer-number">2</div>
			<h2>Prompt — Ask the AI</h2>
		</div>
		<p>PupilSafe generates a complete prompt that includes:</p>
		<ul>
			<li>Your anonymised data as a CSV block</li>
			<li>A task description based on your template choice and answers</li>
			<li><strong>Five standard instructions</strong> that ensure the AI preserves student IDs, uses full names, and outputs in a structured format</li>
			<li>For analysis templates: a JSON schema for structured output</li>
		</ul>
		<p>You copy the prompt and paste it into ChatGPT, Claude, or Gemini. The AI only ever sees fake names.</p>
	</section>

	<section class="layer">
		<div class="layer-header">
			<div class="layer-number">3</div>
			<h2>Translate — De-anonymise the response</h2>
		</div>
		<p>When you paste the AI's response back, PupilSafe:</p>
		<ul>
			<li><strong>Matches ID tokens</strong> like [S01] to real student names (primary key)</li>
			<li><strong>Matches fake names</strong> as a fallback — handling variations like "STUDENT: Rowan Ashworth", table rows, possessives ("Rowan's"), and all-caps</li>
			<li><strong>Handles JSON responses</strong> from analysis templates — walking the full structure and replacing IDs and names in every field</li>
			<li><strong>Reports match stats</strong> — how many ID matches, name matches, and any unmatched tokens for you to review</li>
		</ul>
		<p>The result: real student names in a polished AI output, with zero data exposure.</p>
	</section>

	<section class="cta-section">
		<a href="/app" class="btn btn-primary btn-lg">Try it now</a>
	</section>
</div>

<style>
	.page {
		padding: var(--space-12) 0;
		max-width: 48rem;
	}

	h1 {
		font-size: var(--text-3xl);
		font-weight: 700;
		margin-bottom: var(--space-2);
	}

	.intro {
		font-size: var(--text-lg);
		color: var(--color-text-muted);
		margin-bottom: var(--space-10);
		line-height: 1.6;
	}

	.layer {
		margin-bottom: var(--space-12);
	}

	.layer-header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-bottom: var(--space-4);
	}

	.layer-number {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		background: var(--color-primary);
		color: white;
		border-radius: 50%;
		font-weight: 700;
		font-size: var(--text-lg);
		flex-shrink: 0;
	}

	h2 {
		font-size: var(--text-xl);
		font-weight: 600;
	}

	h3 {
		font-size: var(--text-base);
		font-weight: 600;
		margin-bottom: var(--space-3);
	}

	h4 {
		font-weight: 600;
		margin-bottom: var(--space-1);
	}

	p {
		color: var(--color-text-muted);
		line-height: 1.8;
		margin-bottom: var(--space-3);
	}

	ul {
		padding-left: var(--space-6);
		color: var(--color-text-muted);
		line-height: 2;
		margin-bottom: var(--space-4);
	}

	.mode-compare {
		margin-top: var(--space-4);
	}

	.modes-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
	}

	.modes-grid p {
		font-size: var(--text-sm);
	}

	.cta-section {
		text-align: center;
		padding: var(--space-8) 0;
	}

	@media (max-width: 640px) {
		.modes-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
