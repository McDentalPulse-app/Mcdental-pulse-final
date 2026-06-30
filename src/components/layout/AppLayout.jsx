import React, { Suspense } from "react";
import { Routes } from "react-router-dom";
import Sidebar from "./Sidebar";
import Loader from "../ui/Loader";

const AppLayout = ({ children }) => (
  <div className="app-shell">
    <Sidebar />
    <main className="app-main">
      <div className="app-main-inner">
        <Suspense fallback={<Loader />}>
          <Routes>{children}</Routes>
        </Suspense>
      </div>
    </main>
  </div>
);

export default AppLayout;
