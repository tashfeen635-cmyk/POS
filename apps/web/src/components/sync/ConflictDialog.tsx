import { useState } from 'react';
import { AlertTriangle, Check, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface SyncConflict {
  id: string;
  table: string;
  recordId: string;
  clientData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  resolution?: 'client_wins' | 'server_wins' | 'manual';
}

interface ConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: SyncConflict[];
  onResolve: (conflictId: string, resolution: 'client_wins' | 'server_wins') => Promise<void>;
  onResolveAll: (resolution: 'client_wins' | 'server_wins') => Promise<void>;
}

export function ConflictDialog({
  open,
  onOpenChange,
  conflicts,
  onResolve,
  onResolveAll,
}: ConflictDialogProps) {
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolvingAll, setResolvingAll] = useState(false);

  const handleResolve = async (conflictId: string, resolution: 'client_wins' | 'server_wins') => {
    setResolving(conflictId);
    try {
      await onResolve(conflictId, resolution);
    } finally {
      setResolving(null);
    }
  };

  const handleResolveAll = async (resolution: 'client_wins' | 'server_wins') => {
    setResolvingAll(true);
    try {
      await onResolveAll(resolution);
    } finally {
      setResolvingAll(false);
    }
  };

  const getTableLabel = (table: string): string => {
    const labels: Record<string, string> = {
      products: 'Product',
      customers: 'Customer',
      sales: 'Sale',
      categories: 'Category',
      imei_inventory: 'IMEI',
      product_batches: 'Batch',
    };
    return labels[table] || table;
  };

  const getFieldDiff = (clientData: Record<string, unknown>, serverData: Record<string, unknown>) => {
    const allKeys = new Set([...Object.keys(clientData), ...Object.keys(serverData)]);
    const diffs: Array<{ key: string; client: unknown; server: unknown; changed: boolean }> = [];

    // Skip internal fields
    const skipFields = ['_syncStatus', '_serverSyncedAt', '_lastSyncError', '_conflictData', 'updatedAt', 'createdAt'];

    for (const key of allKeys) {
      if (skipFields.includes(key)) continue;

      const clientValue = clientData[key];
      const serverValue = serverData[key];
      const changed = JSON.stringify(clientValue) !== JSON.stringify(serverValue);

      if (changed) {
        diffs.push({ key, client: clientValue, server: serverValue, changed });
      }
    }

    return diffs;
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Sync Conflicts Detected
          </DialogTitle>
          <DialogDescription>
            {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} found. Choose which
            version to keep for each item.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {conflicts.map((conflict) => {
              const diffs = getFieldDiff(conflict.clientData, conflict.serverData);

              return (
                <div
                  key={conflict.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{getTableLabel(conflict.table)}</Badge>
                      <span className="text-sm text-muted-foreground">
                        ID: {conflict.recordId.slice(0, 8)}...
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolve(conflict.id, 'client_wins')}
                        disabled={!!resolving || resolvingAll}
                      >
                        {resolving === conflict.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Keep Mine
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolve(conflict.id, 'server_wins')}
                        disabled={!!resolving || resolvingAll}
                      >
                        {resolving === conflict.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <X className="h-4 w-4 mr-1" />
                            Keep Server
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {diffs.length > 0 && (
                    <div className="text-sm">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-1 font-medium">Field</th>
                            <th className="text-left py-1 font-medium text-blue-600">Your Version</th>
                            <th className="text-left py-1 font-medium text-green-600">Server Version</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diffs.slice(0, 5).map(({ key, client, server }) => (
                            <tr key={key} className="border-b last:border-0">
                              <td className="py-1 text-muted-foreground">{key}</td>
                              <td className="py-1 text-blue-600 truncate max-w-[150px]">
                                {formatValue(client)}
                              </td>
                              <td className="py-1 text-green-600 truncate max-w-[150px]">
                                {formatValue(server)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {diffs.length > 5 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          +{diffs.length - 5} more fields differ
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-between sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleResolveAll('client_wins')}
              disabled={!!resolving || resolvingAll}
            >
              {resolvingAll ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Keep All Mine
            </Button>
            <Button
              variant="outline"
              onClick={() => handleResolveAll('server_wins')}
              disabled={!!resolving || resolvingAll}
            >
              {resolvingAll ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Keep All Server
            </Button>
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
