<svelte:head>
	<title>Privacy — PupilSafe AI</title>
</svelte:head>

<div class="container page">
	<h1>Privacy</h1>

	<section>
		<h2>Architecture: zero server, zero data</h2>
		<p>PupilSafe AI is a <strong>static site</strong>. There is no backend server, no database, no API. All code runs as client-side JavaScript in your browser.</p>
		<pre class="diagram">
  Your Browser                 AI Service (ChatGPT / Claude / Gemini)
  ┌─────────────────────────┐  ┌──────────────────────────────────────┐
  │                         │  │                                      │
  │  Real Data              │  │   Anonymised data only               │
  │  ↓                      │  │   (fake names, optional noise)       │
  │  PupilSafe (JS)         │  │                                      │
  │  ↓                      │  │   AI response (with fake names)      │
  │  Anonymised Data ───────│──│──→ You paste the prompt              │
  │                         │  │                                      │
  │  AI Response ←──────────│──│── You paste the response back        │
  │  ↓                      │  │                                      │
  │  PupilSafe (JS)         │  └──────────────────────────────────────┘
  │  ↓                      │
  │  De-anonymised output   │
  │  (real names restored)  │
  └─────────────────────────┘

  ✦ No data crosses from your browser to any PupilSafe server.
  ✦ You manually copy/paste between PupilSafe and the AI.
		</pre>
	</section>

	<section>
		<h2>Verify it yourself</h2>
		<ol>
			<li>Open your browser's DevTools (F12 or Cmd+Shift+I)</li>
			<li>Go to the <strong>Network</strong> tab</li>
			<li>Clear the log, then use PupilSafe normally</li>
			<li>Watch: the only requests are for static assets (JS, CSS, fonts). No student data is sent anywhere.</li>
		</ol>
	</section>

	<section>
		<h2>What data stays where</h2>
		<table class="data-table">
			<thead>
				<tr>
					<th>Data</th>
					<th>Where it lives</th>
					<th>When it's cleared</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td>Your original CSV data</td>
					<td>Browser memory only</td>
					<td>When you close/refresh the tab</td>
				</tr>
				<tr>
					<td>Anonymisation mapping</td>
					<td>Browser memory only</td>
					<td>When you close/refresh the tab</td>
				</tr>
				<tr>
					<td>Generated prompt</td>
					<td>Your clipboard (when you copy)</td>
					<td>When you copy something else</td>
				</tr>
				<tr>
					<td>AI response</td>
					<td>Browser memory only</td>
					<td>When you close/refresh the tab</td>
				</tr>
				<tr>
					<td>De-anonymised output</td>
					<td>Browser memory only</td>
					<td>When you close/refresh the tab</td>
				</tr>
			</tbody>
		</table>
	</section>

	<section>
		<h2>Works offline</h2>
		<p>After the initial page load, PupilSafe works entirely offline. No internet connection is needed for anonymisation, prompt generation, or de-anonymisation.</p>
	</section>

	<section>
		<h2>Analytics</h2>
		<p>PupilSafe does not use any analytics or tracking. No cookies, no pixels, no fingerprinting. We don't know who you are or what data you process.</p>
	</section>

	<section>
		<h2>Contact</h2>
		<p>If you have privacy concerns or questions, email <strong>privacy@pupilsafe.ai</strong>.</p>
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
		margin-bottom: var(--space-8);
	}

	section {
		margin-bottom: var(--space-10);
	}

	h2 {
		font-size: var(--text-xl);
		font-weight: 600;
		margin-bottom: var(--space-3);
	}

	p {
		color: var(--color-text-muted);
		line-height: 1.8;
		margin-bottom: var(--space-3);
	}

	ol {
		padding-left: var(--space-6);
		color: var(--color-text-muted);
		line-height: 2;
	}

	.diagram {
		background: var(--color-bg-alt);
		border: 1px solid var(--color-border-light);
		border-radius: var(--radius-md);
		padding: var(--space-4);
		font-size: var(--text-xs);
		font-family: var(--font-mono);
		overflow-x: auto;
		line-height: 1.5;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
		margin-top: var(--space-3);
	}

	.data-table th {
		text-align: left;
		padding: var(--space-2) var(--space-3);
		background: var(--color-bg-alt);
		font-weight: 600;
		border-bottom: 1px solid var(--color-border);
	}

	.data-table td {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--color-border-light);
		color: var(--color-text-muted);
	}
</style>
