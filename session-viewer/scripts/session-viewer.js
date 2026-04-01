#!/usr/bin/env node
'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const cp   = require('child_process');

// --- HTML UI Template ---
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude Code — Session Viewer</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg-deep:        #0a0f1e;
    --bg-sidebar:     #0d1424;
    --bg-card:        rgba(255,255,255,0.03);
    --bg-card-hover:  rgba(255,255,255,0.06);
    --border-subtle:  rgba(255,255,255,0.07);
    --border-glow:    rgba(124,58,237,0.4);
    --text-primary:   #e2e8f0;
    --text-secondary: #94a3b8;
    --text-muted:     #475569;
    --accent-purple:  #7c3aed;
    --accent-violet:  #6d28d9;
    --accent-blue:    #3b82f6;
    --accent-indigo:  #4f46e5;
    --accent-amber:   #d97706;
    --scrollbar-w:    6px;
  }

  /* Light theme tokens */
  :root.theme-light, .theme-light {
    --bg-deep:        #f1f5f9;
    --bg-sidebar:     #e8edf5;
    --bg-card:        rgba(0,0,0,0.03);
    --bg-card-hover:  rgba(0,0,0,0.06);
    --border-subtle:  rgba(0,0,0,0.09);
    --border-glow:    rgba(124,58,237,0.35);
    --text-primary:   #1e293b;
    --text-secondary: #475569;
    --text-muted:     #64748b;
  }
  @media (prefers-color-scheme: light) {
    :root:not(.theme-dark):not(.theme-light) {
      --bg-deep:        #f1f5f9;
      --bg-sidebar:     #e8edf5;
      --bg-card:        rgba(0,0,0,0.03);
      --bg-card-hover:  rgba(0,0,0,0.06);
      --border-subtle:  rgba(0,0,0,0.09);
      --border-glow:    rgba(124,58,237,0.35);
      --text-primary:   #1e293b;
      --text-secondary: #475569;
      --text-muted:     #64748b;
    }
  }

  /* ── Light theme component overrides ──────────────────────────────────── */
  :root.theme-light #toolbar,
  :root:not(.theme-dark):not(.theme-light) #toolbar {
    background: rgba(232,237,245,0.9);
  }
  :root.theme-light .tb-btn,
  :root:not(.theme-dark):not(.theme-light) .tb-btn {
    border-color: rgba(0,0,0,0.12);
    background: rgba(0,0,0,0.04);
  }
  :root.theme-light .tb-btn:hover,
  :root:not(.theme-dark):not(.theme-light) .tb-btn:hover {
    background: rgba(0,0,0,0.08);
    border-color: rgba(0,0,0,0.18);
  }
  :root.theme-light #btn-menu,
  :root:not(.theme-dark):not(.theme-light) #btn-menu {
    border-color: rgba(0,0,0,0.12);
    background: rgba(0,0,0,0.04);
  }
  :root.theme-light #sidebar-header h1,
  :root:not(.theme-dark):not(.theme-light) #sidebar-header h1 {
    background: linear-gradient(135deg, #7c3aed, #3b82f6);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  :root.theme-light .session-uuid,
  :root:not(.theme-dark):not(.theme-light) .session-uuid {
    color: #6d28d9;
    background: rgba(124,58,237,0.1);
    border-color: rgba(124,58,237,0.25);
  }
  :root.theme-light #main,
  :root:not(.theme-dark):not(.theme-light) #main {
    background: radial-gradient(ellipse at 20% 0%, rgba(124,58,237,0.05) 0%, transparent 60%),
                radial-gradient(ellipse at 80% 100%, rgba(59,130,246,0.04) 0%, transparent 60%),
                var(--bg-deep);
  }
  /* Block cards — light mode */
  :root.theme-light .block.user-text,
  :root:not(.theme-dark):not(.theme-light) .block.user-text {
    background: linear-gradient(135deg, rgba(219,234,254,0.7), rgba(241,245,249,0.9));
  }
  :root.theme-light .block.assistant-text,
  :root:not(.theme-dark):not(.theme-light) .block.assistant-text {
    background: linear-gradient(135deg, rgba(237,233,254,0.7), rgba(241,245,249,0.9));
  }
  :root.theme-light .block.tool_use,
  :root:not(.theme-dark):not(.theme-light) .block.tool_use {
    background: linear-gradient(135deg, rgba(254,243,199,0.7), rgba(241,245,249,0.9));
  }
  :root.theme-light .block.tool_result,
  :root:not(.theme-dark):not(.theme-light) .block.tool_result {
    background: linear-gradient(135deg, rgba(241,245,249,0.9), rgba(248,250,252,0.95));
  }
  :root.theme-light .block.thinking,
  :root:not(.theme-dark):not(.theme-light) .block.thinking {
    background: linear-gradient(135deg, rgba(245,243,255,0.8), rgba(241,245,249,0.9));
  }
  /* Block collapse fade — light mode */
  :root.theme-light .block.user-text .block-body.collapsed::after,
  :root:not(.theme-dark):not(.theme-light) .block.user-text .block-body.collapsed::after {
    background: linear-gradient(to bottom, transparent, rgba(219,234,254,0.95));
  }
  :root.theme-light .block.assistant-text .block-body.collapsed::after,
  :root:not(.theme-dark):not(.theme-light) .block.assistant-text .block-body.collapsed::after {
    background: linear-gradient(to bottom, transparent, rgba(237,233,254,0.95));
  }
  :root.theme-light .block.tool_use .block-body.collapsed::after,
  :root:not(.theme-dark):not(.theme-light) .block.tool_use .block-body.collapsed::after {
    background: linear-gradient(to bottom, transparent, rgba(254,243,199,0.95));
  }
  :root.theme-light .block.tool_result .block-body.collapsed::after,
  :root:not(.theme-dark):not(.theme-light) .block.tool_result .block-body.collapsed::after {
    background: linear-gradient(to bottom, transparent, rgba(248,250,252,0.98));
  }
  :root.theme-light .block.thinking .block-body.collapsed::after,
  :root:not(.theme-dark):not(.theme-light) .block.thinking .block-body.collapsed::after {
    background: linear-gradient(to bottom, transparent, rgba(245,243,255,0.95));
  }
  /* Block header hover — light */
  :root.theme-light .block-header:hover,
  :root:not(.theme-dark):not(.theme-light) .block-header:hover {
    background: rgba(0,0,0,0.03);
  }
  /* Parse warn — light */
  :root.theme-light .parse-warn,
  :root:not(.theme-dark):not(.theme-light) .parse-warn {
    background: rgba(254,243,199,0.8);
    border-color: rgba(217,119,6,0.35);
  }
  @media (prefers-color-scheme: light) {
    :root:not(.theme-dark):not(.theme-light) #toolbar { background: rgba(232,237,245,0.9); }
  }

  html, body {
    height: 100%;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg-deep);
    color: var(--text-primary);
    overflow: hidden;
  }

  /* Scrollbars */
  ::-webkit-scrollbar { width: var(--scrollbar-w); height: var(--scrollbar-w); }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.3); border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.55); }

  /* ── Layout ─────────────────────────────────────────────────────────── */
  #app {
    display: flex;
    height: 100dvh;
    overflow: hidden;
  }

  /* ── Sidebar ─────────────────────────────────────────────────────────── */
  #sidebar {
    width: 300px;
    min-width: 300px;
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }
  #sidebar::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--accent-purple), var(--accent-blue));
    z-index: 10;
  }

  #sidebar-header {
    padding: 20px 18px 14px;
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }
  #sidebar-header .logo-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }
  #sidebar-header .logo-icon {
    font-size: 22px;
    line-height: 1;
    filter: drop-shadow(0 0 8px var(--accent-purple));
  }
  #sidebar-header h1 {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.02em;
    background: linear-gradient(135deg, #c4b5fd, #93c5fd);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  #sidebar-header .sub {
    font-size: 11px;
    color: var(--text-muted);
    margin-left: 32px;
  }

  #session-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .session-item {
    padding: 12px 16px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    position: relative;
    margin: 2px 8px;
    border-radius: 8px;
    border-left: 3px solid transparent;
  }
  .session-item:hover {
    background: var(--bg-card-hover);
    border-left-color: rgba(124,58,237,0.5);
    box-shadow: 0 0 12px rgba(124,58,237,0.12), inset 0 0 0 1px rgba(124,58,237,0.15);
    transform: translateX(2px);
  }
  .session-item.active {
    background: linear-gradient(135deg, rgba(79,70,229,0.18), rgba(59,130,246,0.12));
    border-left-color: var(--accent-purple);
    box-shadow: 0 0 16px rgba(124,58,237,0.2), inset 0 0 0 1px rgba(124,58,237,0.2);
  }

  .session-time {
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 3px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .session-time .rel { color: var(--text-primary); font-weight: 500; }
  .session-uuid {
    display: inline-block;
    font-size: 11px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: #c4b5fd;
    background: rgba(124,58,237,0.15);
    padding: 1px 5px;
    border-radius: 4px;
    border: 1px solid rgba(124,58,237,0.3);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: middle;
  }
  .session-preview {
    font-size: 12px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.5;
  }

  .sessions-empty {
    padding: 32px 16px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }

  /* ── Main panel ──────────────────────────────────────────────────────── */
  #main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: radial-gradient(ellipse at 20% 0%, rgba(79,70,229,0.07) 0%, transparent 60%),
                radial-gradient(ellipse at 80% 100%, rgba(59,130,246,0.05) 0%, transparent 60%),
                var(--bg-deep);
  }

  /* ── Toolbar ─────────────────────────────────────────────────────────── */
  #toolbar {
    padding: 8px 16px;
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    background: rgba(13,20,36,0.8);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  #toolbar::-webkit-scrollbar { display: none; }
  #toolbar-title {
    flex: 1;
    min-width: 60px;
    font-size: 13px;
    color: var(--text-muted);
    font-family: 'SF Mono', 'Fira Code', monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  #toolbar-title span { color: var(--text-secondary); }

  .tb-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 99px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    user-select: none;
    flex-shrink: 0;
  }
  .tb-btn:hover {
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.18);
    color: var(--text-primary);
    box-shadow: 0 0 8px rgba(124,58,237,0.2);
  }
  .tb-btn.active {
    background: rgba(124,58,237,0.2);
    border-color: rgba(124,58,237,0.5);
    color: #c4b5fd;
    box-shadow: 0 0 12px rgba(124,58,237,0.35);
  }
  .tb-btn:focus-visible, .session-item:focus-visible {
    outline: 2px solid var(--accent-purple);
    outline-offset: 2px;
  }

  /* Mobile hamburger */
  #btn-menu {
    display: none;
    align-items: center;
    justify-content: center;
    width: 32px; height: 32px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
    color: var(--text-secondary);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  #btn-menu:hover { background: rgba(255,255,255,0.08); }
  #btn-menu:focus-visible { outline: 2px solid var(--accent-purple); outline-offset: 2px; }

  /* Sidebar overlay */
  #sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 40;
  }
  #sidebar-overlay.visible { display: block; }

  /* Date group headers */
  .date-group-label {
    padding: 10px 16px 4px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  @media (max-width: 767px) {
    #btn-menu { display: flex; }
    #sidebar {
      position: fixed;
      top: 0; left: 0;
      height: 100dvh;
      z-index: 50;
      transform: translateX(-100%);
      transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
      width: 280px;
      min-width: 0;
    }
    #sidebar.open {
      transform: translateX(0);
      box-shadow: 4px 0 32px rgba(0,0,0,0.5);
    }
    #toolbar { gap: 6px; padding: 10px 12px; }
    #toolbar-title { display: none; }
    .tb-btn { padding: 5px 8px; font-size: 11px; gap: 4px; }
  }

  /* ── Conversation panel ──────────────────────────────────────────────── */
  #conv-panel {
    flex: 1;
    overflow-y: auto;
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Welcome / empty states */
  #welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 16px;
    color: var(--text-muted);
    text-align: center;
  }
  #welcome .big-icon {
    display: flex;
    filter: drop-shadow(0 0 24px rgba(124,58,237,0.5));
    animation: float 3s ease-in-out infinite;
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-8px); }
  }
  #welcome h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-secondary);
  }
  #welcome p { font-size: 13px; max-width: 280px; line-height: 1.6; }

  /* ── Block cards ─────────────────────────────────────────────────────── */
  .block {
    border-radius: 10px;
    border: 1px solid var(--border-subtle);
    overflow: hidden;
    transition: box-shadow 0.2s;
    flex-shrink: 0; /* prevent flex container from compressing blocks to 0px */
  }
  .block:hover { box-shadow: 0 2px 20px rgba(0,0,0,0.3); }

  /* Type colours */
  .block.user-text {
    border-left: 3px solid #1d4ed8;
    background: linear-gradient(135deg, rgba(15,33,87,0.6), rgba(10,15,30,0.8));
  }
  .block.user-text:hover { box-shadow: 0 2px 20px rgba(29,78,216,0.2); }
  .block.user-text .block-header { border-bottom-color: rgba(29,78,216,0.15); }

  .block.assistant-text {
    border-left: 3px solid #6d28d9;
    background: linear-gradient(135deg, rgba(15,10,30,0.8), rgba(10,15,30,0.8));
  }
  .block.assistant-text:hover { box-shadow: 0 2px 20px rgba(109,40,217,0.2); }
  .block.assistant-text .block-header { border-bottom-color: rgba(109,40,217,0.15); }

  .block.tool_use {
    border-left: 3px solid #d97706;
    background: linear-gradient(135deg, rgba(28,10,0,0.8), rgba(10,15,30,0.8));
  }
  .block.tool_use:hover { box-shadow: 0 2px 20px rgba(217,119,6,0.2); }
  .block.tool_use .block-header { border-bottom-color: rgba(217,119,6,0.15); }

  .block.tool_result {
    border-left: 3px solid #475569;
    background: linear-gradient(135deg, rgba(10,15,30,0.9), rgba(10,15,30,0.8));
  }
  .block.tool_result:hover { box-shadow: 0 2px 20px rgba(71,85,105,0.2); }
  .block.tool_result .block-header { border-bottom-color: rgba(71,85,105,0.15); }

  .block.thinking {
    border-left: 3px solid #7c3aed;
    background: linear-gradient(135deg, rgba(26,5,53,0.85), rgba(10,15,30,0.8));
    display: none;
  }
  .block.thinking.visible { display: block; }
  .block.thinking:hover { box-shadow: 0 2px 20px rgba(124,58,237,0.25); }
  .block.thinking .block-header { border-bottom-color: rgba(124,58,237,0.2); }

  .block-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    cursor: pointer;
    border-bottom: 1px solid transparent;
    user-select: none;
    transition: background 0.1s;
  }
  .block-header:hover { background: rgba(255,255,255,0.03); }

  .block-icon { font-size: 14px; flex-shrink: 0; }
  .block-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .block-preview {
    flex: 1;
    font-size: 12px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    padding: 0 8px;
  }
  .block.user-text    .block-label { color: #60a5fa; }
  .block.assistant-text .block-label { color: #a78bfa; }
  .block.tool_use     .block-label { color: #fbbf24; }
  .block.tool_result  .block-label { color: #94a3b8; }
  .block.thinking     .block-label { color: #c4b5fd; }

  .block-meta {
    font-size: 10px;
    color: var(--text-muted);
    font-family: 'SF Mono', 'Fira Code', monospace;
  }
  .block-toggle {
    font-size: 10px;
    color: var(--text-muted);
    transition: transform 0.2s;
    flex-shrink: 0;
  }

  .block-body {
    position: relative;
    overflow: hidden;
  }
  /* Transition only fires on user-triggered toggles (class added by JS) */
  .block-body.animating {
    transition: max-height 0.3s cubic-bezier(0.4,0,0.2,1);
  }

  /* Collapsed: show ~3 lines; expanded: scrollable (max-height set by JS, this is fallback) */
  .block-body.collapsed { max-height: 96px; }
  .block-body.expanded  { max-height: calc(100vh - 120px); overflow-y: auto; }

  /* Fade gradient on collapsed — per-type background match */
  .block-body.collapsed::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 40px;
    pointer-events: none;
  }
  .block.user-text    .block-body.collapsed::after { background: linear-gradient(to bottom, transparent, rgba(15,33,87,0.9)); }
  .block.assistant-text .block-body.collapsed::after { background: linear-gradient(to bottom, transparent, rgba(15,10,30,0.95)); }
  .block.tool_use     .block-body.collapsed::after { background: linear-gradient(to bottom, transparent, rgba(28,10,0,0.95)); }
  .block.tool_result  .block-body.collapsed::after { background: linear-gradient(to bottom, transparent, rgba(10,15,30,0.98)); }
  .block.thinking     .block-body.collapsed::after { background: linear-gradient(to bottom, transparent, rgba(26,5,53,0.95)); }

  .block-body pre {
    padding: 12px 14px;
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
    font-size: 12.5px;
    line-height: 1.65;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text-primary);
  }
  .block-body p {
    padding: 12px 14px;
    font-size: 13.5px;
    line-height: 1.75;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* Tool name badge in header */
  .tool-name-badge {
    font-size: 11px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: #fbbf24;
    background: rgba(217,119,6,0.12);
    border: 1px solid rgba(217,119,6,0.25);
    padding: 1px 7px;
    border-radius: 5px;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Loading spinner */
  .spinner {
    display: inline-block;
    width: 18px; height: 18px;
    border: 2px solid rgba(124,58,237,0.2);
    border-top-color: var(--accent-purple);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Highlight pulse — shown when a block is scrolled into view after expand */
  @keyframes block-found {
    0%   { box-shadow: 0 0 0 3px rgba(124,58,237,0.9), 0 0 28px rgba(124,58,237,0.6); }
    60%  { box-shadow: 0 0 0 4px rgba(124,58,237,1.0), 0 0 48px rgba(124,58,237,0.8); }
    100% { box-shadow: 0 0 0 0 rgba(124,58,237,0); }
  }
  /* No forwards fill — lets hover box-shadow work normally after animation */
  .block.highlight-pulse { animation: block-found 1s ease-out; }
  @media (prefers-reduced-motion: reduce) {
    .block.highlight-pulse { animation: none; }
  }

  .tb-divider {
    width: 1px;
    height: 20px;
    background: var(--border-subtle);
    flex-shrink: 0;
    margin: 0 2px;
  }

  #loading-sessions, #loading-conv {
    display: flex; align-items: center; gap: 10px;
    padding: 20px 16px; color: var(--text-muted); font-size: 13px;
  }

  /* parse-warn banner */
  .parse-warn {
    background: rgba(217,119,6,0.12);
    border: 1px solid rgba(217,119,6,0.3);
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 12px;
    color: #fbbf24;
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
</head>
<body>
<div id="app">
  <!-- Sidebar -->
  <nav id="sidebar">
    <div id="sidebar-header">
      <div class="logo-row">
        <span class="logo-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="1.5" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>
        <h1>Claude Sessions</h1>
      </div>
      <div class="sub">Session Viewer</div>
    </div>
    <div id="session-list">
      <div id="loading-sessions"><span class="spinner"></span>Loading sessions…</div>
    </div>
  </nav>

  <!-- Mobile sidebar overlay -->
  <div id="sidebar-overlay" onclick="toggleSidebar()"></div>

  <!-- Main panel -->
  <div id="main">
    <!-- Toolbar -->
    <div id="toolbar">
      <button id="btn-menu" onclick="toggleSidebar()" aria-label="Toggle session list">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <div id="toolbar-title">Select a session</div>
      <button class="tb-btn tb-filter" id="btn-filter-user" onclick="setFilter('user')" title="Show only User messages" aria-pressed="false">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        User
      </button>
      <button class="tb-btn tb-filter" id="btn-filter-assistant" onclick="setFilter('assistant')" title="Show only Assistant messages" aria-pressed="false">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 8V5"/><circle cx="9" cy="14" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.5" fill="currentColor" stroke="none"/></svg>
        Assistant
      </button>
      <button class="tb-btn tb-filter" id="btn-filter-tool" onclick="setFilter('tool')" title="Show only Tool calls &amp; results" aria-pressed="false">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
        Tool
      </button>
      <span class="tb-divider" aria-hidden="true"></span>
      <button class="tb-btn" id="btn-thinking" onclick="toggleThinking()" title="Toggle Thinking blocks" aria-pressed="false">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        Thinking
      </button>
      <button class="tb-btn" onclick="expandAll()" title="Expand all">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>
        Expand
      </button>
      <button class="tb-btn" onclick="collapseAll()" title="Collapse all">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="7 11 12 6 17 11"/><polyline points="7 18 12 13 17 18"/></svg>
        Collapse
      </button>
      <button class="tb-btn" id="btn-theme" onclick="cycleTheme()" title="Toggle theme">
        <svg id="theme-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        <span id="theme-label">System</span>
      </button>
    </div>
    <!-- Conversation -->
    <div id="conv-panel">
      <div id="welcome">
        <div class="big-icon" aria-hidden="true"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
        <h2>Claude Code Session Viewer</h2>
        <p>Select a session from the sidebar to explore the conversation.</p>
      </div>
    </div>
  </div>
</div>

<script>
  // ── State ─────────────────────────────────────────────────────────────
  let showThinking    = false;
  let activeFilter    = null;   // null | 'user' | 'assistant' | 'tool'
  let activeSessionId = null;
  let currentTheme    = 'system'; // 'system' | 'dark' | 'light'

  // ── Boot ──────────────────────────────────────────────────────────────
  loadSessionList();

  // ── Session list ──────────────────────────────────────────────────────
  async function loadSessionList() {
    try {
      const res  = await fetch('/api/sessions');
      const list = await res.json();
      renderSessionList(list);
    } catch (e) {
      document.getElementById('session-list').innerHTML =
        \`<div class="sessions-empty">⚠ Failed to load sessions<br><small>\${escHtml(String(e))}</small></div>\`;
    }
  }

  function renderSessionList(list) {
    const el = document.getElementById('session-list');
    if (!list.length) {
      el.innerHTML = '<div class="sessions-empty">No sessions found.</div>';
      return;
    }

    // Group by day relative to now, keyed by lastTime
    const now    = Date.now();
    const groups = [];    // [{ label, items }]
    const seen   = new Set();

    function dayLabel(ts) {
      const d    = new Date(ts);
      const diff = now - ts;
      const days = Math.floor(diff / 86400000);
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days  < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
      if (days  < 30) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    }

    for (const s of list) {
      const label = dayLabel(new Date(s.lastTime).getTime());
      if (!seen.has(label)) { seen.add(label); groups.push({ label, items: [] }); }
      groups[groups.length - 1].items.push(s);
    }

    el.innerHTML = groups.map(g => {
      const rows = g.items.map(s => {
        const rel     = timeAgo(s.lastTime);
        const shortId = s.id.slice(0, 16);
        return \`<div class="session-item" data-id="\${escHtml(s.id)}"
            tabindex="0" role="button"
            onclick="loadSession('\${escHtml(s.id)}')"
            onkeydown="if(event.key==='Enter'||event.key===' ')loadSession('\${escHtml(s.id)}')">
          <div class="session-time">
            <span class="rel">\${escHtml(rel)}</span>
            <span class="session-uuid">\${escHtml(shortId)}</span>
          </div>
          <div class="session-preview">\${escHtml(s.firstPrompt)}</div>
        </div>\`;
      }).join('');
      return \`<div class="date-group-label">\${escHtml(g.label)}</div>\${rows}\`;
    }).join('');
  }

  // ── Session detail ────────────────────────────────────────────────────
  async function loadSession(id) {
    // Update active state in sidebar
    document.querySelectorAll('.session-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });
    activeSessionId = id;
    // Close sidebar on mobile
    const sb = document.getElementById('sidebar');
    if (sb.classList.contains('open')) toggleSidebar();

    // Show loading
    const conv = document.getElementById('conv-panel');
    conv.innerHTML = '<div id="loading-conv"><span class="spinner"></span>Loading conversation…</div>';
    document.getElementById('toolbar-title').innerHTML = \`<span>\${escHtml(id.slice(0,32))}…</span>\`;

    try {
      const res  = await fetch(\`/api/session/\${encodeURIComponent(id)}\`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      renderConversation(data);
    } catch (e) {
      conv.innerHTML = \`<div class="parse-warn">⚠ \${escHtml(String(e))}</div>\`;
    }
  }

  function renderConversation(data) {
    _blockId = 0;
    const conv = document.getElementById('conv-panel');
    let html = '';

    if (data.parseWarn) {
      html += '<div class="parse-warn">⚠ Some lines in this session file could not be parsed.</div>';
    }

    for (const turn of data.turns) {
      for (const block of turn.blocks) {
        html += renderBlock(block, turn.timestamp, turn.role);
      }
    }

    conv.innerHTML = html || '<div class="sessions-empty">No content in this session.</div>';
    applyFilters();
    conv.scrollTop = 0;

    // Update toolbar title
    const dt = new Date(data.startTime);
    document.getElementById('toolbar-title').innerHTML =
      \`<span>\${escHtml(dt.toLocaleString())}</span>\`;
  }

  // ── Block rendering ───────────────────────────────────────────────────
  let _blockId = 0;

  function renderBlock(block, ts, role) {
    const id = 'blk-' + (++_blockId);

    // SVG icon set
    const ICO = {
      thinking: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
      tool:     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
      result:   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
      user:     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
      bot:      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 8V5"/><circle cx="9" cy="14" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.5" fill="currentColor" stroke="none"/></svg>',
    };

    // Determine CSS class
    let cssClass, icon, label, extraHeader = '';
    if (block.type === 'thinking') {
      cssClass = 'thinking'; icon = ICO.thinking; label = 'Thinking';
    } else if (block.type === 'tool_use') {
      cssClass = 'tool_use'; icon = ICO.tool; label = 'Tool Call';
      extraHeader = \`<span class="tool-name-badge">\${escHtml(block.name || '')}</span>\`;
    } else if (block.type === 'tool_result') {
      cssClass = 'tool_result'; icon = ICO.result; label = 'Tool Result';
    } else if (role === 'user') {
      cssClass = 'user-text'; icon = ICO.user; label = 'User';
    } else {
      cssClass = 'assistant-text'; icon = ICO.bot; label = 'Assistant';
    }

    const timeStr = ts ? new Date(ts).toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' }) : '';

    // Build inline preview (single line, truncated)
    const rawText = block.type === 'tool_use' ? (block.input || '') : (block.text || '');
    const preview = rawText.replace(/\\s+/g, ' ').trim().slice(0, 100);

    // Build body content
    let bodyContent;
    if (block.type === 'tool_use') {
      bodyContent = \`<pre>\${escHtml(block.input || '')}</pre>\`;
    } else {
      bodyContent = \`<p>\${escHtml(block.text || '')}</p>\`;
    }

    return \`<div class="block \${cssClass}" id="\${id}">
      <div class="block-header" onclick="toggleBlock('\${id}')">
        <span class="block-icon">\${icon}</span>
        <span class="block-label">\${label}</span>
        \${extraHeader}
        <span class="block-preview">\${escHtml(preview)}</span>
        <span class="block-meta">\${escHtml(timeStr)}</span>
        <span class="block-toggle" id="\${id}-tog">▼</span>
      </div>
      <div class="block-body collapsed" id="\${id}-body">
        \${bodyContent}
      </div>
    </div>\`;
  }

  // ── Interaction helpers ───────────────────────────────────────────────
  function toggleBlock(id) {
    const body   = document.getElementById(id + '-body');
    const tog    = document.getElementById(id + '-tog');
    const block  = body && body.parentElement;
    if (!body) return;
    body.classList.add('animating');
    const isCollapsed = body.classList.contains('collapsed');
    body.classList.toggle('collapsed', !isCollapsed);
    body.classList.toggle('expanded',   isCollapsed);
    if (tog) tog.textContent = isCollapsed ? '▲' : '▼';

    if (isCollapsed) {
      // Expanding: set dynamic max-height = viewport minus toolbar + header
      const toolbar  = document.getElementById('toolbar');
      const toolbarH = toolbar ? toolbar.getBoundingClientRect().height : 48;
      const headerH  = body.previousElementSibling
                         ? body.previousElementSibling.getBoundingClientRect().height : 40;
      const maxH     = Math.max(200, window.innerHeight - toolbarH - headerH);
      body.style.maxHeight = maxH + 'px';

      // Double rAF: first rAF queues after style changes; second fires after
      // the browser has run layout, making getBoundingClientRect reliable.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        // Bail if the block was toggled back before layout settled
        if (!body.classList.contains('expanded')) return;
        const conv = document.getElementById('conv-panel');
        if (!conv || !block) return;
        const blockBottom = block.getBoundingClientRect().bottom;
        const convBottom  = conv.getBoundingClientRect().bottom;
        if (blockBottom <= convBottom) return; // fits — no scroll needed

        // Doesn't fit — scroll to top, highlight when scroll settles
        const target = block.offsetTop - conv.offsetTop;
        conv.scrollTo({ top: target, behavior: 'smooth' });

        const addHighlight = () => {
          block.classList.add('highlight-pulse');
          // Remove class when animation ends; safety timeout covers
          // prefers-reduced-motion and browsers that skip animationend.
          const cleanup = () => block.classList.remove('highlight-pulse');
          block.addEventListener('animationend', cleanup, { once: true });
          setTimeout(cleanup, 1200);
        };
        // scrollend fires when smooth scroll completes (Chrome 114+, FF 109+).
        // Fall back to a generous timeout on older browsers.
        if ('onscrollend' in conv) {
          conv.addEventListener('scrollend', addHighlight, { once: true });
        } else {
          setTimeout(addHighlight, 600);
        }
      }));
    } else {
      // Collapsing: remove inline style so CSS class rule takes over
      body.style.maxHeight = '';
    }
  }

  function expandAll() {
    document.querySelectorAll('.block-body').forEach(body => {
      if (body.closest('.thinking') && !body.closest('.thinking').classList.contains('visible')) return;
      const tog = document.getElementById(body.parentElement.id + '-tog');
      body.classList.add('animating');
      body.classList.remove('collapsed');
      body.classList.add('expanded');
      // Use a generous fixed height for bulk expand (no scroll-into-view)
      body.style.maxHeight = 'calc(100vh - 120px)';
      if (tog) tog.textContent = '▲';
    });
  }

  function collapseAll() {
    document.querySelectorAll('.block-body').forEach(body => {
      if (body.closest('.thinking') && !body.closest('.thinking').classList.contains('visible')) return;
      const tog = document.getElementById(body.parentElement.id + '-tog');
      body.classList.add('animating');
      body.classList.remove('expanded');
      body.classList.add('collapsed');
      body.style.maxHeight = '';
      if (tog) tog.textContent = '▼';
    });
  }

  function toggleThinking() {
    showThinking = !showThinking;
    const btn = document.getElementById('btn-thinking');
    btn.classList.toggle('active', showThinking);
    btn.setAttribute('aria-pressed', String(showThinking));
    applyFilters();
  }

  // Filter: click same type to deactivate; click different type to switch
  function setFilter(type) {
    activeFilter = (activeFilter === type) ? null : type;
    ['user', 'assistant', 'tool'].forEach(t => {
      const btn = document.getElementById('btn-filter-' + t);
      if (btn) {
        btn.classList.toggle('active', activeFilter === t);
        btn.setAttribute('aria-pressed', String(activeFilter === t));
      }
    });
    applyFilters();
  }

  // Applies both the active exclusive filter and the thinking toggle
  function applyFilters() {
    // Thinking: always independent toggle
    document.querySelectorAll('.block.thinking').forEach(el => {
      el.classList.toggle('visible', showThinking);
      el.style.display = showThinking ? '' : 'none';
    });

    // Non-thinking blocks
    document.querySelectorAll('.block:not(.thinking)').forEach(el => {
      let show = true;
      if (activeFilter !== null) {
        if (activeFilter === 'user')      show = el.classList.contains('user-text');
        if (activeFilter === 'assistant') show = el.classList.contains('assistant-text');
        if (activeFilter === 'tool')      show = el.classList.contains('tool_use') || el.classList.contains('tool_result');
      }
      el.style.display = show ? '' : 'none';
    });
  }

  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const isOpen  = sidebar.classList.toggle('open');
    overlay.classList.toggle('visible', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  const THEMES = ['system', 'dark', 'light'];
  const THEME_ICONS = {
    system: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
    dark:   '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    light:  '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  };

  function cycleTheme() {
    currentTheme = THEMES[(THEMES.indexOf(currentTheme) + 1) % THEMES.length];
    applyTheme();
  }

  function applyTheme() {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light');
    if (currentTheme === 'dark')  root.classList.add('theme-dark');
    if (currentTheme === 'light') root.classList.add('theme-light');
    const label = document.getElementById('theme-label');
    const icon  = document.getElementById('theme-icon');
    if (label) label.textContent = currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1);
    if (icon)  icon.innerHTML = THEME_ICONS[currentTheme];
    try { localStorage.setItem('sv-theme', currentTheme); } catch {}
  }

  // Restore saved theme on boot
  try {
    const saved = localStorage.getItem('sv-theme');
    if (THEMES.includes(saved)) { currentTheme = saved; applyTheme(); }
  } catch {}

  // ── Utilities ─────────────────────────────────────────────────────────
  function escHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function timeAgo(dateStr) {
    if (!dateStr) return 'unknown';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  <  1) return 'just now';
    if (mins  < 60) return mins  + ' minute'  + (mins  === 1 ? '' : 's') + ' ago';
    if (hours < 24) return hours + ' hour'    + (hours === 1 ? '' : 's') + ' ago';
    if (days  <  7) return days  + ' day'     + (days  === 1 ? '' : 's') + ' ago';
    return new Date(dateStr).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
  }

  // Auto-shutdown: keep a heartbeat connection so the server knows the tab is open.
  // When the tab closes the connection drops; the server will exit after a short delay.
  (function keepAlive() {
    const es = new EventSource('/api/heartbeat');
    es.onerror = () => { es.close(); setTimeout(keepAlive, 3000); };
  })();
</script>
</body>
</html>`;

// --- Slug encoding ---
// Replace each \ / : with - (character-by-character, no collapsing)
function cwdToSlug(cwd) {
  return cwd.replace(/[\\/:]/g, '-');
}

// --- Locate sessions directory ---
function getSessionsDir() {
  const slug = cwdToSlug(process.cwd());
  return path.join(os.homedir(), '.claude', 'projects', slug);
}

// Returns array of { id, file, mtime } sorted newest-first by file mtime.
// When dir is the top-level projects/ folder (--all mode), recurses one level.
function listSessionFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const ent of entries) {
    if (ent.isDirectory()) {
      // one level deep — collect .jsonl files from each project subdir
      const sub = path.join(dir, ent.name);
      try {
        for (const f of fs.readdirSync(sub)) {
          if (!f.endsWith('.jsonl')) continue;
          const file = path.join(sub, f);
          results.push({ id: path.basename(f, '.jsonl'), file, mtime: fs.statSync(file).mtimeMs, project: ent.name });
        }
      } catch { /* skip unreadable subdirs */ }
    } else if (ent.name.endsWith('.jsonl')) {
      const file = path.join(dir, ent.name);
      results.push({ id: path.basename(ent.name, '.jsonl'), file, mtime: fs.statSync(file).mtimeMs });
    }
  }
  return results.sort((a, b) => b.mtime - a.mtime);
}

// Parses a .jsonl file, skipping blank and malformed lines.
// Returns { entries, parseWarn } where parseWarn is true if >10% of
// non-blank lines failed to parse.
function parseJsonlFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split('\n');
  const nonBlank = lines.filter(l => l.trim() !== '');
  let failed = 0;
  const entries = [];
  for (const line of nonBlank) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      failed++;
    }
  }
  return { entries, parseWarn: nonBlank.length > 0 && (failed / nonBlank.length) > 0.1 };
}

// Handles both string and ContentBlock[] variants of tool_result.content
function extractToolResultText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(c => c.type === 'text' ? c.text : '[non-text content]')
      .join('\n');
  }
  return String(content);
}

// Converts raw JSONL entries to the API turn format.
// Skips file-history-snapshot and queue-operation entries.
function buildTurns(entries) {
  const turns = [];
  for (const entry of entries) {
    if (entry.type !== 'user' && entry.type !== 'assistant') continue;
    const msg = entry.message;
    if (!msg) continue;
    // message.content can be a plain string (older format) or an array of blocks
    if (typeof msg.content === 'string') {
      if (msg.content.trim() === '') continue;
      turns.push({ role: entry.type, timestamp: entry.timestamp,
                   blocks: [{ type: 'text', text: msg.content }] });
      continue;
    }
    if (!Array.isArray(msg.content)) continue;
    const blocks = [];
    for (const block of msg.content) {
      if (block.type === 'text') {
        blocks.push({ type: 'text', text: block.text });
      } else if (block.type === 'thinking') {
        blocks.push({ type: 'thinking', text: block.thinking });
      } else if (block.type === 'tool_use') {
        blocks.push({
          type:  'tool_use',
          name:  block.name,
          input: JSON.stringify(block.input, null, 2),
        });
      } else if (block.type === 'tool_result') {
        blocks.push({ type: 'tool_result', text: extractToolResultText(block.content) });
      }
    }
    if (blocks.length === 0) continue;
    turns.push({ role: entry.type, timestamp: entry.timestamp, blocks });
  }
  return turns;
}

// Returns the summary object for /api/sessions list.
// Returns null if the session has no user/assistant turns (empty session).
function getSessionSummary(id, file) {
  const { entries } = parseJsonlFile(file);
  const hasUserOrAssistant = entries.some(e => e.type === 'user' || e.type === 'assistant');
  if (!hasUserOrAssistant) return null; // empty session — exclude from list
  const firstUser = entries.find(e => e.type === 'user');
  const startTime = firstUser
    ? firstUser.timestamp
    : fs.statSync(file).mtime.toISOString();
  // lastTime = timestamp of last user/assistant entry, or file mtime
  const lastEntry = [...entries].reverse().find(e => e.type === 'user' || e.type === 'assistant');
  const lastTime  = lastEntry?.timestamp || fs.statSync(file).mtime.toISOString();
  let firstPrompt = '[no text content]';
  const fc = firstUser?.message?.content;
  if (typeof fc === 'string' && fc.trim()) {
    firstPrompt = fc.trim().slice(0, 80);
  } else if (Array.isArray(fc)) {
    const textBlock = fc.find(b => b.type === 'text');
    if (textBlock) firstPrompt = textBlock.text.slice(0, 80);
  }
  return { id, startTime, lastTime, firstPrompt };
}

// Returns the full session detail for /api/session/:id
function getSessionDetail(id, file) {
  const { entries, parseWarn } = parseJsonlFile(file);
  const turns = buildTurns(entries);
  if (turns.length === 0) return null; // empty session — excluded
  const firstUser = entries.find(e => e.type === 'user');
  const startTime = firstUser
    ? firstUser.timestamp
    : fs.statSync(file).mtime.toISOString();
  return { id, startTime, turns, parseWarn };
}

// --- Open browser ---
function openBrowser(url) {
  // On Windows, the first arg to `start` is the window title — pass "" to avoid
  // the URL being interpreted as the title.
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
            : process.platform === 'darwin' ? `open ${url}`
            : `xdg-open ${url}`;
  cp.exec(cmd);
}

// --- Auto-shutdown via SSE heartbeat ---
// Track open browser connections. When the last one drops, exit after a grace period.
let activeConnections = 0;
let shutdownTimer = null;
const SHUTDOWN_DELAY_MS = 5000; // wait 5 s after last tab closes

function scheduleShutdown() {
  if (shutdownTimer) return;
  shutdownTimer = setTimeout(() => {
    if (activeConnections === 0) process.exit(0);
  }, SHUTDOWN_DELAY_MS);
}

function cancelShutdown() {
  if (shutdownTimer) { clearTimeout(shutdownTimer); shutdownTimer = null; }
}

// --- Try ports ---
function startServer(handler, ports, idx = 0, noOpen = false) {
  if (idx >= ports.length) {
    console.error(`Error: Could not find an available port (tried ${ports.join(', ')}). Free one of these ports and try again.`);
    process.exit(1);
  }
  const server = http.createServer(handler);
  server.listen(ports[idx], () => {
    const url = `http://localhost:${ports[idx]}`;
    console.log(`claude-sessions running at ${url}`);
    if (!noOpen) openBrowser(url);
  });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') startServer(handler, ports, idx + 1, noOpen);
    else throw e;
  });
}

