import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import initializeServices from './services/initializer.ts'

// Initialize services when the app starts
initializeServices();

createRoot(document.getElementById("root")!).render(<App />);
