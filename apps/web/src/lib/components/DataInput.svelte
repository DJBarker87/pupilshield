<script lang="ts">
	import Papa from 'papaparse';
	import { pipeline } from '$lib/state.svelte';
	import { Shield } from '@djb/shield';

	let textValue = $state('');
	let error = $state('');
	let fileInput: HTMLInputElement;

	function parseAndDetect(csv: string) {
		error = '';

		const result = Papa.parse(csv.trim(), {
			header: false,
			skipEmptyLines: true,
		});

		if (result.errors.length > 0) {
			error = `CSV parse error: ${result.errors[0].message}`;
			return;
		}

		const rows = result.data as string[][];
		if (rows.length < 2) {
			error = 'Need at least a header row and one data row.';
			return;
		}

		const headers = rows[0];
		const dataRows = rows.slice(1);

		pipeline.rawInput = csv;
		pipeline.parsedData = { headers, rows: dataRows };

		// Detect columns using Shield
		const shield = new Shield({ mode: pipeline.mode, seed: pipeline.seed });
		const detected = shield.detectColumns(headers, dataRows);
		pipeline.detected = detected.columns;
		pipeline.currentStep = 'columns';
	}

	function handlePaste() {
		if (!textValue.trim()) {
			error = 'Please paste some CSV data.';
			return;
		}
		parseAndDetect(textValue);
	}

	function handleFileUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = () => {
			const csv = reader.result as string;
			textValue = csv;
			parseAndDetect(csv);
		};
		reader.onerror = () => {
			error = 'Failed to read file.';
		};
		reader.readAsText(file);
	}

	function loadSampleData() {
		const sampleCsv = `Name,Gender,SEN,PP,EAL,Score (%),Attendance (%),Comments
James Chen,M,No,No,No,72,94,James's sister Emily also struggled with this topic
Aisha Rahman,F,K,Yes,Yes,58,82,Has been absent due to hospital appointments for epilepsy treatment
Connor Murphy,M,No,No,No,65,91,Missed the assessment due to the residential trip to Snowdonia
Priya Kapoor,F,No,No,No,78,96,As discussed with Mrs Patel in the review meeting
Oliver Thompson,M,EHCP,Yes,No,88,93,Excellent progress this term despite additional support needs
Keisha Campbell,F,No,Yes,No,45,74,Frequently late to lessons and missing homework deadlines
Rhys Davies,M,No,No,No,61,90,Behaviour has improved significantly since the incident on 15/03/2024
Sofia Martinez,F,No,No,Yes,70,95,His mother called to discuss progress
Ethan Williams,M,No,No,No,82,97,Consistently producing high-quality work
Fatima Al-Rashid,F,K,No,Yes,54,88,
Liam O'Brien,M,No,No,No,67,92,
Chloe Taylor,F,No,No,No,75,98,Good effort in group activities
Jayden Brown,M,No,Yes,No,42,85,Needs to focus more in class
Amara Okafor,F,No,No,No,79,94,
Callum Stewart,M,K,No,No,55,89,Working well with teaching assistant support
Megan Jones,F,No,No,No,83,96,
Zain Hussain,M,No,No,No,69,93,Shows good understanding in verbal responses
Lily Evans,F,No,Yes,No,48,87,Would benefit from attending homework club
Dylan Price,M,No,No,No,73,91,
Nia Thomas,F,No,No,No,86,99,Outstanding contribution to class discussions
Haruto Tanaka,M,No,No,Yes,77,95,
Isla MacLeod,F,No,No,No,64,92,Needs to revise key terminology before the exam`;
		textValue = sampleCsv;
		parseAndDetect(sampleCsv);
	}
</script>

<div class="data-input">
	<h2>Step 1: Paste or upload your class data</h2>
	<p class="hint">Paste a CSV from your MIS export, spreadsheet, or marksheet. Each row should be one student.</p>

	<div class="input-area">
		<label for="csv-input" class="sr-only">CSV data</label>
		<textarea
			id="csv-input"
			class="textarea"
			bind:value={textValue}
			placeholder="Name,Gender,SEN,PP,Score (%),Attendance (%),Comments&#10;James Chen,M,No,No,72,94,Good progress this term&#10;..."
			rows="12"
		></textarea>

		<div class="actions">
			<button class="btn btn-primary" onclick={handlePaste} disabled={!textValue.trim()}>
				Parse data
			</button>

			<span class="or">or</span>

			<button class="btn btn-secondary" onclick={() => fileInput.click()}>
				Upload CSV file
			</button>
			<input
				bind:this={fileInput}
				type="file"
				accept=".csv,.tsv,.txt"
				onchange={handleFileUpload}
				class="sr-only"
			/>

			<span class="or">or</span>

			<button class="btn btn-secondary" onclick={loadSampleData}>
				Load sample data
			</button>
		</div>
	</div>

	{#if error}
		<div class="error" role="alert">
			{error}
		</div>
	{/if}
</div>

<style>
	.data-input {
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

	.input-area {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.or {
		color: var(--color-text-light);
		font-size: var(--text-sm);
	}

	.error {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--color-danger-light);
		color: var(--color-danger);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
	}
</style>
