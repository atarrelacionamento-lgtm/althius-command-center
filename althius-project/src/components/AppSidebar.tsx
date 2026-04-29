import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Settings,
  HelpCircle,
  GitBranch,
  ChevronLeft,
  ChevronRight,
  Rocket,
  CalendarDays,
  Plug,
  Users,
  Building2,
  Briefcase,
  Workflow,
  MessageSquare,
  LineChart,
  ShieldCheck,
  Target
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'Operacional',
    items: [
      { title: "Missão do Dia",  url: "/hoje",       icon: Target },
      { title: "Comunicações",   url: "/mensagens",  icon: MessageSquare },
      { title: "Cronograma",     url: "/calendario", icon: CalendarDays },
      { title: "Comando",        url: "/dashboard",  icon: LayoutDashboard },
    ],
  },
  {
    label: 'Sistemas',
    items: [
      { title: "Agentes",  url: "/crm/contatos",  icon: Users },
      { title: "Alvos",    url: "/crm/empresas",  icon: Building2 },
      { title: "Propulsão", url: "/crm/negocios",  icon: Briefcase },
    ],
  },
  {
    label: 'Comando',
    items: [
      { title: "Funis",       url: "/funis",       icon: GitBranch, adminOnly: true },
      { title: "Sistemas",    url: "/integracoes", icon: ShieldCheck, adminOnly: true },
      { title: "Cadências",   url: "/sequencias",  icon: Workflow,  adminOnly: true },
    ],
  },
];

const supportItems: NavItem[] = [
  { title: "Configurações", url: "/settings", icon: Settings },
  { title: "Ajuda",         url: "/help",     icon: HelpCircle },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { isAdmin } = useAuth();

  const isActive = (url: string) => location.pathname === url || location.pathname.startsWith(`${url}/`);

  const renderItem = (item: NavItem) => (
    <Link
      key={item.title}
      to={item.url}
      className={`sidebar-item ${isActive(item.url) ? "sidebar-item-active" : ""}`}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            className="truncate"
          >
            {item.title}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );

  const renderSection = (section: NavSection) => {
    const visible = section.items.filter((item) => !item.adminOnly || isAdmin);
    if (visible.length === 0) return null;
    return (
      <div key={section.label}>
        {section.label && !collapsed && (
          <p className="text-[11px] font-semibold uppercase tracking-wider px-3 mb-2 text-muted-foreground/50">
            {section.label}
          </p>
        )}
        <div className="space-y-0.5">{visible.map(renderItem)}</div>
      </div>
    );
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="h-screen sticky top-0 flex flex-col shrink-0 overflow-hidden bg-sidebar"
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16">
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <div className="h-8 w-8 rounded-none bg-primary flex items-center justify-center">
              <Rocket className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-primary tracking-tighter">ALTHIUS</span>
              <span className="text-[10px] font-bold uppercase text-primary/60 tracking-widest">Command</span>
            </div>
          </motion.div>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded-none bg-primary flex items-center justify-center mx-auto">
            <Rocket className="h-4 w-4 text-primary-foreground" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
        {navSections.map(renderSection)}

        <div>
          {!collapsed && (
            <p className="text-[11px] font-semibold uppercase tracking-wider px-3 mb-2 text-muted-foreground/50">
              Suporte
            </p>
          )}
          <div className="space-y-0.5">
            {supportItems.map(renderItem)}
          </div>
        </div>
      </nav>
    </motion.aside>
  );
}
