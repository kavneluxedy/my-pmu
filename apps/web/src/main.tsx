import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.js";
import Dashboard from "./pages/Dashboard.js";
import Bets from "./pages/Bets.js";
import Horses from "./pages/Horses.js";
import Simulator from "./pages/Simulator.js";
import ImportPmu from "./pages/ImportPmu.js";
import Arrivees from "./pages/Arrivees.js";
import "./styles.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "bets", element: <Bets /> },
      { path: "horses", element: <Horses /> },
      { path: "simulator", element: <Simulator /> },
      { path: "import", element: <ImportPmu /> },
      { path: "arrivees", element: <Arrivees /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
