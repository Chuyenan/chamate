'use client';

import { usePathname } from 'next/navigation';

const pageTitles: Record<string, string> = {
  '/': '对话',
  '/debate': '辩论',
  '/settings': '设置',
};

export function Header() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || 'Chamate';

  return (
    <header className="h-14 border-b border-border flex items-center px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}
