import {Browser as PlaywrightBrowser} from "playwright";
import playwright from "playwright";
import async_playwright from "playwright";
import { BrowserContext,BrowserContextConfig } from "./browserContext";

export class BrowserConfig{
    //headless: boolean = false;
    //disable_security: boolean = true;
    //extra_browser_args: string[] = [];
    wss_url: string | null = null;
    //cdp_url: string | null = null;
    browser_instance_path: string | null = null;
    //proxy: ProxySettings | null = null;
    new_context_config: BrowserContextConfig = new BrowserContextConfig();
    _force_keep_browser_alive: boolean = false;
   // browser_class: Literal['chromium', 'firefox', 'webkit'] = 'chromium';
}

export class Browser{
    config: BrowserConfig;
    //playwright: typeof playwright | null;
    playwright_browser: PlaywrightBrowser | null;
   constructor(config: BrowserConfig = new BrowserConfig()){
    this.config = config;
    this.playwright_browser = null;
   }
   async new_context(config: BrowserContextConfig = new BrowserContextConfig()): Promise<BrowserContext> {
    return new BrowserContext(this, config);
   }
   async get_playwright_browser(): Promise<PlaywrightBrowser> {
    if(this.playwright_browser === null){
        return await this._init();
    }
    return this.playwright_browser;
   }
   async _init(): Promise<PlaywrightBrowser> {
    if(this.playwright_browser === null){
        this.playwright_browser = await playwright.chromium.connect("http://localhost:9222");
    }
    return this.playwright_browser;
   }
   async close(){
    if(this.playwright_browser !== null){
        await this.playwright_browser.close();
        this.playwright_browser = null;
    }
   }}