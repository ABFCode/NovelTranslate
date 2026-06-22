import type { ApiKeyEntry } from '@shared/types'
import { Pencil, Plus, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EditKeyDialog } from '../EditKeyDialog'

interface KeyManagementProps {
  providerConfigId: string
  /** Called whenever the set of keys changes (add/delete/validate/edit) */
  onKeysChanged?: () => void
}

export function KeyManagement({ providerConfigId, onKeysChanged }: KeyManagementProps) {
  const [keys, setKeys] = useState<ApiKeyEntry[]>([])
  const [newKey, setNewKey] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<ApiKeyEntry | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [encryptionAvailable, setEncryptionAvailable] = useState(true)

  const loadKeys = async () => {
    try {
      const list = await window.api.apiKey.list(providerConfigId)
      setKeys(list)
    } catch (error) {
      console.error('Failed to load keys:', error)
    }
  }

  useEffect(() => {
    loadKeys()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerConfigId])

  useEffect(() => {
    window.api.apiKey
      .encryptionAvailable()
      .then(setEncryptionAvailable)
      .catch(() => setEncryptionAvailable(true))
  }, [])

  const notifyChanged = () => {
    loadKeys()
    onKeysChanged?.()
  }

  const handleAdd = async () => {
    if (!newKey.trim()) return
    setIsAdding(true)
    try {
      await window.api.apiKey.save(providerConfigId, newKey.trim(), undefined, keys.length)
      toast.success('API key added')
      setNewKey('')
      notifyChanged()
    } catch (error) {
      toast.error('Failed to add API key')
      console.error(error)
    } finally {
      setIsAdding(false)
    }
  }

  const handleDelete = async (keyId: string) => {
    if (!confirm('Delete this API key?')) return
    try {
      await window.api.apiKey.delete(keyId)
      toast.success('API key deleted')
      notifyChanged()
    } catch (_error) {
      toast.error('Failed to delete API key')
    }
  }

  const handleValidate = async (keyId: string) => {
    setValidatingId(keyId)
    try {
      const isValid = await window.api.apiKey.validateStored(keyId)
      toast[isValid ? 'success' : 'error'](isValid ? 'API key is valid' : 'API key is invalid')
      notifyChanged()
    } catch (_error) {
      toast.error('Failed to validate API key')
    } finally {
      setValidatingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {!encryptionAvailable && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            OS secure storage isn&apos;t available, so API keys are stored with reversible
            obfuscation rather than encryption. Anyone with access to this machine&apos;s app data
            could recover them. On Linux, installing a keyring (e.g. gnome-keyring / libsecret)
            enables encryption.
          </span>
        </div>
      )}

      <div className="space-y-2">
        <AnimatePresence>
          {keys.map((key, index) => (
            <motion.div
              key={key.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 rounded-lg border p-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{key.label || `Key ${index + 1}`}</span>
                  {key.isValid ? (
                    <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs text-green-600">
                      Valid
                    </span>
                  ) : (
                    <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                      Invalid
                    </span>
                  )}
                  {!key.isEnabled && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      Disabled
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {key.requestCount} requests
                  {key.lastUsedAt &&
                    ` • Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingKey(key)
                    setEditDialogOpen(true)
                  }}
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleValidate(key.id)}
                  disabled={validatingId === key.id}
                  title="Validate"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${validatingId === key.id ? 'animate-spin' : ''}`}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(key.id)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {keys.length === 0 && (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            No API keys yet. Add one below.
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          type="password"
          placeholder="Enter API key"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
        />
        <Button onClick={handleAdd} disabled={!newKey.trim() || isAdding}>
          <Plus className="mr-2 h-4 w-4" />
          {isAdding ? 'Adding...' : 'Add Key'}
        </Button>
      </div>

      <EditKeyDialog
        keyEntry={editingKey}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={notifyChanged}
      />
    </div>
  )
}
