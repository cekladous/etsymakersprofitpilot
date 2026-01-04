import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Jobs from './pages/Jobs';
import Materials from './pages/Materials';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Orders": Orders,
    "Products": Products,
    "Jobs": Jobs,
    "Materials": Materials,
    "Expenses": Expenses,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};