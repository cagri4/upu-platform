'use client';

import { Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onMenuClick: () => void;
  userName?: string;
}

export function Header({ onMenuClick, userName }: HeaderProps) {
  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 shrink-0">
      <button onClick={onMenuClick} className="lg:hidden text-slate-600 hover:text-slate-900">
        <Menu size={22} />
      </button>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-3">
        {userName && <span className="text-sm text-slate-600">{userName}</span>}
        <Button variant="ghost" size="sm" onClick={() => { window.location.href = '/tr/login'; }}>
          <LogOut size={16} />
        </Button>
      </div>
    </header>
  );
}