// --- Request handler ---
function handleRequest(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/heartbeat') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('data: ok\n\n');
    activeConnections++;
    cancelShutdown();
    const interval = setInterval(() => res.write('data: ping\n\n'), 15000);
    req.on('close', () => {
      clearInterval(interval);
      activeConnections = Math.max(0, activeConnections - 1);
      if (activeConnections === 0) scheduleShutdown();
    });
    return;
  }

  if (url.pathname === '/api/sessions') {
    const files = listSessionFiles(sessionsDir);
    const sessions = [];
    for (const f of files) {
      try {
        const summary = getSessionSummary(f.id, f.file);
        if (summary) sessions.push(summary);
      } catch { /* skip unreadable files */ }
    }
    // Sort newest-first by last activity time
    sessions.sort((a, b) => b.lastTime.localeCompare(a.lastTime));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sessions));
    return;
  }

  const sessionMatch = url.pathname.match(/^\/api\/session\/(.+)$/);
  if (sessionMatch) {
    const id = sessionMatch[1];
    const files = listSessionFiles(sessionsDir);
    const entry = files.find(f => f.id === id);
    if (!entry) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }
    const detail = getSessionDetail(entry.id, entry.file);
    if (!detail) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Empty session' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(detail));
    return;
  }

  if (url.pathname === '/') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(HTML_TEMPLATE);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

