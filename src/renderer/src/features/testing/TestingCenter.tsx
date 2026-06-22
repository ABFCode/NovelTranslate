import { useEffect, useState } from 'react'
import { AdvancedSection, FeatureModeToggle, ShowAdvancedToggle } from '@/components/ModeToggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFeatureMode } from '@/contexts/UIModeContext'
import { cn } from '@/lib/utils'
import type { TestResult, TestRun, TranslationConfig } from '../../../../shared/types'
import { useTestingStore } from './testing.store'

const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
]

export function TestingCenter(): JSX.Element {
  const { isAdvanced } = useFeatureMode('testing')
  const {
    configs,
    testRuns,
    currentRun,
    sampleText,
    sourceLanguage,
    targetLanguage,
    selectedConfigIds,
    isRunning,
    fetchConfigs,
    fetchTestRuns,
    setSampleText,
    setSourceLanguage,
    setTargetLanguage,
    toggleConfigSelection,
    selectAllConfigs,
    clearConfigSelection,
    runSingleTest,
    runComparisonTest,
    loadTestRun,
  } = useTestingStore()

  const [testName, setTestName] = useState('')
  const [activeTab, setActiveTab] = useState<'single' | 'comparison'>('single')

  useEffect(() => {
    fetchConfigs()
    fetchTestRuns()
  }, [fetchConfigs, fetchTestRuns])

  const handleRunTest = async (): Promise<void> => {
    const name = testName.trim() || `Test ${new Date().toLocaleString()}`
    try {
      if (activeTab === 'single' && selectedConfigIds.length === 1) {
        await runSingleTest(name, selectedConfigIds[0])
      } else {
        await runComparisonTest(name)
      }
      setTestName('')
    } catch (error) {
      console.error('Test failed:', error)
    }
  }

  const canRun = sampleText.trim().length > 0 && selectedConfigIds.length > 0 && !isRunning

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Testing Lab</h1>
          <p className="page-subtitle">Test and compare translation configurations</p>
        </div>
        <div className="flex items-center gap-2">
          <FeatureModeToggle feature="testing" />
          <Button onClick={handleRunTest} disabled={!canRun}>
            {isRunning ? (
              <>
                <LoadingIcon className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <PlayIcon className="mr-2 h-4 w-4" />
                Run Test
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Input */}
        <div className="flex w-1/2 flex-col border-r">
          <div className="border-b p-4">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as 'single' | 'comparison')}
            >
              <TabsList className="w-full">
                <TabsTrigger value="single" className="flex-1">
                  Single Config
                </TabsTrigger>
                <TabsTrigger value="comparison" className="flex-1">
                  Comparison
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {/* Test Name */}
              <AdvancedSection feature="testing">
                <div className="space-y-2">
                  <Label>Test Name (optional)</Label>
                  <Input
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="My Test"
                  />
                </div>
              </AdvancedSection>

              {/* Sample Text */}
              <div className="space-y-2">
                <Label>Sample Text</Label>
                <textarea
                  value={sampleText}
                  onChange={(e) => setSampleText(e.target.value)}
                  rows={8}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Paste or type text to translate..."
                />
              </div>

              {/* Languages */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From</Label>
                  <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.filter((l) => l.value !== 'auto').map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Config Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    {activeTab === 'single' ? 'Select Config' : 'Select Configs to Compare'}
                  </Label>
                  {activeTab === 'comparison' && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={selectAllConfigs}>
                        All
                      </Button>
                      <Button variant="ghost" size="sm" onClick={clearConfigSelection}>
                        None
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {configs.map((config) => (
                    <ConfigSelectionItem
                      key={config.id}
                      config={config}
                      isSelected={selectedConfigIds.includes(config.id)}
                      onToggle={() => {
                        if (activeTab === 'single') {
                          clearConfigSelection()
                        }
                        toggleConfigSelection(config.id)
                      }}
                      isSingleMode={activeTab === 'single'}
                    />
                  ))}
                </div>
              </div>

              {!isAdvanced && <ShowAdvancedToggle feature="testing" />}
            </div>
          </ScrollArea>
        </div>

        {/* Right panel - Results */}
        <div className="flex w-1/2 flex-col">
          <div className="border-b p-4">
            <h2 className="font-medium">Results</h2>
          </div>

          <ScrollArea className="flex-1 p-4">
            {currentRun ? <TestResults run={currentRun} /> : <EmptyResults />}
          </ScrollArea>

          {/* History */}
          <AdvancedSection feature="testing" className="border-t">
            <div className="p-4">
              <h3 className="mb-2 text-sm font-medium">History</h3>
              <div className="max-h-32 space-y-1 overflow-auto">
                {testRuns.slice(0, 10).map((run) => (
                  <button
                    key={run.id}
                    onClick={() => loadTestRun(run.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm transition-colors hover:bg-muted',
                      currentRun?.id === run.id && 'bg-muted'
                    )}
                  >
                    <span className="truncate">{run.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(run.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </AdvancedSection>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface ConfigSelectionItemProps {
  config: TranslationConfig
  isSelected: boolean
  onToggle: () => void
  isSingleMode: boolean
}

function ConfigSelectionItem({
  config,
  isSelected,
  onToggle,
  isSingleMode,
}: ConfigSelectionItemProps): JSX.Element {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
        isSelected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'
      )}
    >
      <div
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded border',
          isSingleMode ? 'rounded-full' : '',
          isSelected ? 'border-primary bg-primary text-primary-foreground' : ''
        )}
      >
        {isSelected && <CheckIcon className="h-3 w-3" />}
      </div>
      <div className="flex-1">
        <div className="font-medium">{config.name}</div>
        <div className="text-xs text-muted-foreground">{config.modelId}</div>
      </div>
      {config.isDefault && (
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">Default</span>
      )}
    </button>
  )
}

interface TestResultsProps {
  run: TestRun
}

function TestResults({ run }: TestResultsProps): JSX.Element {
  const results = run.results || []
  const isComparison = results.length > 1

  if (results.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">No results yet</div>
  }

  if (isComparison) {
    return (
      <div className="space-y-4">
        <div className="text-sm font-medium">Comparing {results.length} configs</div>
        <div className="grid gap-4">
          {results.map((result) => (
            <ResultCard key={result.id} result={result} />
          ))}
        </div>
      </div>
    )
  }

  return <ResultCard result={results[0]} showFull />
}

interface ResultCardProps {
  result: TestResult
  showFull?: boolean
}

function ResultCard({ result, showFull }: ResultCardProps): JSX.Element {
  const hasError = !!result.error

  return (
    <Card className={cn(hasError && 'border-destructive')}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{result.configName}</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{result.durationMs}ms</span>
            <span>•</span>
            <span>${result.costUsd.toFixed(4)}</span>
            {hasError ? (
              <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">
                Error
              </span>
            ) : (
              <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-600">Success</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasError ? (
          <div className="rounded bg-destructive/10 p-2 text-sm text-destructive">
            {result.error}
          </div>
        ) : (
          <div className={cn('rounded bg-muted p-3 text-sm', showFull ? '' : 'line-clamp-4')}>
            {result.resultText}
          </div>
        )}
        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span>
            {result.tokensIn} / {result.tokensOut} tokens
          </span>
          <span>{result.modelId}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyResults(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4">
        <BeakerIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-medium">No test results</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter some text and run a test to see results
      </p>
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

// Icons
function PlayIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

function LoadingIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function BeakerIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
      />
    </svg>
  )
}
