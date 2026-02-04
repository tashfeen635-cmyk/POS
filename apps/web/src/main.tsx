import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { initializeApp, registerServiceWorker } from './lib/init';
import { logger } from './lib/logging/logger';
import './index.css';

// Configure React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Initialize app
async function bootstrap() {
  try {
    // Register service worker for PWA
    await registerServiceWorker();

    // Initialize all app systems
    await initializeApp();

    logger.info('App bootstrapped successfully');
  } catch (error) {
    logger.error('Bootstrap failed', { error: (error as Error).message });
    console.error('Failed to initialize app:', error);
  }
}

// Start bootstrap
bootstrap();

// Render app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

// Handle app shutdown
window.addEventListener('beforeunload', () => {
  logger.flush();
});
