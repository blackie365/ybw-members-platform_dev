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
    <Card className="border-accent/20 bg-accent/5 sticky top-8">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Components</CardTitle>
        <CardDescription className="text-xs">Add a new spread.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2">
          {PAGE_TYPES.map((type) => (
            <Button 
              key={type.id} 
              variant="outline" 
              className="justify-start gap-3 h-10 px-3 hover:bg-accent/10 hover:border-accent/30 bg-white text-xs font-bold uppercase tracking-wider"
              onClick={() => onAddPage(type.id)}
              disabled={isSaving}
            >
              <type.icon className="h-4 w-4 text-accent" />
              {type.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
