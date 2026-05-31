// Shared contract types for the plugin system (backend + frontend).
// Additive only — gives `// @ts-check` files type-safety on plugin shapes.

import type { Database } from 'better-sqlite3';
import type { Router } from 'express';

export {};

/** Shape of every `plugins/<id>/plugin.json`. */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  icon?: string;
  color?: string;
}

/** Resolved filesystem paths handed to a plugin at registration. */
export interface AppPaths {
  userData: string;
  music?: string;
  thumbnails?: string;
  bin?: string;
}

/** Backend half of a plugin: `plugins/<id>/backend/index.js`. */
export interface PluginBackend {
  /** Run idempotent migrations for this plugin's tables. */
  migrate(db: Database): void;
  /** Mount the plugin's Express router under /api/<id>/. */
  register(router: Router, db: Database, appPaths: AppPaths): void;
}

/** A sidebar navigation entry contributed by a plugin. */
export interface PluginNavItem {
  view: string;
  icon: string;
  label: string;
  labelKey?: string;
}

/** A dashboard widget contributed by a plugin. */
export interface PluginDashboardWidget {
  id: string;
  zone: 'content' | 'sidebar' | string;
  priority: number;
  title: string;
  render(el: HTMLElement): void | Promise<void>;
}

/** Renderer view factory: fills `el` with the view (the `render*` pattern). */
export type PluginViewRenderer = (
  el: HTMLElement,
  extra?: unknown
) => void | Promise<void>;

/** Frontend half of a plugin: default export of `frontend/index.js`. */
export interface PluginFrontend {
  id: string;
  onLoad?(): void;
  navItems?: PluginNavItem[];
  views?: Record<string, PluginViewRenderer>;
  dashboardWidgets?: PluginDashboardWidget[];
}

/** Paginated response contract returned by every plugin list endpoint. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}