// --- CLI ---
const pkg     = (() => { try { return require('./package.json'); } catch { return {}; } })();
const VERSION = pkg.version || '1.0.0';
const HELP = `
claude-sessions v${VERSION}
Browse your Claude Code conversation history in a local web UI.

Usage:
  claude-sessions [options]

Options:
  --all            Show sessions from all projects under ~/.claude/projects/
  --dir <path>     Show sessions from a specific directory
  --port <n>       Preferred port (default: 3333, tries 3334 and 3335 as fallback)
  --no-open        Don't open the browser automatically
  --version        Print version
  --help           Print this help

Examples:
  session-viewer.js               # current project's sessions
  session-viewer.js --all         # all projects
  session-viewer.js --dir ~/work  # custom path
`.trim();

const argv    = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) { console.log(HELP); process.exit(0); }
if (argv.includes('--version') || argv.includes('-v')) { console.log(VERSION); process.exit(0); }

const noOpen  = argv.includes('--no-open');
const showAll = argv.includes('--all');

let preferredPort = 3333;
const portIdx = argv.indexOf('--port');
if (portIdx !== -1 && argv[portIdx + 1]) preferredPort = parseInt(argv[portIdx + 1], 10) || 3333;

let sessionsDir;
const dirIdx = argv.indexOf('--dir');
if (dirIdx !== -1 && argv[dirIdx + 1]) {
  sessionsDir = path.resolve(argv[dirIdx + 1]);
} else if (showAll) {
  sessionsDir = path.join(os.homedir(), '.claude', 'projects');
} else {
  sessionsDir = getSessionsDir();
}

if (!fs.existsSync(sessionsDir)) {
  console.error(`Sessions directory not found: ${sessionsDir}`);
  if (!showAll && !dirIdx) console.error('Tip: run inside a Claude Code project, or use --all to browse all projects.');
  process.exit(1);
}

const ports = [preferredPort, preferredPort + 1, preferredPort + 2].filter((p, i, a) => a.indexOf(p) === i);
startServer(handleRequest, ports, 0, noOpen);
