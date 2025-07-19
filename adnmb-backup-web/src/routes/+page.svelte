<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import SvelteMarkdown from '@humanspeak/svelte-markdown';
	import { onMount } from 'svelte';
	import { formatDisplayTime } from '$lib/utils/time-utils';

	// Thread interface
	interface CachedThread {
		id: string;
		title: string;
		replyCount: number;
		author: string;
		lastReplyTime: string;
	}

	// State management
	let threadId = '';
	let loading = false;
	let message = '';
	let messageTimeout: ReturnType<typeof setTimeout> | undefined;

	// Cached threads
	let cachedThreads: CachedThread[] = [];
	let loadingCache = false;
	let sortBy = 'lastReply'; // 'lastReply' or 'threadId'

	// Markdown viewer options
	let viewingMarkdown = '';
	let markdownMode = 'all';
	let markdownContent = '';
	let markdownLoading = false;

	// Set message with auto-hide for success messages
	function setMessage(msg: string, isSuccess: boolean = false) {
		message = msg;
		if (messageTimeout) {
			clearTimeout(messageTimeout);
		}
		if (isSuccess) {
			messageTimeout = setTimeout(() => {
				message = '';
			}, 3000); // Hide success messages after 3 seconds
		}
	}

	// Sort cached threads
	function sortCachedThreads() {
		if (sortBy === 'lastReply') {
			cachedThreads.sort(
				(a, b) => new Date(b.lastReplyTime).getTime() - new Date(a.lastReplyTime).getTime()
			);
		} else if (sortBy === 'threadId') {
			cachedThreads.sort((a, b) => parseInt(a.id) - parseInt(b.id));
		}
		cachedThreads = [...cachedThreads]; // Trigger reactivity
	}

	// Load cached threads (just reload the cache list)
	async function loadCachedThreads() {
		loadingCache = true;
		try {
			const response = await fetch('/api/cache');
			const data = await response.json();
			cachedThreads = data.cached || [];
			sortCachedThreads();
		} catch (error) {
			console.error('Error loading cached threads:', error);
		} finally {
			loadingCache = false;
		}
	}

	// New threads discovered during refresh
	let newThreadsFound: { id: string; title: string; replyCount: number; userHash: string }[] = [];
	let showNewThreads = false;

	// Refresh all cached threads from remote API
	async function refreshAllCachedThreads() {
		loadingCache = true;
		setMessage('正在刷新所有缓存...');

		try {
			const response = await fetch('/api/refresh-all', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			const data = await response.json();

			if (response.ok) {
				let message = data.message;

				// 检查是否发现了新串
				if (data.newThreadsFound && data.newThreadsFound.length > 0) {
					newThreadsFound = data.newThreadsFound;
					showNewThreads = true;
					message += ` | 发现 ${data.newThreadsFound.length} 个新串`;
				}

				// 显示 Feed 信息
				if (data.feedInfo) {
					message += ` | Feed UUID: ${data.feedInfo.uuid}...`;
				}

				setMessage(message, true);
				// Reload the cache list after refreshing
				await loadCachedThreads();
			} else {
				setMessage(`刷新失败: ${data.message}`);
			}
		} catch (error) {
			setMessage(`刷新失败: ${error instanceof Error ? error.message : '未知错误'}`);
		} finally {
			loadingCache = false;
		}
	}

	// 新发现串
	async function backupNewThread(threadId: string) {
		try {
			setMessage(`正在备份新串 ${threadId}...`);

			const response = await fetch('/api/backup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ threadId })
			});

			if (response.ok) {
				setMessage(`新串 ${threadId} 备份成功`, true);
				// Remove the thread from new threads list
				newThreadsFound = newThreadsFound.filter((t) => t.id !== threadId);
				if (newThreadsFound.length === 0) {
					showNewThreads = false;
				}
				// Reload cached threads
				await loadCachedThreads();
			} else {
				const error = await response.json();
				setMessage(`备份新串 ${threadId} 失败: ${error.message}`);
			}
		} catch (error) {
			setMessage(`备份失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	}

	// Close new threads panel
	function closeNewThreads() {
		showNewThreads = false;
		newThreadsFound = [];
	}

	// Backup thread function
	async function backupThread() {
		if (!threadId.trim()) {
			setMessage('请输入串号');
			return;
		}

		loading = true;
		setMessage('正在备份...');

		try {
			const response = await fetch('/api/backup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ threadId: threadId.trim() })
			});

			if (response.ok) {
				setMessage(`备份 ${threadId} 成功`, true);
				threadId = '';
				// Reload cached threads
				await loadCachedThreads();
			} else {
				const error = await response.json();
				setMessage(`备份 ${threadId} 失败: ${error.message}`);
			}
		} catch (error) {
			setMessage(`备份失败: ${error instanceof Error ? error.message : '未知错误'}`);
		} finally {
			loading = false;
		}
	}

	// Refresh single cached thread
	function refreshSingleThread(id: string) {
		threadId = id;
		backupThread();
	}

	// Download file with specific format and mode
	async function downloadWithFormat(threadId: string, formatMode: string) {
		if (!formatMode) return; // No option selected

		const [format, mode] = formatMode.split('-');

		try {
			const response = await fetch('/api/download', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					threadId: threadId,
					format: format,
					mode: mode
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

				setMessage(`下载成功: ${data.filename}`, true);
			} else {
				setMessage(`下载失败: ${data.error}`);
			}
		} catch (error) {
			setMessage(`下载失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}

		// Reset the select back to default
		const selectElement = document.querySelector(
			`select[onchange*="${threadId}"]`
		) as HTMLSelectElement;
		if (selectElement) {
			selectElement.value = '';
		}
	}

	// Load markdown content for viewing
	async function loadMarkdownContent(threadId: string, mode: string = 'all') {
		markdownLoading = true;
		markdownContent = '';
		viewingMarkdown = threadId;
		markdownMode = mode;

		try {
			const response = await fetch('/api/download', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					threadId: threadId,
					format: 'markdown',
					mode: mode
				})
			});

			const data = await response.json();

			if (response.ok) {
				markdownContent = data.content;
				setMessage('加载成功', true);
			} else {
				setMessage(`加载失败: ${data.error}`);
				viewingMarkdown = '';
			}
		} catch (error) {
			setMessage(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
			viewingMarkdown = '';
		} finally {
			markdownLoading = false;
		}
	}

	// Close markdown viewer
	function closeMarkdownViewer() {
		viewingMarkdown = '';
		markdownContent = '';
	}

	// Load cached threads on client only
	onMount(() => {
		loadCachedThreads();
	});
