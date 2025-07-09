<script lang="ts">
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import '../app.css';

	// Import UI components (will be available after shadcn-svelte installation)
	let Button: any, Card: any, Input: any, Label: any, Select: any, Tabs: any, Separator: any;

	onMount(async () => {
		try {
			const buttonModule = await import('$lib/components/ui/button/index.js');
			const cardModule = await import('$lib/components/ui/card/index.js');
			const inputModule = await import('$lib/components/ui/input/index.js');
			const labelModule = await import('$lib/components/ui/label/index.js');
			const selectModule = await import('$lib/components/ui/select/index.js');
			const tabsModule = await import('$lib/components/ui/tabs/index.js');
			const separatorModule = await import('$lib/components/ui/separator/index.js');

			Button = buttonModule.Button;
			Card = cardModule;
			Input = inputModule.Input;
			Label = labelModule.Label;
			Select = selectModule;
			Tabs = tabsModule;
			Separator = separatorModule.Separator;
		} catch (error) {
			console.error('Error loading components:', error);
		}
	});

	// State management
	let threadId = '';
	let loading = false;
	let message = '';
	let activeTab = 'backup';

	// Cached threads
	let cachedThreads: any[] = [];
	let loadingCache = false;

	// Download options
	let selectedThread = '';
	let downloadFormat = 'text';
	let downloadMode = 'all';
	let downloadLoading = false;

	// Load cached threads
	async function loadCachedThreads() {
		loadingCache = true;
		try {
			const response = await fetch('/api/cache');
			const data = await response.json();
			cachedThreads = data.cached || [];
		} catch (error) {
			console.error('Error loading cached threads:', error);
		} finally {
			loadingCache = false;
		}
	}

	// Backup thread function
	async function backupThread() {
		if (!threadId.trim()) {
			message = '请输入串号';
			return;
		}

		loading = true;
		message = '正在备份...';

		try {
			const response = await fetch('/api/backup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ threadId: threadId.trim() })
			});

			if (response.ok) {
				message = `备份 ${threadId} 成功`;
				threadId = '';
				// Reload cached threads
				await loadCachedThreads();
			} else {
				const error = await response.json();
				message = `备份 ${threadId} 失败: ${error.message}`;
			}
		} catch (error) {
			message = `备份失败: ${error instanceof Error ? error.message : '未知错误'}`;
		} finally {
			loading = false;
		}
	}

	// Re-add cached thread to backup queue
	function reAddThread(id: string) {
		threadId = id;
		activeTab = 'backup';
	}

	// Download file
	async function downloadFile() {
		if (!selectedThread) {
			message = '请选择要下载的串';
			return;
		}

		downloadLoading = true;

		try {
			const response = await fetch('/api/download', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					threadId: selectedThread,
					format: downloadFormat,
					mode: downloadMode
				})
			});

			const data = await response.json();

			if (response.ok) {
				// Create download link
				const blob = new Blob([data.content], { type: 'text/plain' });
				const url = URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.href = url;
				link.download = data.filename;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				URL.revokeObjectURL(url);

				message = `下载成功: ${data.filename}`;
			} else {
				message = `下载失败: ${data.error}`;
			}
		} catch (error) {
			message = `下载失败: ${error instanceof Error ? error.message : '未知错误'}`;
		} finally {
			downloadLoading = false;
		}
	}

	// Format date
	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleString('zh-CN');
	}

	// Load cached threads on mount
	onMount(() => {
		loadCachedThreads();
	});
</script>

