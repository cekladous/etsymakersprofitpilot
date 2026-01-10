import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Inventory from './pages/Inventory';
import Jobs from './pages/Jobs';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Tools from './pages/Tools';
import NameTagGenerator from './pages/NameTagGenerator';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Expenses": Expenses,
    "Inventory": Inventory,
    "Jobs": Jobs,
    "Orders": Orders,
    "Products": Products,
    "Tools": Tools,
    "NameTagGenerator": NameTagGenerator,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};