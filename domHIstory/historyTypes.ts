import { DOMElementNode } from "../domTypes/domClass";
import { createHash } from "crypto";

function sha256(data:any) {
    return createHash('sha256').update(data).digest('hex');
  }
/**
 * Hash of the dom element to be used as a unique identifier
 */
export class HashedDomElement {
    branchPathHash: string;
    attributesHash: string;
    xpathHash: string;

    constructor(branchPathHash: string, attributesHash: string, xpathHash: string) {
        this.branchPathHash = branchPathHash;
        this.attributesHash = attributesHash;
        this.xpathHash = xpathHash;
    }
}

/**
 * Represents a set of coordinates
 */
export class Coordinates {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
}

/**
 * Represents a set of coordinates for an element
 */
export class CoordinateSet {
    topLeft: Coordinates;
    topRight: Coordinates;
    bottomLeft: Coordinates;
    bottomRight: Coordinates;
    center: Coordinates;
    width: number;
    height: number;

    constructor(topLeft: Coordinates, topRight: Coordinates, bottomLeft: Coordinates, bottomRight: Coordinates, center: Coordinates, width: number, height: number) {
        this.topLeft = topLeft;
        this.topRight = topRight;
        this.bottomLeft = bottomLeft;
        this.bottomRight = bottomRight;
        this.center = center;
        this.width = width;
        this.height = height;
    }
}

/**
 * Represents information about the viewport
 */
export class ViewportInfo {
    scrollX?: number;
    scrollY?: number;
    width: number;
    height: number;

    constructor(width: number, height: number,scrollX?: number, scrollY?: number, ) {
        this.scrollX = scrollX;
        this.scrollY = scrollY;
        this.width = width;
        this.height = height;
    }
}

/**
 * Represents a DOM history element
 */
export class DOMHistoryElement {
    tagName: string;
    xpath: string;
    highlightIndex?: number | null;
    entireParentBranchPath: string[];
    attributes: Record<string, string>;
    shadowRoot: boolean;
    cssSelector?: string;
    pageCoordinates?: CoordinateSet;
    viewportCoordinates?: CoordinateSet;
    viewportInfo?: ViewportInfo;

    constructor(tagName: string, xpath: string, highlightIndex: number | undefined, entireParentBranchPath: string[], attributes: Record<string, string>, shadowRoot: boolean = false, cssSelector?: string, pageCoordinates?: CoordinateSet, viewportCoordinates?: CoordinateSet, viewportInfo?: ViewportInfo) {
        this.tagName = tagName;
        this.xpath = xpath;
        this.highlightIndex = highlightIndex;
        this.entireParentBranchPath = entireParentBranchPath;
        this.attributes = attributes;
        this.shadowRoot = shadowRoot;
        this.cssSelector = cssSelector;
        this.pageCoordinates = pageCoordinates;
        this.viewportCoordinates = viewportCoordinates;
        this.viewportInfo = viewportInfo;
    }

    /**
     * Converts the DOM history element to a dictionary
     */
    toDict(): Record<string, any> {
        const pageCoordinates = this.pageCoordinates ? this.pageCoordinates : null;
        const viewportCoordinates = this.viewportCoordinates ? this.viewportCoordinates : null;
        const viewportInfo = this.viewportInfo ? this.viewportInfo : null;

        return {
            tagName: this.tagName,
            xpath: this.xpath,
            highlightIndex: this.highlightIndex,
            entireParentBranchPath: this.entireParentBranchPath,
            attributes: this.attributes,
            shadowRoot: this.shadowRoot,
            cssSelector: this.cssSelector,
            pageCoordinates,
            viewportCoordinates,
            viewportInfo,
        };
    }
}

/**
 * Processor for the DOM history tree
 */
