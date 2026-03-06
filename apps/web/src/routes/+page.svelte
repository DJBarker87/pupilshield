<svelte:head>
	<title>PupilSafe AI — Use AI with student data safely</title>
</svelte:head>

<div class="landing">
	<section class="hero">
		<div class="container">
			<h1>Paste your marksheet. Get intervention groups and report comments in 60 seconds.</h1>
			<p class="hero-sub">
				PupilSafe anonymises student data before it reaches any AI assistant.
				Real names never leave your browser.
			</p>
			<div class="hero-actions">
				<a href="/app" class="btn btn-primary btn-lg">Try it now — free</a>
				<a href="/sample-dataset.csv" download class="btn btn-secondary btn-lg">Download sample data</a>
			</div>
		</div>
	</section>

	<section class="before-after container">
		<h2>What the AI sees vs. what you get back</h2>
		<div class="ba-grid">
			<div class="ba-panel card">
				<h3>AI receives (anonymised)</h3>
				<pre class="ba-code">Name,Gender,Score (%),Attendance (%)
<span class="fake">Rowan Ashworth</span> [S01],M,72,94
<span class="fake">Priya Kaur</span> [S02],F,58,82
<span class="fake">Declan Foster</span> [S03],M,65,91</pre>
			</div>
			<div class="ba-arrow">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M5 12h14M12 5l7 7-7 7"/>
				</svg>
			</div>
			<div class="ba-panel card">
				<h3>You get back (real names)</h3>
				<pre class="ba-code">STUDENT: <span class="real">James Chen</span>
Score: 72% | Attendance: 94%
James shows strong analytical skills...

STUDENT: <span class="real">Aisha Rahman</span>
Score: 58% | Attendance: 82%
Aisha would benefit from...</pre>
			</div>
		</div>
	</section>

	<section class="steps container">
		<h2>Three steps. Sixty seconds.</h2>
		<div class="steps-grid">
			<div class="step-card card">
				<div class="step-number">1</div>
				<h3>Shield</h3>
				<p>Paste or upload your class data. PupilSafe replaces real names with fake ones and (optionally) adds noise to scores. Sensitive terms in free-text fields are flagged and redacted.</p>
			</div>
			<div class="step-card card">
				<div class="step-number">2</div>
				<h3>Prompt</h3>
				<p>Pick a task — report comments, class analysis, or differentiated questions. PupilSafe builds a prompt with the anonymised data and instructions that keep student IDs intact.</p>
			</div>
			<div class="step-card card">
				<div class="step-number">3</div>
				<h3>Translate</h3>
				<p>Paste the AI's response back. PupilSafe matches ID tokens and fake names, then swaps them for the real ones. Done — real student output with zero data exposure.</p>
			</div>
		</div>
	</section>

	<section class="features container">
		<h2>Built for UK secondary schools</h2>
		<div class="features-grid">
			<div class="feature">
				<h3>Designed for data protection</h3>
				<p>No student data leaves your browser. No server, no database, no logs. Helps you comply with GDPR.</p>
			</div>
			<div class="feature">
				<h3>Two privacy modes</h3>
				<p>Names Only mode changes names only. Names + Noise mode also adds statistical noise — ideal for sensitive cohorts or small groups.</p>
			</div>
			<div class="feature">
				<h3>Works with any AI</h3>
				<p>ChatGPT, Claude, Gemini — copy the prompt into whichever you prefer. The de-anonymiser handles all output formats.</p>
			</div>
			<div class="feature">
				<h3>Smart detection</h3>
				<p>Automatically classifies columns, flags sensitive content in comments, and warns about re-identification risks before you send anything.</p>
			</div>
			<div class="feature">
				<h3>UK MIS aware</h3>
				<p>Recognises common columns from SIMS, Arbor, Bromcom exports: UPN, SEN, PP, EAL, KS2, FFT, CAT, and more.</p>
			</div>
			<div class="feature">
				<h3>Free templates</h3>
				<p>Three ready-to-use prompt templates: report comments, class analysis, and differentiated questions. No prompt engineering needed.</p>
			</div>
		</div>
	</section>

	<section class="trust container">
		<div class="trust-card card">
			<h2>Your data never leaves your browser</h2>
			<p>PupilSafe is a static site with zero backend. All anonymisation and de-anonymisation runs as client-side JavaScript. You can verify this yourself — open DevTools, check the Network tab, and watch zero requests leave your machine.</p>
			<a href="/privacy" class="btn btn-secondary">Read our privacy page</a>
		</div>
	</section>

	<section class="cta container">
		<h2>Ready to save time?</h2>
		<p>Try it with our sample dataset — 22 fictitious students with realistic data.</p>
		<a href="/app" class="btn btn-primary btn-lg">Open PupilSafe AI</a>
	</section>
