import { AppProvider } from './context/AppContext';
import { AppLayout } from './components/layout/AppLayout';
import './styles/theme.css';
import './styles/layout.css';

function App() {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
}

export default App;
