import { FileText, Clock, Share2, Trash2 } from 'lucide-react';
import { Document } from '@/hooks/useDocuments';

type Props = {
  documents: Document[];
};

export default function DashboardStats({ documents }: Props) {
  const total = documents.filter((d) => !d.trashed).length;
  const recent = documents.filter(
    (d) => !d.trashed && new Date(d.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;
  const shared = documents.filter((d) => !d.trashed && d.shared).length;
  const trashed = documents.filter((d) => d.trashed).length;

  const stats = [
    { label: 'Total Documents', value: total, icon: FileText, gradient: 'from-primary/20 to-primary/5' },
    { label: 'Recent Uploads', value: recent, icon: Clock, gradient: 'from-amber-500/20 to-amber-500/5' },
    { label: 'Shared by Me', value: shared, icon: Share2, gradient: 'from-emerald-500/20 to-emerald-500/5' },
    { label: 'In Trash', value: trashed, icon: Trash2, gradient: 'from-destructive/20 to-destructive/5' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="group relative bg-card border border-border/60 rounded-xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 hover:border-border hover:shadow-sm transition-all duration-200"
        >
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient}`}>
            <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-foreground/70" />
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">{stat.value}</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
