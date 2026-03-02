<script lang="ts">
	import { pipeline } from '$lib/state.svelte';

	let copied = $state(false);

	async function copyPrompt() {
		try {
			await navigator.clipboard.writeText(pipeline.prompt);
			copied = true;
			setTimeout(() => copied = false, 2000);
		} catch {
			// Fallback for older browsers
			const textarea = document.createElement('textarea');
			textarea.value = pipeline.prompt;
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
			copied = true;
			setTimeout(() => copied = false, 2000);
		}
	}

	function handlePaste() {
		if (!pipeline.aiResponse.trim()) return;
		pipeline.currentStep = 'output';
	}

	function goBack() {
		pipeline.currentStep = 'prompt';
	}
</script>

<div class="split-view">
	<h2>Step 6: Copy prompt, paste AI response</h2>

	<div class="panels">
		<div class="panel">
			<div class="panel-header">
				<h3>Your prompt</h3>
				<button class="btn btn-sm btn-primary" onclick={copyPrompt}>
					{copied ? 'Copied!' : 'Copy prompt'}
				</button>
			</div>
			<pre class="prompt-text">{pipeline.prompt}</pre>

			<div class="ai-links">
				<span class="ai-links-label">Open in:</span>
				<a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary">ChatGPT</a>
				<a href="https://claude.ai" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary">Claude</a>
				<a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary">Gemini</a>
			</div>
		</div>

		<div class="panel">
			<div class="panel-header">
				<h3>AI response</h3>
			</div>
			<textarea
				class="textarea response-area"
				bind:value={pipeline.aiResponse}
				placeholder="Paste the AI's response here..."
				rows="20"
			></textarea>

			<div class="actions">
				<button class="btn btn-secondary" onclick={goBack}>Back</button>
				<button class="btn btn-primary" onclick={handlePaste} disabled={!pipeline.aiResponse.trim()}>
					De-anonymise response
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.split-view {
		max-width: 72rem;
	}

	h2 {
		font-size: var(--text-xl);
		font-weight: 600;
		margin-bottom: var(--space-4);
	}

	.panels {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.panel-header h3 {
		font-size: var(--text-base);
		font-weight: 600;
	}

	.prompt-text {
		background: var(--color-bg-alt);
		border: 1px solid var(--color-border-light);
		border-radius: var(--radius-md);
		padding: var(--space-4);
		font-size: var(--text-xs);
		font-family: var(--font-mono);
		white-space: pre-wrap;
		word-break: break-word;
		overflow-y: auto;
		max-height: 28rem;
		line-height: 1.6;
	}

	.response-area {
		min-height: 20rem;
	}

	.ai-links {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.ai-links-label {
		font-size: var(--text-sm);
		color: var(--color-text-muted);
	}

	.actions {
		display: flex;
		gap: var(--space-3);
		justify-content: flex-end;
	}

	@media (max-width: 768px) {
		.panels {
			grid-template-columns: 1fr;
		}
	}
</style>
