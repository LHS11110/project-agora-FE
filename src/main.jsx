import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from './routing.jsx';
import { AuthProvider } from './state/AuthContext.jsx';
import App from './App.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
