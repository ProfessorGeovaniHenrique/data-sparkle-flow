import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Sparkles } from "lucide-react";

interface DataRow {
  id: string;
  [key: string]: any;
  status?: "pending" | "enriched" | "validated" | "rejected";
}

interface DataTableProps {
  data: DataRow[];
  onValidate?: (id: string) => void;
  onEnrich?: (id: string) => void;
}

export const DataTable = ({ data, onValidate, onEnrich }: DataTableProps) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Nenhum dado para exibir
      </div>
    );
  }

  const columns = Object.keys(data[0]).filter(key => key !== "id" && key !== "status");

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "enriched":
        return <Badge variant="secondary" className="bg-enriched/10 text-enriched border-enriched/20">Enriquecido</Badge>;
      case "validated":
        return <Badge variant="secondary" className="bg-success/10 text-success border-success/20">Validado</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejeitado</Badge>;
      default:
        return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">Pendente</Badge>;
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Status</TableHead>
            {columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{getStatusBadge(row.status)}</TableCell>
              {columns.map((column) => (
                <TableCell key={column}>{row[column]}</TableCell>
              ))}
              <TableCell className="text-right space-x-2">
                {onEnrich && row.status === "pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEnrich(row.id)}
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    Enriquecer
                  </Button>
                )}
                {onValidate && (row.status === "enriched" || row.status === "pending") && (
                  <Button
                    size="sm"
                    onClick={() => onValidate(row.id)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Validar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
