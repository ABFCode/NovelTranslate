import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface GlossarySummaryProps {
  termCount: number
  suggestionCount: number
}

export function GlossarySummary({ termCount, suggestionCount }: GlossarySummaryProps): JSX.Element {
  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Glossary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Terms</span>
          <span className="font-medium">{termCount}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Pending suggestions</span>
          <span className="font-medium">{suggestionCount}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate({ to: '/glossary' })}>
            Open Glossary
          </Button>
          {suggestionCount > 0 && (
            <Button size="sm" onClick={() => navigate({ to: '/glossary' })}>
              Review Suggestions
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
