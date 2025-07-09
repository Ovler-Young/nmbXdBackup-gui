<script lang="ts">
    let threadId = '';
    let cookie = '';
    let proxy = '';
    let status = 'No task';
    let loading = false;

    async function startBackup() {
        if (!threadId) {
            alert('Please enter a thread ID.');
            return;
        }
        if (!cookie) {
            alert('Please enter your cookie.');
            return;
        }

        loading = true;
        status = 'Backing up...';

        const response = await fetch('/api/backup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ threadId, cookie, proxy }),
        });

        loading = false;
        const result = await response.json();
        status = result.message;
    }
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">A岛匿名版备份器</h1>

    <div class="mb-4">
        <label for="threadId" class="block text-sm font-medium text-gray-700">串号 (id)</label>
        <input type="text" id="threadId" bind:value={threadId} class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
    </div>

    <div class="mb-4">
        <label for="cookie" class="block text-sm font-medium text-gray-700">饼干 (cookie)</label>
        <input type="text" id="cookie" bind:value={cookie} class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
    </div>

    <div class="mb-4">
        <label for="proxy" class="block text-sm font-medium text-gray-700">代理 (proxy)</label>
        <input type="text" id="proxy" bind:value={proxy} class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Optional, e.g. https://api.example.com" />
    </div>

    <div class="flex items-center justify-between">
        <button on:click={startBackup} disabled={loading} class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
            {loading ? 'Backing up...' : '开始备份！'}
        </button>
        <div class="text-sm text-gray-500">{status}</div>
    </div>

    <div class="mt-4 text-sm text-gray-500">
        <p>
            <a href="https://www.coldthunder11.com/index.php/2020/03/19/%e5%a6%82%e4%bd%95%e8%8e%b7%e5%8f%96a%e5%b2%9b%e7%9a%84%e9%a5%bc%e5%b9%b2/" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:underline">如何拿到饼干</a>
        </p>
        <p>
            <a href="https://github.com/Ovler-Young/AdnmbBackup-gui" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:underline">项目地址</a>
        </p>
    </div>
</div>