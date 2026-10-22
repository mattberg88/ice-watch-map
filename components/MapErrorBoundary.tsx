"use client";

import { Component, type ReactNode } from "react";

/**
 * If the map crashes (an old browser, WebGL blocked, a script that fails to load), show a message in its
 * place so the hotlines, rights info and the rest of the page keep working.
 */
export default class MapErrorBoundary extends Component<{ message: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Map failed to load:", error);
  }

  render() {
    return this.state.failed ? <div className="map map-loading map-error">{this.props.message}</div> : this.props.children;
  }
}
