import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Inventory from './pages/Inventory';
import Jobs from './pages/Jobs';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Tools from './pages/Tools';
import Quotes from './pages/Quotes';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Expenses": Expenses,
    "Inventory": Inventory,
    "Jobs": Jobs,
    "Orders": Orders,
    "Products": Products,
    "Tools": Tools,
    "Quotes": Quotes,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};