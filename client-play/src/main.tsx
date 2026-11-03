import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { ConsentBanner } from './ConsentBanner';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles.css';
import './arcade.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <App />
    <ConsentBanner />
  </StrictMode>,
);
