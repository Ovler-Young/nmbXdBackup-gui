<script lang="ts">
	let threadId = '';
	let loading = false;
	let message = '';

	async function backup() {
		if (!threadId) {
			message = '请输入串号';
			return;
		}
		loading = true;
		message = '正在备份...';
		const response = await fetch(`/api/backup`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ threadId })
		});
		loading = false;
		if (response.ok) {
			message = `备份 ${threadId} 成功`;
		} else {
			const error = await response.json();
			message = `备份 ${threadId} 失败: ${error.message}`;
		}
	}
</script>

<h1>AdnmbBackup</h1>

<div>
	<input type="text" bind:value={threadId} placeholder="请输入串号" />
	<button on:click={backup} disabled={loading}>备份</button>
</div>

{#if message}
	<p>{message}</p>
{/if}
