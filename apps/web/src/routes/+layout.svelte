<script>
	import '../lib/styles.css';

	let { children } = $props();
</script>

<div class="app-shell">
	<nav class="nav">
		<div class="container nav-inner">
			<a href="/" class="nav-brand">
				<span class="nav-logo">PS</span>
				<span class="nav-title">PupilSafe AI</span>
			</a>
			<div class="nav-links">
				<a href="/how-it-works">How it works</a>
				<a href="/app" class="btn btn-primary btn-sm">Open tool</a>
			</div>
		</div>
	</nav>

	<main class="main">
		{@render children()}
	</main>

	<footer class="footer">
		<div class="container footer-inner">
			<p>PupilSafe AI — All processing happens in your browser. No student data is sent to any server.</p>
			<div class="footer-links">
				<a href="/privacy">Privacy</a>
				<a href="/how-it-works">How it works</a>
			</div>
		</div>
	</footer>
</div>

<style>
	.app-shell {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.nav {
		height: var(--nav-height);
		border-bottom: 1px solid var(--color-border-light);
		background: white;
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.nav-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 100%;
	}

	.nav-brand {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		text-decoration: none;
		color: var(--color-text);
	}

	.nav-logo {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		background: var(--color-primary);
		color: white;
		border-radius: var(--radius-md);
		font-weight: 700;
		font-size: var(--text-sm);
	}

	.nav-title {
		font-weight: 600;
		font-size: var(--text-lg);
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	.nav-links a {
		text-decoration: none;
		color: var(--color-text-muted);
		font-size: var(--text-sm);
		font-weight: 500;
	}

	.nav-links a:hover {
		color: var(--color-text);
	}

	.main {
		flex: 1;
	}

	.footer {
		border-top: 1px solid var(--color-border-light);
		padding: var(--space-6) 0;
		margin-top: var(--space-12);
		color: var(--color-text-muted);
		font-size: var(--text-sm);
	}

	.footer-inner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-4);
	}

	.footer-links {
		display: flex;
		gap: var(--space-4);
	}

	.footer-links a {
		text-decoration: none;
		color: var(--color-text-muted);
	}

	.footer-links a:hover {
		color: var(--color-text);
	}
</style>
