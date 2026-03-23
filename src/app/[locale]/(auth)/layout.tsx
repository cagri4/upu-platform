import { headers } from "next/headers";
import { getTenantByKey } from "@/tenants/config";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const tenantKey = headersList.get("x-tenant-key") || "emlak";
  const tenant = getTenantByKey(tenantKey);

  const name = tenant?.name || "UPU Platform";
  const icon = tenant?.icon || "🚀";
  const desc = tenant?.description || "AI destekli sanal eleman platformu";

  return (
    <div className="min-h-screen flex">
      {/* Left: Brand panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 to-indigo-900 text-white flex-col justify-center items-center p-12">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-6">{icon}</div>
          <h1 className="text-3xl font-bold mb-4">{name}</h1>
          <p className="text-slate-300 text-lg">{desc}</p>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile: show brand */}
          <div className="lg:hidden text-center mb-8">
            <span className="text-4xl">{icon}</span>
            <h1 className="text-xl font-bold mt-2">{name}</h1>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
