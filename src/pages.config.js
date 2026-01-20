import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import EtsyActivity from './pages/EtsyActivity';
import Expenses from './pages/Expenses';
import Fees from './pages/Fees';
import Inventory from './pages/Inventory';
import Jobs from './pages/Jobs';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Quotes from './pages/Quotes';
import ReconciliationReview from './pages/ReconciliationReview';
import Tools from './pages/Tools';
import Welcome from './pages/Welcome';
import Production from './pages/Production';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Customers": Customers,
    "Dashboard": Dashboard,
    "EtsyActivity": EtsyActivity,
    "Expenses": Expenses,
    "Fees": Fees,
    "Inventory": Inventory,
    "Jobs": Jobs,
    "Orders": Orders,
    "Products": Products,
    "Quotes": Quotes,
    "ReconciliationReview": ReconciliationReview,
    "Tools": Tools,
    "Welcome": Welcome,
    "Production": Production,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};