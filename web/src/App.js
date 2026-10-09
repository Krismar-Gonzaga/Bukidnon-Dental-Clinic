import HomePage from './pages/HomePage';
import FindClinicsPage from './pages/FindClinicsPage';
import DentistsPage from './pages/DentistsPage';
import ServicesPage from './pages/ServicesPage';

// TEMPORARY path switch until a router is approved and added.
const PAGES_BY_PATH = {
  '/clinics': FindClinicsPage,
  '/dentists': DentistsPage,
  '/services': ServicesPage,
};

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const Page = PAGES_BY_PATH[path] ?? HomePage;
  return <Page />;
}

export default App;
