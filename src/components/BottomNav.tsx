import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/analysis', label: 'Analysis', icon: '📊' },
  { href: '/employees', label: 'Employees', icon: '👥' },
  { href: '/suppliers', label: 'Suppliers', icon: '🏢' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow z-50 flex justify-around py-2">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center text-xs px-2 py-1 transition-colors duration-150 ${
            pathname === item.href ? 'text-blue-600' : 'text-gray-500'
          }`}
        >
          <span className="text-lg">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
