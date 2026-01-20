import CustomSales from './pages/CustomSales';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import Production from './pages/Production';
import Products from './pages/Products';
import Quotes from './pages/Quotes';
import Tools from './pages/Tools';
import Welcome from './pages/Welcome';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CustomSales": CustomSales,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "Expenses": Expenses,
    "Inventory": Inventory,
    "Orders": Orders,
    "Production": Production,
    "Products": Products,
    "Quotes": Quotes,
    "Tools": Tools,
    "Welcome": Welcome,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};