</script>

<div class="bg-background min-h-screen">
	<div class="container mx-auto max-w-6xl p-6">
		<!-- Header -->
		<div class="mb-8 text-center">
			<h1 class="text-foreground mb-2 text-4xl font-bold">AdnmbBackup</h1>
			<p class="text-muted-foreground">匿名版备份工具</p>
		</div>

		<!-- Message display -->
		{#if message}
			<div class="bg-card border-border mb-6 rounded-lg border p-4">
				<p class="text-card-foreground">{message}</p>
			</div>
		{/if}

		<!-- Backup Section -->
		<Card.Root class="mb-6">
			<Card.Header>
				<Card.Title>备份新串</Card.Title>
			</Card.Header>
			<Card.Content>
				<Input
					id="thread-id"
					bind:value={threadId}
					placeholder="请输入串号开始备份，例如: 52752005"
					disabled={loading}
				/>
			</Card.Content>
			<Card.Footer>
				<Button onclick={backupThread} disabled={loading || !threadId.trim()} class="w-full">
					{loading ? '备份中...' : '开始备份'}
				</Button>
			</Card.Footer>
		</Card.Root>

		<!-- New Threads Discovered Section -->
		{#if showNewThreads && newThreadsFound.length > 0}
			<Card.Root class="mb-6 border-green-200 bg-green-50">
				<Card.Header>
					<div class="flex items-center justify-between">
						<div>
							<Card.Title class="text-green-800">发现新串</Card.Title>
							<Card.Description class="text-green-600">
								在刷新过程中发现了 {newThreadsFound.length} 个新串，您可以选择备份它们
							</Card.Description>
						</div>
						<Button variant="outline" size="sm" onclick={closeNewThreads} class="text-green-700">
							关闭
						</Button>
					</div>
				</Card.Header>
				<Card.Content>
					<div class="space-y-3">
						{#each newThreadsFound as newThread (newThread.id)}
							<div
								class="flex items-center justify-between rounded-lg border border-green-200 bg-white p-3"
							>
								<div class="flex-1">
									<div class="flex items-center gap-2">
										<span class="font-mono text-sm text-green-700">#{newThread.id}</span>
										<span class="font-medium">
											{newThread.title === '无标题' || !newThread.title
												? `串号: ${newThread.id}`
												: newThread.title}
										</span>
									</div>
									<div class="mt-1 text-sm text-green-600">
										回复数: {newThread.replyCount} | 作者: {newThread.userHash}
									</div>
								</div>
								<Button
									variant="outline"
									size="sm"
									onclick={() => backupNewThread(newThread.id)}
									class="ml-4 border-green-300 text-green-700 hover:bg-green-100"
								>
									备份
								</Button>
							</div>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>
		{/if}

		<!-- Cached Threads Section -->
		<Card.Root>
			<Card.Header>
				<div class="flex flex-row items-center justify-between">
					<div>
						<Card.Title>已缓存的串</Card.Title>
						<Card.Description>查看、阅读和下载已缓存的串</Card.Description>
					</div>
					<div class="flex items-center gap-3">
						<Button variant="outline" onclick={loadCachedThreads} disabled={loadingCache}>
							{loadingCache ? '加载中...' : '重新加载'}
						</Button>
						<Button variant="outline" onclick={refreshAllCachedThreads} disabled={loadingCache}>
							{loadingCache ? '刷新中...' : '刷新缓存'}
						</Button>
					</div>
				</div>
				<div class="mt-4 flex items-center gap-4">
					<Label>排序方式:</Label>
					<div class="flex gap-3">
						<div class="flex items-center space-x-2">
							<input
								type="radio"
								id="sort-last-reply"
								value="lastReply"
								bind:group={sortBy}
								onchange={sortCachedThreads}
								class="h-4 w-4"
							/>
							<label for="sort-last-reply" class="text-sm font-medium">按最近更新</label>
						</div>
						<div class="flex items-center space-x-2">
							<input
								type="radio"
								id="sort-thread-id"
								value="threadId"
								bind:group={sortBy}
								onchange={sortCachedThreads}
								class="h-4 w-4"
							/>
							<label for="sort-thread-id" class="text-sm font-medium">按串号排序</label>
						</div>
					</div>
				</div>
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
					<div class="overflow-x-auto">
						<table class="w-full border-collapse">
							<thead>
								<tr class="border-border border-b">
									<th class="px-4 py-3 text-left font-medium">标题</th>
									<th class="px-4 py-3 text-left font-medium">串号</th>
									<th class="px-4 py-3 text-left font-medium">回复数</th>
									<th class="px-4 py-3 text-left font-medium">作者</th>
									<th class="px-4 py-3 text-left font-medium">最近更新</th>
									<th class="px-4 py-3 text-left font-medium">操作</th>
								</tr>
							</thead>
							<tbody>
								{#each cachedThreads as thread (thread.id)}
									<tr class="border-border hover:bg-muted/50 border-b transition-colors">
										<td class="px-4 py-3">
											<div class="flex items-center gap-2">
												<span class="font-medium">
													{thread.title === '无标题' ? `串号: ${thread.id}` : thread.title}
												</span>
											</div>
										</td>
										<td class="text-muted-foreground px-4 py-3">{thread.id}</td>
										<td class="text-muted-foreground px-4 py-3">{thread.replyCount}</td>
										<td class="text-muted-foreground px-4 py-3">{thread.author}</td>
										<td class="text-muted-foreground px-4 py-3 text-sm"
											>{formatDisplayTime(thread.lastReplyTime)}</td
										>
										<td class="px-4 py-3">
											<div class="flex gap-2">
												<Button
													variant="outline"
													size="sm"
													onclick={() => refreshSingleThread(thread.id)}
												>
													刷新
												</Button>
												<Button
													variant="outline"
													size="sm"
													onclick={() => loadMarkdownContent(thread.id, 'all')}
													disabled={markdownLoading}
												>
													{markdownLoading && viewingMarkdown === thread.id ? '加载中...' : '阅读'}
												</Button>
												<select
													onchange={(e) => {
														const target = e.target as HTMLSelectElement;
														if (target) {
															downloadWithFormat(thread.id, target.value);
														}
													}}
													class="border-border bg-background rounded border px-2 py-1 text-sm"
												>
													<option value="">下载</option>
													<option value="text-all">文本(全部)</option>
													<option value="text-po">文本(PO)</option>
													<option value="markdown-all">Markdown(全部)</option>
													<option value="markdown-po">Markdown(PO)</option>
												</select>
											</div>
										</td>
									</tr>
									{#if viewingMarkdown === thread.id}
										<tr>
											<td colspan="6" class="bg-muted/30 px-4 py-4">
												<div class="mb-3 flex items-center justify-between">
													<div class="flex items-center gap-4">
														<Label>显示模式:</Label>
														<div class="flex gap-3">
															<div class="flex items-center space-x-2">
																<input
																	type="radio"
																	id="markdown-mode-all-{thread.id}"
																	value="all"
																	bind:group={markdownMode}
																	onchange={() => loadMarkdownContent(thread.id, 'all')}
																	class="h-4 w-4"
																/>
																<label
																	for="markdown-mode-all-{thread.id}"
																	class="text-sm font-medium">全部回复</label
																>
															</div>
															<div class="flex items-center space-x-2">
																<input
																	type="radio"
																	id="markdown-mode-po-{thread.id}"
																	value="po"
																	bind:group={markdownMode}
																	onchange={() => loadMarkdownContent(thread.id, 'po')}
																	class="h-4 w-4"
																/>
																<label
																	for="markdown-mode-po-{thread.id}"
																	class="text-sm font-medium">仅PO回复</label
																>
															</div>
														</div>
													</div>
													<Button variant="outline" size="sm" onclick={closeMarkdownViewer}>
														关闭
													</Button>
												</div>

												{#if markdownContent}
													<div
														class="bg-background border-border max-h-96 overflow-y-auto rounded-lg border p-4"
													>
														<div class="prose prose-sm dark:prose-invert max-w-none">
															<SvelteMarkdown source={markdownContent} />
														</div>
													</div>
												{:else if markdownLoading}
													<div class="py-8 text-center">
														<p class="text-muted-foreground">正在加载Markdown内容...</p>
													</div>
												{/if}
											</td>
										</tr>
									{/if}
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
