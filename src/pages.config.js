import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Inventory from './pages/Inventory';
import Jobs from './pages/Jobs';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Quotes from './pages/Quotes';
import Tools from './pages/Tools';
import ReconciliationReview from './pages/ReconciliationReview';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Customers": Customers,
    "Dashboard": Dashboard,
    "Expenses": Expenses,
    "Inventory": Inventory,
    "Jobs": Jobs,
    "Orders": Orders,
    "Products": Products,
    "Quotes": Quotes,
    "Tools": Tools,
    "ReconciliationReview": ReconciliationReview,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};