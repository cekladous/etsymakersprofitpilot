import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Jobs from './pages/Jobs';
import Materials from './pages/Materials';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Tools from './pages/Tools';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Expenses": Expenses,
    "Jobs": Jobs,
    "Materials": Materials,
    "Orders": Orders,
    "Products": Products,
    "Tools": Tools,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};