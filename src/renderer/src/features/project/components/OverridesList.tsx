import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TranslationOverride } from '@shared/types'

interface OverridesListProps {
  overrides: TranslationOverride[]
  isLoading: boolean
  onDelete: (id: string) => void
}

export function OverridesList({ overrides, isLoading, onDelete }: OverridesListProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Overrides</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading overrides...</p>
        ) : overrides.length === 0 ? (
          <p className="text-sm text-muted-foreground">No overrides yet.</p>
        ) : (
          <div className="space-y-2">
            {overrides.slice(0, 6).map((override) => (
              <div key={override.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="truncate font-medium">{override.sourceSegment}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs hover:text-destructive"
                    onClick={() => onDelete(override.id)}
                  >
                    Delete
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {override.overrideTranslation}
                </div>
              </div>
            ))}
            {overrides.length > 6 && (
              <div className="text-xs text-muted-foreground">
                +{overrides.length - 6} more overrides
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
