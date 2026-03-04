<script lang="ts">
	import { onMount } from 'svelte';
	import { pipeline } from '$lib/state.svelte';

	let copied = $state(false);
	let extensionDetected = $state(false);
	let promptSent = $state(false);

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

	function sendToAI() {
		window.dispatchEvent(new CustomEvent('PUPILSAFE_SEND_PROMPT', {
			detail: { prompt: pipeline.prompt }
		}));
		promptSent = true;
		setTimeout(() => promptSent = false, 3000);
	}

	onMount(() => {
		const handleExtensionReady = () => { extensionDetected = true; };
		window.addEventListener('PUPILSAFE_EXTENSION_READY', handleExtensionReady);

		const handleResponse = (event: CustomEvent) => {
			pipeline.aiResponse = event.detail.response;
		};
		window.addEventListener('PUPILSAFE_RESPONSE_RECEIVED', handleResponse as EventListener);

		return () => {
			window.removeEventListener('PUPILSAFE_EXTENSION_READY', handleExtensionReady);
			window.removeEventListener('PUPILSAFE_RESPONSE_RECEIVED', handleResponse as EventListener);
		};
	});
</script>

<div class="split-view">
	<h2>Step 6: Copy prompt, paste AI response</h2>

	<div class="panels">
		<div class="panel">
			<div class="panel-header">
				<h3>Your prompt</h3>
				<div class="header-actions">
					{#if extensionDetected}
						<span class="extension-badge">Extension connected</span>
					{/if}
					<button class="btn btn-sm btn-primary" onclick={copyPrompt}>
						{copied ? 'Copied!' : 'Copy prompt'}
					</button>
				</div>
			</div>
			<pre class="prompt-text">{pipeline.prompt}</pre>

			<div class="ai-links">
				<span class="ai-links-label">Open in:</span>
				<a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary">ChatGPT</a>
				<a href="https://claude.ai" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary">Claude</a>
				<a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary">Gemini</a>
			</div>

			{#if extensionDetected}
				<button class="btn btn-primary extension-send-btn" onclick={sendToAI}>
					{promptSent ? 'Sent!' : 'Send to AI'}
				</button>
			{/if}
		</div>

		<div class="panel">
			<div class="panel-header">
				<h3>AI response</h3>
			</div>
			<label for="ai-response" class="sr-only">AI response</label>
			<textarea
				id="ai-response"
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

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.extension-badge {
		font-size: var(--text-xs);
		color: var(--color-success, #22c55e);
		font-weight: 500;
		padding: 2px 8px;
		border: 1px solid var(--color-success, #22c55e);
		border-radius: var(--radius-full, 9999px);
	}

	.extension-send-btn {
		margin-top: var(--space-2);
		width: 100%;
	}

	@media (max-width: 768px) {
		.panels {
			grid-template-columns: 1fr;
		}
	}
</style>
