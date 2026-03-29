// TASKK MOBILE
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboardIcon, CheckSquareIcon, FolderOpenIcon, MoreHorizontalIcon, UsersIcon, BarChart3, SettingsIcon, XIcon } from 'lucide-react';
import useUserRole from '../hooks/useUserRole';

const BottomTabBar = () => {
    const [moreOpen, setMoreOpen] = useState(false);
    const { isAdmin, canViewReports, canManageMembers } = useUserRole();
    const navigate = useNavigate();

    const tabs = [
        { name: 'Home', href: '/', icon: LayoutDashboardIcon, exact: true },
        { name: 'My Tasks', href: '/myTasks', icon: CheckSquareIcon },
        { name: 'Projects', href: '/projects', icon: FolderOpenIcon },
    ];

    const moreItems = [
        ...(canManageMembers ? [{ name: 'Team', href: '/team', icon: UsersIcon }] : []),
        ...(canViewReports ? [{ name: 'Reports', href: '/reports', icon: BarChart3 }] : []),
        ...(isAdmin ? [{ name: 'Settings', href: '/settings', icon: SettingsIcon }] : []),
    ];

    const handleMoreNav = (href) => {
        setMoreOpen(false);
        navigate(href);
    };

    return (
        <>
            {/* More sheet overlay */}
            {moreOpen && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 59 }}
                    onClick={() => setMoreOpen(false)}
                />
            )}

            {/* More slide-up sheet */}
            {moreOpen && (
                <div style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 60,
                    background: 'var(--color-background-primary)',
                    borderTop: '1px solid var(--color-border-tertiary)',
                    borderRadius: '16px 16px 0 0',
                    paddingBottom: 'calc(64px + env(safe-area-inset-bottom))',
                    paddingTop: '12px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 8px' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>More</span>
                        <button onClick={() => setMoreOpen(false)} style={{ color: 'var(--color-text-secondary)', padding: 4 }}>
                            <XIcon size={18} />
                        </button>
                    </div>
                    {moreItems.length > 0 ? moreItems.map(item => (
                        <button
                            key={item.href}
                            onClick={() => handleMoreNav(item.href)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                width: '100%',
                                padding: '14px 20px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 14,
                                color: 'var(--color-text-primary)',
                                textAlign: 'left',
                            }}
                        >
                            <item.icon size={18} />
                            {item.name}
                        </button>
                    )) : (
                        <p style={{ padding: '16px 20px', fontSize: 13, color: 'var(--color-text-tertiary)' }}>No additional items</p>
                    )}
                </div>
            )}

            {/* Bottom tab bar */}
            <div style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: 'calc(56px + env(safe-area-inset-bottom))',
                paddingBottom: 'env(safe-area-inset-bottom)',
                background: 'var(--color-background-primary)',
                borderTop: '1px solid var(--color-border-tertiary)',
                display: 'flex',
                alignItems: 'stretch',
                zIndex: 50,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
            }}>
                {tabs.map(tab => (
                    <NavLink
                        key={tab.href}
                        to={tab.href}
                        end={tab.exact}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textDecoration: 'none', minHeight: 44 }}
                    >
                        {({ isActive }) => (
                            <>
                                <tab.icon size={20} color={isActive ? '#3b82f6' : 'var(--color-text-tertiary)'} />
                                <span style={{ fontSize: 10, color: isActive ? '#3b82f6' : 'var(--color-text-tertiary)', fontWeight: isActive ? 600 : 400 }}>
                                    {tab.name}
                                </span>
                            </>
                        )}
                    </NavLink>
                ))}

                {/* More button */}
                <button
                    onClick={() => setMoreOpen(v => !v)}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', minHeight: 44 }}
                >
                    <MoreHorizontalIcon size={20} color={moreOpen ? '#3b82f6' : 'var(--color-text-tertiary)'} />
                    <span style={{ fontSize: 10, color: moreOpen ? '#3b82f6' : 'var(--color-text-tertiary)', fontWeight: moreOpen ? 600 : 400 }}>More</span>
                </button>
            </div>
        </>
    );
};

export default BottomTabBar;
