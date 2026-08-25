import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { HashRouter } from 'react-router-dom'
import { store } from './store'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './hooks/useToast'
import App from './App.tsx'
import './index.css'
import 'katex/dist/katex.min.css'

createRoot(document.getElementById('root')!).render(
    <Provider store={store}>
      <HashRouter>
        <ErrorBoundary>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ErrorBoundary>
      </HashRouter>
    </Provider>,
)
