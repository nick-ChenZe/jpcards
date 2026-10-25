import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {applyPaperTheme, readPaperTheme} from './lib/paperTheme';
import './fonts/fonts.css';
import './index.css';
import './styles/hiyori.css';

applyPaperTheme(readPaperTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
