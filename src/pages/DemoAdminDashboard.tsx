import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import { useSaas } from '@/contexts/SaasContext';

const DemoAdminDashboard = () => {
  const { slug } = useParams<{ slug: string }>();
  const { tenants, currentTenant, setCurrentTenant } = useSaas();
  const demoTenant = tenants.find((tenant) =>
    tenant.id.startsWith('tenant-') && tenant.slug === slug
  );

  useEffect(() => {
    if (demoTenant && currentTenant?.id !== demoTenant.id) {
      setCurrentTenant(demoTenant);
    }
  }, [currentTenant?.id, demoTenant, setCurrentTenant]);

  if (!demoTenant) return <Navigate to="/" replace />;

  if (currentTenant?.id !== demoTenant.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <AdminDashboard demoMode />;
};

export default DemoAdminDashboard;
