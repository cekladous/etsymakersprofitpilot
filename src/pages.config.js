import Calculator from './pages/Calculator';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Jobs from './pages/Jobs';
import Materials from './pages/Materials';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Calculator": Calculator,
    "Dashboard": Dashboard,
    "Expenses": Expenses,
    "Jobs": Jobs,
    "Materials": Materials,
    "Orders": Orders,
    "Products": Products,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};