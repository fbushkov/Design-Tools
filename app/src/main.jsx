import React from 'react';
import { createRoot } from 'react-dom/client';
import { HeroUIProvider, ToastProvider } from '@heroui/react';
import { AppProvider } from './state.jsx';
import App from './App.jsx';
import './styles.css';
import { startTypograf } from './lib/typograf.js';

startTypograf();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HeroUIProvider locale="ru-RU">
      <ToastProvider placement="bottom-right" />
      <AppProvider>
        <App />
      </AppProvider>
    </HeroUIProvider>
  </React.StrictMode>
);
