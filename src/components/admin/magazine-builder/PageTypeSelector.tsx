'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PAGE_TYPES } from './types';

interface PageTypeSelectorProps {
  onAddPage: (type: string) => void;
  isSaving: boolean;
}

export function PageTypeSelector({ onAddPage, isSaving }: PageTypeSelectorProps) {
  return (
    <Card className="border-accent/20 bg-accent/5 sticky top-8 w-full overflow-hidden">
      <CardHeader className="pb-3 px-4">
        <CardTitle className="text-base">Components</CardTitle>
        <CardDescription className="text-[10px]">Add a new spread.</CardDescription>
      </CardHeader>
      <CardContent className="px-3 pb-4">
        <div className="flex flex-col gap-1.5">
          {PAGE_TYPES.map((type) => (
            <Button 
              key={type.id} 
              variant="outline" 
              className="justify-start gap-2 h-9 px-2 hover:bg-accent/10 hover:border-accent/30 bg-white text-[10px] font-bold uppercase tracking-wider w-full overflow-hidden"
              onClick={() => onAddPage(type.id)}
              disabled={isSaving}
            >
              <type.icon className="h-3.5 w-3.5 text-accent shrink-0" />
              <span className="truncate">{type.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
