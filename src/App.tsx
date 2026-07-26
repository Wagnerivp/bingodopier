/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Setup from './pages/Setup';
import CustomerLogin from './pages/CustomerLogin';
import CustomerDashboard from './pages/CustomerDashboard';
import TVDisplay from './pages/TVDisplay';
import AdminLogin from './pages/AdminLogin';
import AdminPanel from './pages/AdminPanel';

export default function App() {
  if (!supabase) {
    return <Setup />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-yellow-500/30 font-sans relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#3d3010_0%,transparent_60%)] opacity-40 pointer-events-none fixed"></div>
        <div className="relative z-10 min-h-screen flex flex-col">
          <Routes>
            <Route path="/" element={<CustomerLogin />} />
            <Route path="/dashboard" element={<CustomerDashboard />} />
            <Route path="/tv" element={<TVDisplay />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/panel" element={<AdminPanel />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
