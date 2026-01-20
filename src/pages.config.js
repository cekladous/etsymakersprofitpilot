import CustomSales from './pages/CustomSales';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import Production from './pages/Production';
import Products from './pages/Products';
import Quotes from './pages/Quotes';
import Settings from './pages/Settings';
import Tools from './pages/Tools';
import Welcome from './pages/Welcome';
import Checkout from './pages/Checkout';
import PromoCodeManager from './pages/PromoCodeManager';
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
    "Settings": Settings,
    "Tools": Tools,
    "Welcome": Welcome,
    "Checkout": Checkout,
    "PromoCodeManager": PromoCodeManager,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};