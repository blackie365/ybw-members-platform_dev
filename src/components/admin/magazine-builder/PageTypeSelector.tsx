'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PAGE_TYPES } from './types';
import { MAGAZINE_TEMPLATES } from '@/lib/magazine-theme';

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
          <TooltipProvider>
            {PAGE_TYPES.map((type) => {
              const template = MAGAZINE_TEMPLATES.find(t => t.id === type.id);
              
              return (
                <Tooltip key={type.id}>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="justify-start gap-2 h-9 px-2 hover:bg-accent/10 hover:border-accent/30 bg-white text-[10px] font-bold uppercase tracking-wider w-full overflow-hidden"
                      onClick={() => onAddPage(type.id)}
                      disabled={isSaving}
                    >
                      <type.icon className="h-3.5 w-3.5 text-accent shrink-0" />
                      <span className="truncate">{type.label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[200px]">
                    <p className="font-bold text-xs">{template?.name || type.label}</p>
                    <p className="text-[10px] mt-1 text-muted-foreground">{template?.description}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
