import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal } from 'lucide-react';

interface ProcessingLogProps {
  logs: string[];
  title?: string;
}

export const ProcessingLog = ({ logs, title = "Processamento em Andamento" }: ProcessingLogProps) => {
  if (logs.length === 0) return null;

  return (
    <div className="w-full mt-4 border border-border rounded-lg bg-background/50 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border">
        <Terminal className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-medium">{title}</h4>
      </div>
      <ScrollArea className="h-[200px] w-full">
        <div className="p-4 font-mono text-xs space-y-1">
          {logs.map((log, idx) => (
            <div key={idx} className="text-muted-foreground">
              <span className="text-primary mr-2">[{new Date().toLocaleTimeString()}]</span>
              {log}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
