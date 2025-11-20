import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: "default" | "warning" | "success" | "enriched" | "destructive";
}

export const StatsCard = ({ title, value, icon: Icon, variant = "default" }: StatsCardProps) => {
  const variantStyles = {
    default: "text-foreground",
    warning: "text-warning",
    success: "text-success",
    enriched: "text-enriched",
    destructive: "text-destructive",
  };

  const bgStyles = {
    default: "bg-muted",
    warning: "bg-warning/10",
    success: "bg-success/10",
    enriched: "bg-enriched/10",
    destructive: "bg-destructive/10",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-full ${bgStyles[variant]}`}>
          <Icon className={`w-4 h-4 ${variantStyles[variant]}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${variantStyles[variant]}`}>{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
};
