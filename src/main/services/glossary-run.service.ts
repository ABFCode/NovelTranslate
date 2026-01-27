/**
 * Glossary Run Service
 *
 * Batch extraction of glossary terms from chapters using cheap models.
 */

import type {
  CostEstimate,
  TermType,
  GlossaryGender
} from '../../shared/types'
import { glossaryService } from './glossary.service'
import { estimateTokens, estimateCostForTokens } from './cost-estimator'
import { keyManager } from './key-manager'
import { providerRegistry } from '../providers'
import { logger, generateCorrelationId } from './logger'
import { getChapterContent } from '../database/repositories/chapter.repository'

// Recommended cheap models for extraction
const CHEAP_MODELS = [
  { providerId: 'openai', modelId: 'gpt-4o-mini' },
  { providerId: 'anthropic', modelId: 'claude-3-haiku-20240307' },
  { providerId: 'gemini', modelId: 'gemini-1.5-flash' }
]

interface ExtractionResult {
  chapterId: string
  suggestionsCreated: number
  tokensUsed: number
  costUsd: number
  error?: string
}

interface GlossaryRunResult {
  projectId: string
  totalChapters: number
  processedChapters: number
  totalSuggestions: number
  totalCostUsd: number
  totalTokens: number
  results: ExtractionResult[]
  errors: string[]
}

interface ExtractedTerm {
  sourceTerm: string
  suggestedTarget: string
  termType: TermType
  gender?: GlossaryGender
  confidence: number
  sourceContext: string
}

/**
 * Glossary Run Service class
 */
export class GlossaryRunService {
  /**
   * Estimate cost for running glossary extraction
   */
  async estimateCost(
    _projectId: string,
    chapterIds: string[],
    providerId: string,
    modelId: string
  ): Promise<CostEstimate> {
    let totalInputTokens = 0

    for (const chapterId of chapterIds) {
      const content = getChapterContent(chapterId)
      if (content) {
        totalInputTokens += estimateTokens(content.sourceText)
      }
    }

    // Add tokens for the extraction prompt
    const promptOverhead = 500 * chapterIds.length

    return estimateCostForTokens(
      totalInputTokens + promptOverhead,
      Math.ceil(totalInputTokens * 0.3), // Output is typically shorter (just terms)
      providerId,
      modelId
    )
  }

  /**
   * Run glossary extraction on chapters
   */
  async runExtraction(
    projectId: string,
    chapterIds: string[],
    providerId: string,
    modelId: string,
    concurrency = 3,
    emitProgress?: (current: number, total: number, chapterId: string) => void
  ): Promise<GlossaryRunResult> {
    const correlationId = generateCorrelationId()
    const log = logger.child(correlationId)

    log.info('Starting glossary extraction', {
      projectId,
      chapterCount: chapterIds.length,
      providerId,
      modelId
    })

    const result: GlossaryRunResult = {
      projectId,
      totalChapters: chapterIds.length,
      processedChapters: 0,
      totalSuggestions: 0,
      totalCostUsd: 0,
      totalTokens: 0,
      results: [],
      errors: []
    }

    // Get API key
    const apiKey = await keyManager.getKey(providerId)
    if (!apiKey) {
      throw new Error(`No API key available for provider: ${providerId}`)
    }

    // Process chapters with concurrency limit
    const chunks: string[][] = []
    for (let i = 0; i < chapterIds.length; i += concurrency) {
      chunks.push(chapterIds.slice(i, i + concurrency))
    }

    for (const chunk of chunks) {
      const promises = chunk.map((chapterId) =>
        this.extractFromChapter(
          projectId,
          chapterId,
          providerId,
          modelId,
          apiKey,
          log
        )
      )

      const chunkResults = await Promise.allSettled(promises)

      for (let i = 0; i < chunkResults.length; i++) {
        const chapterId = chunk[i]
        const promiseResult = chunkResults[i]

        if (promiseResult.status === 'fulfilled') {
          const extractionResult = promiseResult.value
          result.results.push(extractionResult)
          result.processedChapters++
          result.totalSuggestions += extractionResult.suggestionsCreated
          result.totalCostUsd += extractionResult.costUsd
          result.totalTokens += extractionResult.tokensUsed

          if (extractionResult.error) {
            result.errors.push(`Chapter ${chapterId}: ${extractionResult.error}`)
          }
        } else {
          result.results.push({
            chapterId,
            suggestionsCreated: 0,
            tokensUsed: 0,
            costUsd: 0,
            error: promiseResult.reason?.message || 'Unknown error'
          })
          result.errors.push(`Chapter ${chapterId}: ${promiseResult.reason?.message}`)
        }

        // Emit progress
        if (emitProgress) {
          emitProgress(result.processedChapters, result.totalChapters, chapterId)
        }
      }
    }

    log.info('Glossary extraction completed', {
      processedChapters: result.processedChapters,
      totalSuggestions: result.totalSuggestions,
      totalCostUsd: result.totalCostUsd
    })

    return result
  }

