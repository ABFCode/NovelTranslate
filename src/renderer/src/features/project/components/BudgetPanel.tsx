import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface BudgetPanelProps {
  projectId: string
}

export function BudgetPanel({ projectId }: BudgetPanelProps): JSX.Element {
  const [budget, setBudget] = useState<{
    budgetUsd: number
    spentUsd: number
    alertThreshold: number
    hardLimit: boolean
  } | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [newBudget, setNewBudget] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadBudget()
  }, [projectId])

  const loadBudget = async (): Promise<void> => {
    try {
      const b = await window.api.budget.get(projectId)
      setBudget(b)
    } catch (error) {
      console.error('Failed to load budget:', error)
    }
  }

  const handleSaveBudget = async (): Promise<void> => {
    const value = parseFloat(newBudget)
    if (Number.isNaN(value) || value < 0) {
      toast.error('Please enter a valid budget amount')
      return
    }

    setIsSaving(true)
    try {
      await window.api.budget.set(projectId, value, 0.8, false)
      await loadBudget()
      setIsEditing(false)
      toast.success('Budget updated')
    } catch (_error) {
      toast.error('Failed to update budget')
    } finally {
      setIsSaving(false)
    }
  }

  const spentPercent = budget ? (budget.spentUsd / budget.budgetUsd) * 100 : 0
  const remaining = budget ? budget.budgetUsd - budget.spentUsd : 0

  return (
    <div className="rounded-lg border p-3 space-y-3">
      {budget && budget.budgetUsd > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Budget</span>
            <span className="text-sm">
              ${budget.spentUsd.toFixed(2)} / ${budget.budgetUsd.toFixed(2)}
            </span>
          </div>
          <Progress
            value={Math.min(spentPercent, 100)}
            className={cn(
              'h-2',
              spentPercent > 90
                ? '[&>div]:bg-destructive'
                : spentPercent > 70
                  ? '[&>div]:bg-yellow-500'
                  : ''
            )}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>${remaining.toFixed(2)} remaining</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
          </div>
        </>
      ) : isEditing ? (
        <div className="space-y-2">
          <label className="text-sm font-medium">Set Budget (USD)</label>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g., 10.00"
              value={newBudget}
              onChange={(e) => setNewBudget(e.target.value)}
              className="flex-1"
            />
            <Button size="sm" onClick={handleSaveBudget} disabled={isSaving}>
              {isSaving ? '...' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">No budget set</span>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Set Budget
          </Button>
        </div>
      )}
    </div>
  )
}
