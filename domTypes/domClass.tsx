import { CoordinateSet, HashedDomElement, ViewportInfo } from "../domHIstory/historyTypes";


//Okay Report 
export interface DOMBaseNode {
  isVisible: boolean;
  parent: DOMElementNode | null;
}

export class DOMTextNode implements DOMBaseNode {
  text: string;
  type: string = 'TEXT_NODE';
  isVisible: boolean;
  parent: DOMElementNode | null;

  constructor(text: string, isVisible: boolean, parent: DOMElementNode | null) {
    this.text = text;
    this.isVisible = isVisible;
    this.parent = parent;
  }

  hasParentWithHighlightIndex(): boolean {
    let current = this.parent;
    while (current !== null) {
      if (current.highlightIndex !== null) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  isParentInViewport(): boolean {
    return this.parent?.isInViewport ?? false;
  }

  isParentTopElement(): boolean {
    return this.parent?.isTopElement ?? false;
  }
}

export class DOMElementNode implements DOMBaseNode {
  tagName: string;//okay
  xpath: string;//okay
  attributes: Record<string, string>;//okay
  children: DOMBaseNode[];//okay
  isVisible: boolean;
  parent: DOMElementNode | null;
  isInteractive: boolean = false;//okay
  isTopElement: boolean = false;//okay
  isInViewport: boolean = false;//okay
  shadowRoot: boolean = false;
  highlightIndex: number | null = null;
  viewportCoordinates: CoordinateSet | null = null;
  pageCoordinates: CoordinateSet | null = null;
  viewportInfo: ViewportInfo | null = null;

  constructor(tagName: string, xpath: string, attributes: Record<string, string>, children: DOMBaseNode[], isVisible: boolean, parent: DOMElementNode | null) {
    this.tagName = tagName;
    this.xpath = xpath;
    this.attributes = attributes;
    this.children = children;
    this.isVisible = isVisible;
    this.parent = parent;
  }

  toString(): string {
    let tagStr = `<${this.tagName}`;
    for (const [key, value] of Object.entries(this.attributes)) {
      tagStr += ` ${key}="${value}"`;
    }
    tagStr += '>';

    const extras: string[] = [];
    if (this.isInteractive) extras.push('interactive');
    if (this.isTopElement) extras.push('top');
    if (this.shadowRoot) extras.push('shadow-root');
    if (this.highlightIndex !== null) extras.push(`highlight:${this.highlightIndex}`);
    if (this.isInViewport) extras.push('in-viewport');

    if (extras.length > 0) {
      tagStr += ` [${extras.join(', ')}]`;
    }

    return tagStr;
  }

  get hash(): HashedDomElement {
    const { HistoryTreeProcessor } = require('browser_use.dom.history_tree_processor.service');
    return HistoryTreeProcessor._hash_dom_element(this);
  }

  getAllTextTillNextClickableElement(maxDepth: number = -1): string {
    const textParts: string[] = [];

    const collectText = (node: DOMBaseNode, currentDepth: number): void => {
      if (maxDepth !== -1 && currentDepth > maxDepth) return;

      if (node instanceof DOMElementNode && node !== this && node.highlightIndex !== null) return;

      if (node instanceof DOMTextNode) {
        textParts.push(node.text);
      } else if (node instanceof DOMElementNode) {
        node.children.forEach(child => collectText(child, currentDepth + 1));
      }
    };

    collectText(this, 0);
    return textParts.join('\n').trim();
  }


  clickableElementsToString(includeAttributes: string[] | null = null): string {
    const formattedText: string[] = [];

    const processNode = (node: DOMBaseNode, depth: number): void => {
      if (node instanceof DOMElementNode) {
        if (node.highlightIndex !== null) {
          let attributesStr = '';
          const text = node.getAllTextTillNextClickableElement();
          if (includeAttributes) {
            const attributes = Array.from(new Set(Object.entries(node.attributes)
              .filter(([key, value]) => includeAttributes.includes(key) && value !== node.tagName)
              .map(([, value]) => value)));
            if (attributes.includes(text)) attributes.splice(attributes.indexOf(text), 1);
            attributesStr = attributes.join(';');
          }
          let line = `[${node.highlightIndex}]<${node.tagName} `;
          if (attributesStr) line += `${attributesStr}`;
          if (text) line += `${attributesStr ? '>' : ''}${text}`;
          line += '/>';
          formattedText.push(line);
        }

        node.children.forEach(child => processNode(child, depth + 1));
      } else if (node instanceof DOMTextNode) {
        if (!node.hasParentWithHighlightIndex() && node.isVisible) {
          formattedText.push(node.text);
        }
      }
    };

    processNode(this, 0);
    return formattedText.join('\n');
  }

  getFileUploadElement(checkSiblings: boolean = true): DOMElementNode | null {
    if (this.tagName === 'input' && this.attributes.type === 'file') return this;

    for (const child of this.children) {
      if (child instanceof DOMElementNode) {
        const result = child.getFileUploadElement(false);
        if (result) return result;
      }
    }

    if (checkSiblings && this.parent) {
      for (const sibling of this.parent.children) {
        if (sibling !== this && sibling instanceof DOMElementNode) {
          const result = sibling.getFileUploadElement(false);
          if (result) return result;
        }
      }
    }

    return null;
  }
}

export interface SelectorMap {
  [key: number]: DOMElementNode;
}

export class DOMState {
  elementTree: DOMElementNode;
  selectorMap: SelectorMap;

  constructor(elementTree: DOMElementNode, selectorMap: SelectorMap) {
    this.elementTree = elementTree;
    this.selectorMap = selectorMap;
  }
}