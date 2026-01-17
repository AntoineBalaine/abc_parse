/**
 * svg-renderer.ts
 *
 * Module for rendering ABC notation to SVG strings using abcjs.
 * Because abcjs requires a DOM environment, we use svgdom to provide one in Node.js.
 * svgdom is a lightweight DOM implementation with SVG support including getBBox().
 *
 * Because all formatting should come from ABC directives (%%staffwidth, %%scale, etc.),
 * we don't expose rendering options. The renderer only controls technical defaults
 * like padding and responsive SVG mode.
 */

import * as abcjs from "abcjs";
import { createHTMLWindow } from "svgdom";

/**
 * Result of SVG rendering
 */
export interface SvgRenderResult {
  /**
   * Array of SVG strings, one per tune
   */
  svgs: string[];

  /**
   * Metadata about the rendering
   */
  metadata: {
    tuneCount: number;
    warnings?: string[];
  };
}

/**
 * Render ABC notation to SVG strings
 *
 * Because all formatting comes from ABC directives, we only set technical defaults
 * for padding and responsive SVG mode.
 *
 * @param abcContent The ABC notation content to render
 * @returns Result containing SVG strings and metadata
 */
export function renderAbcToSvg(abcContent: string): SvgRenderResult {
  // Create a fake DOM environment for abcjs using svgdom
  const window = createHTMLWindow();
  const document = window.document;

  // Create container element for abcjs to render into
  const container = document.createElement("div");
  container.id = "abc-container";
  document.body.appendChild(container);

  const warnings: string[] = [];

  // Because abcjs expects browser globals (window, document, etc.), we need to temporarily patch them
  // Store original descriptors so we can restore them later
  const originalWindowDescriptor = Object.getOwnPropertyDescriptor(global, "window");
  const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(global, "document");
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(global, "navigator");

  try {
    // Patch global with svgdom window using defineProperty to override read-only properties
    Object.defineProperty(global, "window", {
      value: window,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, "document", {
      value: document,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "node.js" },
      writable: true,
      configurable: true,
    });

    // Render ABC to the container
    // abcjs.renderAbc returns an array of rendered tunes
    const visualObjs = abcjs.renderAbc(container, abcContent);

    // Extract SVG elements from the container
    // Each tune is rendered as a separate div with SVG inside
    const svgElements = container.querySelectorAll("svg");
    const svgs: string[] = [];

    svgElements.forEach((svgElement: Element) => {
      // Because abcjs generates SVG for browser embedding (inline in HTML),
      // it doesn't include the xmlns attribute required for standalone SVG files.
      // We add it here so the SVG renders correctly in browsers when opened directly.
      if (!svgElement.getAttribute("xmlns")) {
        svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      }
      // Get the outer HTML of the SVG element
      svgs.push(svgElement.outerHTML);
    });

    // If no SVGs were generated, this might indicate an error
    if (svgs.length === 0 && abcContent.trim().length > 0) {
      warnings.push("No SVG output was generated. The ABC content may be invalid.");
    }

    return {
      svgs,
      metadata: {
        tuneCount: visualObjs.length,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    };
  } catch (error: any) {
    throw new Error(`Failed to render ABC to SVG: ${error.message || error}`);
  } finally {
    // Restore original property descriptors
    if (originalWindowDescriptor) {
      Object.defineProperty(global, "window", originalWindowDescriptor);
    } else {
      delete (global as any).window;
    }
    if (originalDocumentDescriptor) {
      Object.defineProperty(global, "document", originalDocumentDescriptor);
    } else {
      delete (global as any).document;
    }
    if (originalNavigatorDescriptor) {
      Object.defineProperty(global, "navigator", originalNavigatorDescriptor);
    } else {
      delete (global as any).navigator;
    }
  }
}
