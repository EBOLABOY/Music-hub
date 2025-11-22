import { NavLink } from 'react-router-dom';
import { Home, Search, Library, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
    const navItems = [
        { icon: Home, label: 'Home', href: '/', end: true },
        { icon: Search, label: 'Search', href: '/search' },
        { icon: Library, label: 'Library', href: '/library' },
        { icon: Download, label: 'Downloads', href: '/downloads' },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-gray-200/50 dark:bg-black/80 dark:border-white/10 pb-safe">
            <nav className="flex items-center justify-around h-16">
                {navItems.map((item) => (
                    <NavLink
                        key={item.href}
                        to={item.href}
                        end={item.end}
                        className={({ isActive }) =>
                            cn(
                                "flex flex-col items-center justify-center w-full h-full gap-1 text-[10px] font-medium transition-colors",
                                isActive
                                    ? "text-primary"
                                    : "text-muted-foreground hover:text-foreground"
                            )
                        }
                    >
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>
        </div>
    );
}
