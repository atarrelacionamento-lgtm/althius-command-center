import { DashboardLayout } from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";

export default function PlaceholderPage() {
  const location = useLocation();
  const pageName = location.pathname.slice(1).charAt(0).toUpperCase() + location.pathname.slice(2);

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[60vh]"
      >
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <span className="text-2xl">🚧</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{pageName}</h1>
        <p className="text-muted-foreground text-sm">This page is under construction.</p>
      </motion.div>
    </DashboardLayout>
  );
}
