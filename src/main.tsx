import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';
import './ui/rpg-ui.css';
import './ui/space-backdrop.css';
import './ui/neon-cursor.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
