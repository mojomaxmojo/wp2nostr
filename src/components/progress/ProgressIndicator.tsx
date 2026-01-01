/**
 * Fortschrittsanzeige Komponente
 * Zeigt Upload und Publish Fortschritt an
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Loader2, Upload, Send } from 'lucide-react';

export interface ProgressStep {
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  message?: string;
  percentage?: number;
}

export interface ProgressIndicatorProps {
  steps: ProgressStep[];
  totalPercentage: number;
}

export function ProgressIndicator({ steps, totalPercentage }: ProgressIndicatorProps) {
  const getIcon = (status: ProgressStep['status']) => {
    switch (status) {
      case 'pending':
        return null;
      case 'in-progress':
        return <Loader2 className="h-5 w-5 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusColor = (status: ProgressStep['status']) => {
    switch (status) {
      case 'pending':
        return 'text-muted-foreground';
      case 'in-progress':
        return 'text-blue-500';
      case 'completed':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Fortschritt
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Gesamtfortschritt</span>
            <span className="font-medium">{totalPercentage}%</span>
          </div>
          <Progress value={totalPercentage} className="h-2" />
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getIcon(step.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${getStatusColor(step.status)}`}>
                  {step.name}
                </div>
                {step.message && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {step.message}
                  </div>
                )}
                {step.percentage !== undefined && step.status === 'in-progress' && (
                  <div className="mt-1">
                    <Progress value={step.percentage} className="h-1" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
