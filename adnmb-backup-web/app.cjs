const { pathToFileURL } = require('url');
const path = require('path');

// Function to start the server
async function startServer() {
	try {
		// Import the ES module server using pathToFileURL
		const indexPath = path.join(__dirname, 'build', 'index.js');
		const serverModule = await import(pathToFileURL(indexPath));
		console.log('SvelteKit server started successfully!');

		// The server starts automatically when the module is imported
		// We can access the server instance if needed: serverModule.server
	} catch (error) {
		console.error('Failed to start server:', error);
		process.exit(1);
	}
}

// Start the server
startServer();