</div>

<style>
	.landing {
		padding-bottom: var(--space-16);
	}

	/* Hero */
	.hero {
		padding: var(--space-16) 0;
		text-align: center;
		background: linear-gradient(180deg, var(--color-primary-bg) 0%, var(--color-bg) 100%);
	}

	.hero h1 {
		font-size: var(--text-3xl);
		font-weight: 700;
		line-height: 1.3;
		margin-bottom: var(--space-4);
		max-width: 40rem;
		margin-left: auto;
		margin-right: auto;
	}

	.hero-sub {
		font-size: var(--text-lg);
		color: var(--color-text-muted);
		margin-bottom: var(--space-8);
		line-height: 1.6;
		max-width: 36rem;
		margin-left: auto;
		margin-right: auto;
	}

	.hero-actions {
		display: flex;
		gap: var(--space-4);
		justify-content: center;
		flex-wrap: wrap;
	}

	/* Before/after */
	.before-after {
		padding: var(--space-16) 0 var(--space-12);
	}

	.before-after h2 {
		text-align: center;
		font-size: var(--text-2xl);
		font-weight: 600;
		margin-bottom: var(--space-8);
	}

	.ba-grid {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: var(--space-4);
		align-items: center;
	}

	.ba-panel h3 {
		font-size: var(--text-sm);
		font-weight: 600;
		margin-bottom: var(--space-3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
	}

	.ba-code {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.ba-code .fake {
		color: var(--color-primary);
		font-weight: 600;
	}

	.ba-code .real {
		color: var(--color-success);
		font-weight: 600;
	}

	.ba-arrow {
		color: var(--color-text-light);
	}

	/* Steps */
	.steps {
		padding: var(--space-12) 0;
	}

	.steps h2 {
		text-align: center;
		font-size: var(--text-2xl);
		font-weight: 600;
		margin-bottom: var(--space-8);
	}

	.steps-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: var(--space-6);
	}

	.step-card {
		text-align: center;
	}

	.step-number {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		background: var(--color-primary-light);
		color: var(--color-primary);
		border-radius: 50%;
		font-weight: 700;
		font-size: var(--text-lg);
		margin-bottom: var(--space-3);
	}

	.step-card h3 {
		font-size: var(--text-xl);
		font-weight: 600;
		margin-bottom: var(--space-2);
	}

	.step-card p {
		color: var(--color-text-muted);
		font-size: var(--text-sm);
		line-height: 1.6;
	}

	/* Features */
	.features {
		padding: var(--space-12) 0;
	}

	.features h2 {
		text-align: center;
		font-size: var(--text-2xl);
		font-weight: 600;
		margin-bottom: var(--space-8);
	}

	.features-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: var(--space-6);
	}

	.feature h3 {
		font-size: var(--text-base);
		font-weight: 600;
		margin-bottom: var(--space-1);
	}

	.feature p {
		color: var(--color-text-muted);
		font-size: var(--text-sm);
		line-height: 1.6;
	}

	/* Trust */
	.trust {
		padding: var(--space-8) 0;
	}

	.trust-card {
		text-align: center;
		max-width: 40rem;
		margin: 0 auto;
	}

	.trust-card h2 {
		font-size: var(--text-xl);
		font-weight: 600;
		margin-bottom: var(--space-2);
	}

	.trust-card p {
		color: var(--color-text-muted);
		font-size: var(--text-sm);
		line-height: 1.6;
		margin-bottom: var(--space-4);
	}

	/* CTA */
	.cta {
		text-align: center;
		padding: var(--space-12) 0;
	}

	.cta h2 {
		font-size: var(--text-2xl);
		font-weight: 600;
		margin-bottom: var(--space-2);
	}

	.cta p {
		color: var(--color-text-muted);
		margin-bottom: var(--space-6);
	}

	/* Responsive */
	@media (max-width: 640px) {
		.hero h1 {
			font-size: var(--text-2xl);
		}

		.hero-sub {
			font-size: var(--text-base);
		}

		.ba-grid {
			grid-template-columns: 1fr;
		}

		.ba-arrow {
			transform: rotate(90deg);
			text-align: center;
		}
	}
</style>
