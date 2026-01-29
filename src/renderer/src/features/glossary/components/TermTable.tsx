import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import { TermTypeBadge } from './TermTypeBadge'
import type { GlossaryTerm } from '../../../../../shared/types'

interface TermTableProps {
  terms: GlossaryTerm[]
  onEdit: (term: GlossaryTerm) => void
  onDelete: (term: GlossaryTerm) => void
  isAdvanced: boolean
}

export function TermTable({ terms, onEdit, onDelete, isAdvanced }: TermTableProps): JSX.Element {
  return (
    <div className="border-b">
      <table className="w-full">
        <thead className="border-b bg-muted/50 sticky top-0">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-medium">Source</th>
            <th className="px-6 py-3 text-left text-sm font-medium">Translation</th>
            <th className="px-6 py-3 text-left text-sm font-medium">Type</th>
            {isAdvanced && <th className="px-6 py-3 text-left text-sm font-medium">Gender</th>}
            {isAdvanced && <th className="px-6 py-3 text-left text-sm font-medium">Usage</th>}
            <th className="px-6 py-3 text-right text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {terms.map((term) => (
              <motion.tr
                key={term.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="border-b hover:bg-muted/30"
              >
                <td className="px-6 py-3 font-medium">{term.sourceTerm}</td>
                <td className="px-6 py-3">{term.targetTerm}</td>
                <td className="px-6 py-3">
                  <TermTypeBadge type={term.termType} />
                </td>
                {isAdvanced && (
                  <td className="px-6 py-3 text-sm text-muted-foreground">
                    {term.gender || '-'}
                  </td>
                )}
                {isAdvanced && (
                  <td className="px-6 py-3 text-sm text-muted-foreground">
                    {term.usageCount}
                  </td>
                )}
                <td className="px-6 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(term)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(term)}
                      className="hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  )
}