export class HistoryTreeProcessor {
    /**
     * Converts a DOM element to a DOM history element
     */
    static convertDomElementToHistoryElement(domElement: DOMElementNode): DOMHistoryElement {
        const parentBranchPath = HistoryTreeProcessor.getParentBranchPath(domElement);
        const cssSelector = BrowserContext.enhancedCssSelectorForElement(domElement);
        return new DOMHistoryElement(
            domElement.tagName,
            domElement.xpath,
            domElement.highlightIndex ?? undefined,
            parentBranchPath,
            domElement.attributes,
            domElement.shadowRoot,
            cssSelector,
            domElement.pageCoordinates?? undefined,
            domElement.viewportCoordinates?? undefined,
            domElement.viewportInfo?? undefined
        );
    }

    /**
     * Finds a DOM history element in the DOM tree
     */
    static findHistoryElementInTree(domHistoryElement: DOMHistoryElement, tree: DOMElementNode): DOMElementNode | undefined {
        const hashedDomHistoryElement = HistoryTreeProcessor.hashDomHistoryElement(domHistoryElement);

        function processNode(node: DOMElementNode): DOMElementNode | undefined {
            if (node.highlightIndex !== undefined) {
                const hashedNode = HistoryTreeProcessor.hashDomElement(node);
                if (hashedNode === hashedDomHistoryElement) {
                    return node;
                }
            }
            for (const child of node.children) {
                if (child instanceof DOMElementNode) {
                    const result = processNode(child);
                    if (result !== undefined) {
                        return result;
                    }
                }
            }
            return undefined;
        }

        return processNode(tree);
    }

    /**
     * Compares a DOM history element with a DOM element
     */
    static compareHistoryElementAndDomElement(domHistoryElement: DOMHistoryElement, domElement: DOMElementNode): boolean {
        const hashedDomHistoryElement = HistoryTreeProcessor.hashDomHistoryElement(domHistoryElement);
        const hashedDomElement = HistoryTreeProcessor.hashDomElement(domElement);

        return hashedDomHistoryElement === hashedDomElement;
    }

    /**
     * Hashes a DOM history element
     */
    static hashDomHistoryElement(domHistoryElement: DOMHistoryElement): HashedDomElement {
        const branchPathHash = HistoryTreeProcessor.parentBranchPathHash(domHistoryElement.entireParentBranchPath);
        const attributesHash = HistoryTreeProcessor.attributesHash(domHistoryElement.attributes);
        const xpathHash = HistoryTreeProcessor.xpathHash(domHistoryElement.xpath);

        return new HashedDomElement(branchPathHash, attributesHash, xpathHash);
    }

    /**
     * Hashes a DOM element
     */
    static hashDomElement(domElement: DOMElementNode): HashedDomElement {
        const parentBranchPath = HistoryTreeProcessor.getParentBranchPath(domElement);
        const branchPathHash = HistoryTreeProcessor.parentBranchPathHash(parentBranchPath);
        const attributesHash = HistoryTreeProcessor.attributesHash(domElement.attributes);
        const xpathHash = HistoryTreeProcessor.xpathHash(domElement.xpath);

        return new HashedDomElement(branchPathHash, attributesHash, xpathHash);
    }

    /**
     * Gets the parent branch path of a DOM element
     */
    static getParentBranchPath(domElement: DOMElementNode): string[] {
        const parents: DOMElementNode[] = [];
        let currentElement: DOMElementNode | null = domElement;
        while (currentElement.parent !== null) {
            parents.push(currentElement);
            currentElement = currentElement.parent;
        }

        parents.reverse();

        return parents.map(parent => parent.tagName);
    }

    /**
     * Hashes a parent branch path
     */
    static parentBranchPathHash(parentBranchPath: string[]): string {
        const parentBranchPathString = parentBranchPath.join('/');
        return sha256(parentBranchPathString).toString();
    }

    /**
     * Hashes a set of attributes
     */
    static attributesHash(attributes: Record<string, string>): string {
        const attributesString = Object.entries(attributes).map(([key, value]) => `${key}=${value}`).join('');
        return sha256(attributesString).toString();
    }

    /**
     * Hashes an XPath
     */
    static xpathHash(xpath: string): string {
        return sha256(xpath).toString();
    }

    /**
     * Hashes the text of a DOM element
     */
    static textHash(domElement: DOMElementNode): string {
        const textString = domElement.getAllTextTillNextClickableElement();
        return sha256(textString).toString();
    }
}