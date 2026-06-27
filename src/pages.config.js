import Checkout from './pages/Checkout';
import CustomSales from './pages/CustomSales';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Invoices from './pages/Invoices';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import Production from './pages/Production';
import Products from './pages/Products';
import Reports from './pages/Reports';
import PromoCodeManager from './pages/PromoCodeManager';
import Quotes from './pages/Quotes';
import Settings from './pages/Settings';
import Tools from './pages/Tools';
import Welcome from './pages/Welcome';
import __Layout from './Layout.jsx';


export const PAGES = {
  "Checkout": Checkout,
  "CustomSales": CustomSales,
  "Customers": Customers,
  "Dashboard": Dashboard,
  "Expenses": Expenses,
  "Invoices": Invoices,
  "Inventory": Inventory,
  "Orders": Orders,
  "Production": Production,
  "Products": Products,
  "PromoCodeManager": PromoCodeManager,
  "Quotes": Quotes,
  "Reports": Reports,
  "Settings": Settings,
  "Tools": Tools,
  "Welcome": Welcome,
}

export const pagesConfig = {
  mainPage: "Welcome",
  Pages: PAGES,
  Layout: __Layout,
};