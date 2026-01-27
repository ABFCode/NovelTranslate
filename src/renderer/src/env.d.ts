/// <reference types="vite/client" />

// React 19 removed the global JSX namespace.
// Re-export it so files can use `JSX.Element` without explicit imports.
import type { JSX } from 'react'
export { JSX }
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    type Element = React.JSX.Element
    type IntrinsicElements = React.JSX.IntrinsicElements
  }
}
