import { headers } from "next/headers";
import { getTenantByKey, getAllTenants } from "@/tenants/config";

export default async function HomePage() {
  const headersList = await headers();
  const tenantKey = headersList.get("x-tenant-key") || "emlak";
  const tenant = getTenantByKey(tenantKey);

  if (!tenant) {
    // Admin domain or unknown — show platform overview
    const tenants = getAllTenants();
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h1 className="text-5xl font-bold text-center mb-4">UPU Platform</h1>
          <p className="text-xl text-center text-indigo-200 mb-16">AI Destekli Sanal Eleman Platformu</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tenants.map((t) => (
              <div key={t.key} className="bg-white/10 backdrop-blur rounded-2xl p-6 hover:bg-white/20 transition">
                <div className="text-4xl mb-3">{t.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{t.name}</h3>
                <p className="text-indigo-200 text-sm">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Tenant-specific marketing page
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <div className="text-6xl mb-4">{tenant.icon}</div>
          <h1 className="text-4xl font-bold mb-4">{tenant.name}</h1>
          <p className="text-xl text-slate-300">{tenant.description}</p>
        </div>

        {tenant.employees.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tenant.employees.map((emp) => (
              <div key={emp.key} className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
                <div className="text-3xl mb-2">{emp.icon}</div>
                <h3 className="text-lg font-semibold mb-1">{emp.name}</h3>
                <p className="text-slate-400 text-sm mb-3">{emp.description}</p>
                <div className="flex flex-wrap gap-1">
                  {emp.commands.slice(0, 4).map((cmd) => (
                    <span key={cmd} className="text-xs bg-white/10 rounded-full px-2 py-0.5">{cmd}</span>
                  ))}
                  {emp.commands.length > 4 && (
                    <span className="text-xs text-slate-500">+{emp.commands.length - 4}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
