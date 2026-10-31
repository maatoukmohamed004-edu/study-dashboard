import { Component, type ReactNode } from 'react'

/** Shows `fallback` instead of crashing the app when a decorative part (3D, glass) fails. */
export class SafeBoundary extends Component<{ fallback: ReactNode; label: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.warn(`${this.props.label} is turned off:`, error instanceof Error ? error.message : error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
