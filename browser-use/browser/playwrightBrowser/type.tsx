

import { DOMHistoryElement } from "../../domHIstory/historyTypes";
import { DOMElementNode, DOMState, SelectorMap } from "../../domTypes/domClass";

class TabInfo{
    page_id: number;
    url: string;
    title: string;
    
    constructor(page_id: number, url: string, title: string) {
        this.page_id = page_id;
        this.url = url;
        this.title = title;
    }
}

class BrowserState extends DOMState{
    url:string;
    title:string;
    tab:TabInfo[];
    screenshot?:string;
    pixels_above:number;
    pixels_below:number;
    browser_errors:string[];

    constructor( elementTree: DOMElementNode, selectorMap: SelectorMap,url: string, title: string, tab: TabInfo[], screenshot?: string, pixels_above?: number, pixels_below?: number, browser_errors?: string[],) {
        super(elementTree, selectorMap);
        this.url = url;
        this.title = title;
        this.tab = tab;
        this.screenshot = screenshot;
        this.pixels_above = pixels_above ?? 0;
        this.pixels_below = pixels_below ?? 0;
        this.browser_errors = browser_errors ?? [];
    }   


}

class BrowserStateHistory{
    url:string;
    title:string;
    tab:TabInfo[];
    interacted_element:DOMHistoryElement[];
    screenshot?:string;
    constructor(url: string, title: string, tab: TabInfo[], interacted_element: DOMHistoryElement[], screenshot?: string) {
        this.url = url;
        this.title = title;
        this.tab = tab;
        this.interacted_element = interacted_element;
        this.screenshot = screenshot;
    }

    toDict(): Record<string, any> {
        return {
            url: this.url,
            title: this.title,
            tab: this.tab.map(tab => ({
                page_id: tab.page_id,
                url: tab.url,
                title: tab.title
            })),
            interacted_element: this.interacted_element.map(el => el.toDict()),
            screenshot: this.screenshot
        };
    }
   
}

class BrowserError extends Error {
    constructor(message: string) {  
        super(message); 
        this.name = "BrowserError";
    }
}

class URLNotAllowedError extends BrowserError {
    constructor(message: string) {  
        super(message);     
        this.name = "URLNotAllowedError";
    }
}

export { BrowserState, BrowserStateHistory, BrowserError, URLNotAllowedError ,TabInfo};