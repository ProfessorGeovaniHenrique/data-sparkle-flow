import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProcessing } from '@/contexts/ProcessingContext';

const ITEMS_PER_PAGE = 50;

interface DraggableQueueTableProps {
  items: { id: string; titulo: string }[];
}

interface SortableRowProps {
  item: { id: string; titulo: string };
  index: number;
}

const SortableRow = ({ item, index }: SortableRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'bg-muted' : ''}>
      <TableCell className="w-12">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing hover:bg-muted/50 p-2 rounded"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell className="w-16 text-muted-foreground">{index + 1}</TableCell>
      <TableCell className="font-medium">{item.titulo}</TableCell>
      <TableCell className="w-[20%]">
        <Badge variant="outline" className="gap-1">
          <Clock className="w-3 h-3" />
          Aguardando
        </Badge>
      </TableCell>
    </TableRow>
  );
};

export const DraggableQueueTable = ({ items }: DraggableQueueTableProps) => {
  const { reorderQueue } = useProcessing();
  const [currentPage, setCurrentPage] = useState(1);
  const [localItems, setLocalItems] = useState(items);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const totalPages = Math.ceil(localItems.length / ITEMS_PER_PAGE);
  const paginatedItems = localItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = localItems.findIndex((item) => item.id === active.id);
    const newIndex = localItems.findIndex((item) => item.id === over.id);

    const newOrder = arrayMove(localItems, oldIndex, newIndex);
    setLocalItems(newOrder);
    
    reorderQueue(newOrder.map(item => item.titulo));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Fila de Processamento</CardTitle>
        <CardDescription>
          {localItems.length} músicas aguardando processamento - Arraste para reordenar
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <ScrollArea className="h-[600px] rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="w-[20%]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SortableContext
                  items={paginatedItems.map(item => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {paginatedItems.map((item, index) => (
                    <SortableRow
                      key={item.id}
                      item={item}
                      index={(currentPage - 1) * ITEMS_PER_PAGE + index}
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </ScrollArea>
        </DndContext>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} -{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, localItems.length)} de {localItems.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2 px-3 py-1 text-sm">
                Página {currentPage} de {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
