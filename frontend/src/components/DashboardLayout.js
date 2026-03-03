import React from 'react';
import Sidebar from './Sidebar';

const DashboardLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#030712]">
      <Sidebar />
      <div className="ml-64">
        {children}
      </div>
    </div>
  );
};

export default DashboardLayout;