  /**
   * Get recommended cheap models for extraction
   */
  getRecommendedModels(): Array<{ providerId: string; modelId: string }> {
    return CHEAP_MODELS.filter((m) => keyManager.hasValidKeys(m.providerId))
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async extractFromChapter(
    projectId: string,
    chapterId: string,
    providerId: string,
    modelId: string,
    apiKey: string,
    log: typeof logger
  ): Promise<ExtractionResult> {
    const content = getChapterContent(chapterId)
    if (!content || !content.sourceText) {
      return {
        chapterId,
        suggestionsCreated: 0,
        tokensUsed: 0,
        costUsd: 0,
        error: 'No source text'
      }
    }

    log.debug('Extracting from chapter', { chapterId })

    try {
      const provider = providerRegistry.get(providerId)
      if (!provider) {
        throw new Error(`Unknown provider: ${providerId}`)
      }

      // Build extraction prompt
      const prompt = this.buildExtractionPrompt(content.sourceText)

      // Call the API
      const startTime = Date.now()
      const response = await provider.translate({
        userPrompt: prompt,
        systemPrompt: this.getExtractionSystemPrompt(),
        modelId,
        apiKey,
        temperature: 0.3
      })

      const durationMs = Date.now() - startTime

      // Parse the response
      const terms = this.parseExtractionResponse(response.translatedText, content.sourceText)

      // Create suggestions (deduplicate against existing terms)
      let suggestionsCreated = 0
      for (const term of terms) {
        // Check if term already exists
        const existing = glossaryService.findBySource(term.sourceTerm, projectId)
        if (existing) {
          continue
        }

        // Create suggestion
        glossaryService.createSuggestion({
          projectId,
          chapterId,
          sourceTerm: term.sourceTerm,
          suggestedTarget: term.suggestedTarget,
          termType: term.termType,
          gender: term.gender,
          confidence: term.confidence,
          sourceContext: term.sourceContext
        })
        suggestionsCreated++
      }

      // Calculate cost
      const cost = estimateCostForTokens(
        response.tokensUsed.input,
        response.tokensUsed.output,
        providerId,
        modelId
      )

      log.debug('Chapter extraction complete', {
        chapterId,
        termsFound: terms.length,
        suggestionsCreated,
        durationMs
      })

      return {
        chapterId,
        suggestionsCreated,
        tokensUsed: response.tokensUsed.total,
        costUsd: cost.totalCostUsd
      }
    } catch (error) {
      log.error('Chapter extraction failed', error as Error, { chapterId })
      return {
        chapterId,
        suggestionsCreated: 0,
        tokensUsed: 0,
        costUsd: 0,
        error: (error as Error).message
      }
    }
  }

  private getExtractionSystemPrompt(): string {
    return `You are a specialized glossary extraction assistant for novel translation. 
Your task is to identify important terms that should be translated consistently throughout the text.

Focus on:
- Character names (proper nouns)
- Place names (locations, kingdoms, etc.)
- Skills and abilities (cultivation techniques, magic spells, etc.)
- Items (weapons, artifacts, etc.)
- Honorifics and titles
- Genre-specific terminology

For each term, provide:
1. The original term as it appears
2. A suggested English translation
3. The type of term (name, place, skill, item, honorific, other)
4. Gender if it's a character name (male, female, neutral, unknown)
5. A confidence score (0.0-1.0) based on how certain you are

Output your findings in JSON format.`
  }

  private buildExtractionPrompt(text: string): string {
    // Truncate very long texts
    const maxLength = 10000
    const truncatedText = text.length > maxLength ? text.slice(0, maxLength) + '...' : text

    return `Extract glossary terms from the following text. Return a JSON array of objects with these fields:
- sourceTerm: the original term
- suggestedTarget: suggested English translation
- termType: one of "name", "place", "skill", "item", "honorific", "other"
- gender: for names only - "male", "female", "neutral", or "unknown"
- confidence: 0.0-1.0
- sourceContext: a short excerpt showing the term in context (max 100 chars)

Only include terms that appear important for consistent translation. Focus on proper nouns and genre-specific terms.

Text:
${truncatedText}

Respond with only the JSON array, no additional text.`
  }

  private parseExtractionResponse(response: string, originalText: string): ExtractedTerm[] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        return []
      }

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        sourceTerm?: string
        suggestedTarget?: string
        termType?: string
        gender?: string
        confidence?: number
        sourceContext?: string
      }>

      if (!Array.isArray(parsed)) {
        return []
      }

      const validTypes: TermType[] = ['name', 'place', 'skill', 'item', 'honorific', 'other']
      const validGenders: GlossaryGender[] = ['male', 'female', 'neutral', 'unknown']

      return parsed
        .filter(
          (item) =>
            item.sourceTerm &&
            item.suggestedTarget &&
            originalText.includes(item.sourceTerm)
        )
        .map((item) => ({
          sourceTerm: item.sourceTerm!,
          suggestedTarget: item.suggestedTarget!,
          termType: validTypes.includes(item.termType as TermType)
            ? (item.termType as TermType)
            : 'other',
          gender: validGenders.includes(item.gender as GlossaryGender)
            ? (item.gender as GlossaryGender)
            : undefined,
          confidence: typeof item.confidence === 'number'
            ? Math.max(0, Math.min(1, item.confidence))
            : 0.5,
          sourceContext: item.sourceContext || this.findContext(item.sourceTerm!, originalText)
        }))
    } catch (error) {
      logger.warn('Failed to parse extraction response', { error: (error as Error).message })
      return []
    }
  }

  private findContext(term: string, text: string): string {
    const index = text.indexOf(term)
    if (index === -1) return ''

    const start = Math.max(0, index - 30)
    const end = Math.min(text.length, index + term.length + 30)
    return '...' + text.slice(start, end).replace(/\n/g, ' ') + '...'
  }
}

// Singleton instance
export const glossaryRunService = new GlossaryRunService()
