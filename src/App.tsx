import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Trades from "./pages/Trades";
import Clients from "./pages/Clients";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="trades" element={<Trades />} />
          <Route path="clients" element={<Clients />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
