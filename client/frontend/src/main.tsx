import './style.css';
import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';

document.addEventListener('contextmenu', (e) => {
  const target = e.target as HTMLElement;
  if (target.closest('.allow-context-menu')) return;
  e.preventDefault();
});

const container = document.getElementById('root');

const root = createRoot(container!);

root.render(
    <React.StrictMode>
        <App/>
    </React.StrictMode>
);
