import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface CustomProviderValues {
  displayName: string
  baseUrl: string
  models: string
}

interface CustomProviderFormProps {
  values: CustomProviderValues
  onChange: (values: CustomProviderValues) => void
}

/**
 * Form fields for configuring a custom OpenAI-compatible provider.
 */
export function CustomProviderForm({ values, onChange }: CustomProviderFormProps) {
  const set = (patch: Partial<CustomProviderValues>) => onChange({ ...values, ...patch })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cp-name">Display Name</Label>
        <Input
          id="cp-name"
          placeholder="e.g., OpenRouter, Local Ollama"
          value={values.displayName}
          onChange={(e) => set({ displayName: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cp-baseurl">Base URL</Label>
        <Input
          id="cp-baseurl"
          placeholder="https://api.example.com/v1"
          value={values.baseUrl}
          onChange={(e) => set({ baseUrl: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          The OpenAI-compatible endpoint, including any version path (e.g. <code>/v1</code>).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cp-models">Models (optional)</Label>
        <Input
          id="cp-models"
          placeholder="model-a, model-b"
          value={values.models}
          onChange={(e) => set({ models: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated model IDs. Leave empty to fetch them from the provider later.
        </p>
      </div>
    </div>
  )
}
