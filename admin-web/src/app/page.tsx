'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AuthGate } from '@/components/admin/AuthGate';
import { ClientApp } from '@/components/client/ClientApp';

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const [viewMode, setViewMode] = useState<'client' | 'admin'>('client');

  if (!isAuthenticated || !user) {
    return <AuthGate />;
  }

  // Members always see the ConnectX client platform
  if (user.role === 'MEMBER') {
    return <ClientApp />;
  }

  // Administrators can seamlessly toggle between Admin Console and Client App
  if (viewMode === 'admin') {
    return <AdminDashboard onSwitchToClient={() => setViewMode('client')} />;
  }

  return <ClientApp onSwitchToAdmin={() => setViewMode('admin')} />;
}
