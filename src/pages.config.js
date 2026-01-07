import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Jobs from './pages/Jobs';
import Materials from './pages/Materials';
import MonthlySummary from './pages/MonthlySummary';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Tools from './pages/Tools';
import Inventory from './pages/Inventory';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Expenses": Expenses,
    "Jobs": Jobs,
    "Materials": Materials,
    "MonthlySummary": MonthlySummary,
    "Orders": Orders,
    "Products": Products,
    "Tools": Tools,
    "Inventory": Inventory,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};