<div class="bg-background min-h-screen">
	<div class="container mx-auto max-w-6xl p-6">
		<!-- Header -->
		<div class="mb-8 text-center">
			<h1 class="text-foreground mb-2 text-4xl font-bold">AdnmbBackup</h1>
			<p class="text-muted-foreground">匿名版备份工具 - 简单、快速、可靠</p>
		</div>

		<!-- Message display -->
		{#if message}
			<div class="bg-card border-border mb-6 rounded-lg border p-4">
				<p class="text-card-foreground">{message}</p>
			</div>
		{/if}

		<!-- Main content -->
		{#if Tabs}
			<Tabs.Root bind:value={activeTab} class="w-full">
				<Tabs.List class="grid w-full grid-cols-3">
					<Tabs.Trigger value="backup">备份串</Tabs.Trigger>
					<Tabs.Trigger value="cache">已缓存</Tabs.Trigger>
					<Tabs.Trigger value="download">下载文件</Tabs.Trigger>
				</Tabs.List>

				<!-- Backup Tab -->
				<Tabs.Content value="backup" class="mt-6">
					{#if Card}
						<Card.Root>
							<Card.Header>
								<Card.Title>备份新串</Card.Title>
								<Card.Description>输入串号开始备份</Card.Description>
							</Card.Header>
							<Card.Content class="space-y-4">
								{#if Label && Input}
									<div class="space-y-2">
										<Label for="thread-id">串号</Label>
										<Input
											id="thread-id"
											bind:value={threadId}
											placeholder="请输入串号，例如: 12345678"
											disabled={loading}
										/>
									</div>
								{/if}
							</Card.Content>
							<Card.Footer>
								{#if Button}
									<Button
										on:click={backupThread}
										disabled={loading || !threadId.trim()}
										class="w-full"
									>
										{loading ? '备份中...' : '开始备份'}
									</Button>
								{/if}
							</Card.Footer>
						</Card.Root>
					{/if}
				</Tabs.Content>

				<!-- Cache Tab -->
				<Tabs.Content value="cache" class="mt-6">
					{#if Card}
						<Card.Root>
							<Card.Header class="flex flex-row items-center justify-between">
								<div>
									<Card.Title>已缓存的串</Card.Title>
									<Card.Description>查看和重新添加已缓存的串</Card.Description>
								</div>
								{#if Button}
									<Button variant="outline" on:click={loadCachedThreads} disabled={loadingCache}>
										{loadingCache ? '加载中...' : '刷新'}
									</Button>
								{/if}
							</Card.Header>
							<Card.Content>
								{#if loadingCache}
									<div class="py-8 text-center">
										<p class="text-muted-foreground">加载中...</p>
									</div>
								{:else if cachedThreads.length === 0}
									<div class="py-8 text-center">
										<p class="text-muted-foreground">暂无缓存数据</p>
									</div>
								{:else}
									<div class="space-y-4">
										{#each cachedThreads as thread}
											<div
												class="border-border hover:bg-muted/50 rounded-lg border p-4 transition-colors"
											>
												<div class="flex items-start justify-between">
													<div class="flex-1">
														<h3 class="text-card-foreground font-semibold">
															{thread.title === '无标题' ? `串号: ${thread.id}` : thread.title}
														</h3>
														<div class="text-muted-foreground mt-1 space-y-1 text-sm">
															<p>串号: {thread.id}</p>
															<p>回复数: {thread.replyCount}</p>
															<p>作者: {thread.author}</p>
															<p>缓存时间: {formatDate(thread.cachedAt)}</p>
															{#if thread.hasImage}
																<span
																	class="bg-primary/10 text-primary inline-flex items-center rounded-full px-2 py-1 text-xs"
																>
																	有图片
																</span>
															{/if}
														</div>
													</div>
													{#if Button}
														<Button
															variant="outline"
															size="sm"
															on:click={() => reAddThread(thread.id)}
														>
															重新备份
														</Button>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</Card.Content>
						</Card.Root>
					{/if}
				</Tabs.Content>

				<!-- Download Tab -->
				<Tabs.Content value="download" class="mt-6">
					{#if Card}
						<Card.Root>
							<Card.Header>
								<Card.Title>下载文件</Card.Title>
								<Card.Description>选择格式和模式下载已缓存的串</Card.Description>
							</Card.Header>
							<Card.Content class="space-y-6">
								<!-- Thread Selection -->
								{#if Label && Select}
									<div class="space-y-2">
										<Label>选择串</Label>
										{#if cachedThreads.length > 0}
											<select
												bind:value={selectedThread}
												class="border-border bg-background w-full rounded-md border p-2"
											>
												<option value="">请选择要下载的串</option>
												{#each cachedThreads as thread}
													<option value={thread.id}>
														{thread.title === '无标题'
															? `串号: ${thread.id}`
															: `${thread.title} (${thread.id})`}
													</option>
												{/each}
											</select>
										{:else}
											<p class="text-muted-foreground text-sm">暂无可下载的串，请先备份一些串</p>
										{/if}
									</div>
								{/if}

								{#if Separator}
									<Separator />
								{/if}

								<!-- Format Selection -->
								{#if Label}
									<div class="space-y-3">
										<Label>文件格式</Label>
										<div class="grid grid-cols-2 gap-3">
											<div class="flex items-center space-x-2">
												<input
													type="radio"
													id="format-text"
													bind:group={downloadFormat}
													value="text"
													class="h-4 w-4"
												/>
												<label for="format-text" class="text-sm font-medium">文本 (.txt)</label>
											</div>
											<div class="flex items-center space-x-2">
												<input
													type="radio"
													id="format-markdown"
													bind:group={downloadFormat}
													value="markdown"
													class="h-4 w-4"
												/>
												<label for="format-markdown" class="text-sm font-medium"
													>Markdown (.md)</label
												>
											</div>
										</div>
									</div>
								{/if}

								<!-- Mode Selection -->
								{#if Label}
									<div class="space-y-3">
										<Label>下载模式</Label>
										<div class="grid grid-cols-2 gap-3">
											<div class="flex items-center space-x-2">
												<input
													type="radio"
													id="mode-all"
													bind:group={downloadMode}
													value="all"
													class="h-4 w-4"
												/>
												<label for="mode-all" class="text-sm font-medium">全部回复</label>
											</div>
											<div class="flex items-center space-x-2">
												<input
													type="radio"
													id="mode-po"
													bind:group={downloadMode}
													value="po"
													class="h-4 w-4"
												/>
												<label for="mode-po" class="text-sm font-medium">仅PO回复</label>
											</div>
										</div>
									</div>
								{/if}
							</Card.Content>
							<Card.Footer>
								{#if Button}
									<Button
										on:click={downloadFile}
										disabled={downloadLoading || !selectedThread}
										class="w-full"
									>
										{downloadLoading ? '生成中...' : '下载文件'}
									</Button>
								{/if}
							</Card.Footer>
						</Card.Root>
					{/if}
				</Tabs.Content>
			</Tabs.Root>
		{:else}
			<!-- Fallback for when components are loading -->
			<div class="py-8 text-center">
				<p class="text-muted-foreground">加载组件中...</p>
			</div>
		{/if}
	</div>
</div>
