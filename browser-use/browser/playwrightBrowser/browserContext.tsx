import { randomUUID, UUID } from "crypto";
import {   errors, Request, Response } from "playwright";
import { Browser } from "./browserService";
import { Browser as PlaywrightBrowser } from "playwright";
import { BrowserContext as PlaywrightBrowserContext } from "playwright";
import { ElementHandle,FrameLocator,Page} from "playwright";
import {BrowserError,BrowserState,TabInfo,URLNotAllowedError} from "@/app/_browserService/browser/playwrightBrowser/type";
import { DomService } from "../../domTypes/DomService";
import { DOMElementNode,SelectorMap } from "../../domTypes/domClass";
import path from "path";
import * as fs from "fs";
import {
	S3Client,
	PutObjectCommand,
	CreateBucketCommand,
	DeleteObjectCommand,
	DeleteBucketCommand,
	paginateListObjectsV2,
	GetObjectCommand,
  } from "@aws-sdk/client-s3";
import { NextRequest } from "next/server";
import { buffer } from "stream/consumers";
import { list } from "postcss";



const s3 = new S3Client();
class BrowserContextWindowSize{
    width: number;
    height: number;
    constructor(width: number, height: number) {    
        this.width = width; 
        this.height = height;   
    }
}

export class BrowserContextConfig{
    cookies_file: string | null;
	s3Storage: boolean;
    minimum_wait_page_load_time: number;
    wait_for_network_idle_page_load_time: number;
    maximum_wait_page_load_time: number;
    wait_between_actions: number;
    browser_window_size: BrowserContextWindowSize;
    no_viewport: boolean | null;
    save_recording_path: string | null;
    save_downloads_path: string | null;
    trace_path: string | null;
    locale: string | null;
    user_agent: string;
	
    highlight_elements: boolean;
    viewport_expansion: number;
    allowed_domains: string[] | null;
    include_dynamic_attributes: boolean;
    disable_security: boolean;
    _force_keep_context_alive: boolean;
    constructor() {
		
		this.s3Storage=false;
        this.cookies_file = null;
        this.minimum_wait_page_load_time = 0.5;
        this.wait_for_network_idle_page_load_time = 1.0;
        this.maximum_wait_page_load_time = 5.0;
        this.wait_between_actions = 0.5;
        this.browser_window_size = new BrowserContextWindowSize(1280, 1100);
        this.no_viewport = null;
        this.save_recording_path = null;
        this.save_downloads_path = null;
        this.trace_path = null; 
        this.locale = null;
        this.user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36';
        this.highlight_elements = true;
        this.viewport_expansion = 500;
        this.allowed_domains = null;
        this.include_dynamic_attributes = true;
        this.disable_security = true;
        this._force_keep_context_alive = false;
    }
}

class BrowserSession{
    context: PlaywrightBrowserContext;
    cached_state: BrowserState | null;
    constructor(context: PlaywrightBrowserContext, cached_state: BrowserState | null) {
        this.context = context;
        this.cached_state = cached_state;
    }
}

class BrowserContextState{
    target_id: string | null=null;
    constructor(target_id?: string | null) {
        this.target_id = target_id ?? null;
    }
}

export class BrowserContext{
    context_id: string=randomUUID().toString();
    config: BrowserContextConfig;
	current_state: BrowserState | null;
    browser: Browser;
    state?: BrowserContextState=new BrowserContextState();
    session: BrowserSession | null=null;
    constructor(browser: Browser, config: BrowserContextConfig,state?:BrowserContextState){
        this.browser=browser;
		this.current_state=null;
        this.config=config;
        this.state=state ?? new BrowserContextState();
    }
    async __aenter__(): Promise<BrowserContext> {
        await this._initialize_session();
		return this
    }
    async __aexit__(): Promise<void> {
        await this.close();
    }
    async close(): Promise<void> {
        if(!this.session){
            return 
        }
        try{
            if(!this.config._force_keep_context_alive && this.session.context){
                await this.session.context.close();
            }
            await this.save_cookies();
        }catch(e){
            console.error('Failed to close browser context:', e);
        }
        this.session=null;
    
    }

	async save_cookies(local?: boolean):Promise<void>{
		if (this.session &&this.session.context && this.config.cookies_file){
			try{
				const cookies = await this.session.context.cookies();
				console.log(`Saving ${cookies.length} cookies to ${this.config.cookies_file}`);

				if (local) {
					const dirname = path.dirname(this.config.cookies_file);
					if (dirname) {
						// Ensure the directory exists
						fs.mkdirSync(dirname,{recursive:true});
					}

					// Write cookies to the file
					fs.writeFileSync(this.config.cookies_file, JSON.stringify(cookies, null, 2));
				} else {
					// Upload to S3
					await s3.send(new PutObjectCommand({
						Bucket: process.env.AWS_S3_BUCKET_NAME,
						Key: path.basename(this.config.cookies_file),
						Body: JSON.stringify(cookies, null, 2),
						ContentType: 'application/json'
					}));
				}
			}
			catch (e) {
				console.warn(`Failed to save cookies: ${e}`);
			}
		}
	}

    async _initialize_session(): Promise<BrowserSession> {
        const playwright_browser=await this.browser.get_playwright_browser()
        const context=await this._create_context(playwright_browser)
		const pages=context.pages()
		this.session=new BrowserSession(context,null)
		let active_page=null
		if (pages){
			active_page=pages[0]
		}
		else{
			active_page= await context.newPage()
		}
		await active_page.bringToFront()
		await active_page.waitForLoadState('load')
		return this.session
    }


	async _add_new_page_listener(this:BrowserContext,context:PlaywrightBrowserContext){
		const on_page = async (page:Page) =>{
			await page.waitForLoadState()
			if(this.session!==null) {
				this.state!.target_id = null
			}
			
			context.on('page',on_page)
		}
	}

	async get_session(this:BrowserContext): Promise<BrowserSession> {
		if(this.session===null) {
			return await this._initialize_session()
		}
		return this.session
	}

	

	async get_current_page(this:BrowserContext): Promise<Page> {
		const session = await this.get_session()
		return await this._get_current_page(session)
	}

	async _create_context(this:BrowserContext,browser:PlaywrightBrowser): Promise<PlaywrightBrowserContext> {
		if(this.browser.config.browser_instance_path && (await browser.contexts()).length > 0){
			return (await browser.contexts())[0]
		}
		else{
			let context=browser.newContext(
				{
					viewport:this.config.browser_window_size,
					javaScriptEnabled:true,
					bypassCSP:this.config.disable_security,
					ignoreHTTPSErrors:this.config.disable_security,
					recordVideo:{dir:this.config.save_recording_path||"null",
						size:this.config.browser_window_size
					},
					locale:this.config.locale||undefined,
					userAgent:this.config.user_agent

				}
			)
			if(this.config.trace_path){
				(await context).tracing.start({screenshots:true,snapshots:true,sources:true})
		}
		//Add Cookies
			if(this.config.cookies_file){
				//Load cookies from s3
				if(this.config.s3Storage){
					let cookiesFromS3=await s3.send(
						new GetObjectCommand({
							Bucket: process.env.AWS_S3_BUCKET_NAME,
							Key: path.basename(this.config.cookies_file)
						})
					)
					const cookies=JSON.parse((await cookiesFromS3)?.Body?.toString() || '')
					await (await context).addCookies(cookies)
				}
				//Or locally
				else{
					const cookies=fs.readFileSync(this.config.cookies_file,'utf8')
					await (await context).addCookies(JSON.parse(cookies))
				}
			}
		//Expose Anti-Detection Scripts
		(await context).addInitScript({
			content:`
        // Webdriver property
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });

        // Languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US']
        });

        // Plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });

        // Chrome runtime
        window.chrome = { runtime: {} };

        // Permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
        (function () {
            const originalAttachShadow = Element.prototype.attachShadow;
            Element.prototype.attachShadow = function attachShadow(options) {
                return originalAttachShadow.call(this, { ...options, mode: "open" });
            };
        })();
    `
		})

		return context
	}

	}
    
	async _wait_for_stable_network(this: BrowserContext): Promise<void> {
		// Get the current page
		const page = await this.get_current_page();
	
		// Set to track pending requests
		let pending_requests = new Set();
	
		// Track the last activity time
		let last_activity = Date.now();
	
		// Define relevant resource and content types
		const relevant_resource_types = new Set(['document', 'stylesheet', 'image', 'font', 'script', 'iframe']);
		const relevant_content_types = new Set(['text/html', 'text/css', 'application/javascript', 'image/', 'font/', 'application/json']);
	
		// Define URL patterns to ignore
		const ignored_url_patterns = new Set(['analytics', 'tracking', 'telemetry', 'beacon', 'metrics', 'doubleclick', 'adsystem', 'adserver', 'advertising', 'facebook.com/plugins', 'platform.twitter', 'linkedin.com/embed', 'livechat', 'zendesk', 'intercom', 'crisp.chat', 'hotjar', 'push-notifications', 'onesignal', 'pushwoosh', 'heartbeat', 'ping', 'alive', 'webrtc', 'rtmp://', 'wss://', 'cloudfront.net', 'fastly.net']);
	
		// Function to handle request events
		const on_request = (request:Request) => {
			const url = request.url().toLowerCase();
			if (!relevant_resource_types.has(request.resourceType())) {
				return;
			}
			if (ignored_url_patterns.has(url)) {
				return;
			}
			pending_requests.add(request);
			last_activity = Date.now();
		};
	
		// Function to handle response events
		const on_response = (response:Response) => {
			const request = response.request();
			if (!pending_requests.has(request)) {
				return;
			}
			const content_type = response.headers()['content-type']?.toLowerCase() || '';
			if (!relevant_content_types.has(content_type)) {
				pending_requests.delete(request);
				return;
			}
			pending_requests.delete(request);
			last_activity = Date.now();
		};
	
		// Attach event listeners to the page
		page.on('request', on_request);
		page.on('response', on_response);
	
		try {
			// Wait for the network to stabilize
			while (true) {
				await new Promise(resolve => setTimeout(resolve, 100)); // Sleep for 100ms
				const now = Date.now();
				if (pending_requests.size === 0 && (now - last_activity) >= this.config.wait_for_network_idle_page_load_time * 1000) {
					break;
				}
				if (now - last_activity > this.config.maximum_wait_page_load_time * 1000) {
					console.warn('Network did not stabilize in time');
					break;
				}
			}
		} finally {
			// Clean up event listeners
			page.removeListener('request', on_request);
			page.removeListener('response', on_response);
		}
	}
	async _wait_for_page_and_frames_load(this:BrowserContext, timeout_overwrite: number | null = null): Promise<void> {
		let start_time=Date.now()
		try{
			await this._wait_for_stable_network()
			let page=await this.get_current_page()
			await this._check_and_handle_navigation(page)
		}
		catch(e){
			console.warn('Page load failed, continuing...')
		}
		const elapsed = (Date.now() - start_time) / 1000
		const remaining = Math.max((timeout_overwrite || this.config.minimum_wait_page_load_time) - elapsed, 0)
		if (remaining > 0) {
			await new Promise(resolve => setTimeout(resolve, remaining * 1000))
		}
	}
	async _is_url_allowed(this:BrowserContext, url: string): Promise<boolean> {
		if (!this.config.allowed_domains) {
			return true
		}
		try {
			const parsed_url = new URL(url)
			const domain = parsed_url.hostname.toLowerCase()
			return this.config.allowed_domains.some(allowed_domain => {
				return domain === allowed_domain.toLowerCase() || domain.endsWith(`.${allowed_domain.toLowerCase()}`)
			})
		}
		catch (e) {
			console.error(`Error checking URL allowlist: ${e}`)
			return false
		}
	}
    async _check_and_handle_navigation(this:BrowserContext, page:Page): Promise<void> {
		if (!this._is_url_allowed(page.url())) {
			console.warn(`Navigation to non-allowed URL detected: ${page.url}`)
			try {
				await this.go_back()
			}
			catch (e) {
				console.error(`Failed to go back after detecting non-allowed URL: ${e}`)
			}
			throw new Error(`Navigation to non-allowed URL: ${page.url}`)
		}
	}
	async navigate_to(this:BrowserContext, url: string): Promise<void> {
		if (!this._is_url_allowed(url)) {
			throw new Error(`Navigation to non-allowed URL: ${url}`)
		}
		const page = await this.get_current_page()
		await page.goto(url)
		await page.waitForLoadState()
	}
	async refresh_page(this:BrowserContext): Promise<void> {
		const page = await this.get_current_page()
		await page.reload()
		await page.waitForLoadState()
	}
	async go_back(this:BrowserContext): Promise<void> {
		const page = await this.get_current_page()
		try {
			await page.goBack({ timeout: 10, waitUntil: 'domcontentloaded' })
		}
		catch (e) {
			console.error(`Failed to go back after detecting non-allowed URL: ${e}`)
		}
	}
	async go_forward(this:BrowserContext): Promise<void> {
		const page = await this.get_current_page()
		try {
			await page.goForward({ timeout: 10, waitUntil: 'domcontentloaded' })
		}
		catch (e) {
			console.error(`Failed to go forward after detecting non-allowed URL: ${e}`)
		}
	}
	async close_current_tab(this:BrowserContext): Promise<void> {
		const session=this.session
		const page=await this._get_current_page(session!)
		await page.close()
		if(session?.context?.pages){
			await this.swtch_to_tab(0)
		}

}
    async get_page_html(this:BrowserContext): Promise<string> {
		const page = await this.get_current_page()
		return await page.content()
	}
	async execute_javascript(this:BrowserContext, script: string): Promise<any> {
		const page = await this.get_current_page()
		return await page.evaluate(script)
	}	
	async get_page_structure(this:BrowserContext): Promise<string> {
		const debug_script=`
    (() => {
        function getPageStructure(element = document, depth = 0, maxDepth = 10) {
            if (depth >= maxDepth) return '';
            
            const indent = '  '.repeat(depth);
            let structure = '';
            
            // Skip certain elements that clutter the output
            const skipTags = new Set(['script', 'style', 'link', 'meta', 'noscript']);
            
            // Add current element info if it's not the document
            if (element !== document) {
                const tagName = element.tagName.toLowerCase();
                
                // Skip uninteresting elements
                if (skipTags.has(tagName)) return '';
                
                const id = element.id ? \`#\${element.id}\` : '';
                const classes = element.className && typeof element.className === 'string' ? 
                    \`.\${element.className.split(' ').filter(c => c).join('.')}\` : '';
                
                // Get additional useful attributes
                const attrs = [];
                if (element.getAttribute('role')) attrs.push(\`role="\${element.getAttribute('role')}"\`);
                if (element.getAttribute('aria-label')) attrs.push(\`aria-label="\${element.getAttribute('aria-label')}"\`);
                if (element.getAttribute('type')) attrs.push(\`type="\${element.getAttribute('type')}"\`);
                if (element.getAttribute('name')) attrs.push(\`name="\${element.getAttribute('name')}"\`);
                if (element.getAttribute('src')) {
                    const src = element.getAttribute('src');
                    attrs.push(\`src="\${src.substring(0, 50)}\${src.length > 50 ? '...' : ''}"\`);
                }
                
                // Add element info
                structure += \`\${indent}\${tagName}\${id}\${classes}\${attrs.length ? ' [' + attrs.join(', ') + ']' : ''}\\n\`;
                
                // Handle iframes specially
                if (tagName === 'iframe') {
                    try {
                        const iframeDoc = element.contentDocument || element.contentWindow?.document;
                        if (iframeDoc) {
                            structure += \`\${indent}  [IFRAME CONTENT]:\\n\`;
                            structure += getPageStructure(iframeDoc, depth + 2, maxDepth);
                        } else {
                            structure += \`\${indent}  [IFRAME: No access - likely cross-origin]\\n\`;
                        }
                    } catch (e) {
                        structure += \`\${indent}  [IFRAME: Access denied - \${e.message}]\\n\`;
                    }
                }
            }
            
            // Get all child elements
            const children = element.children || element.childNodes;
            for (const child of children) {
                if (child.nodeType === 1) { // Element nodes only
                    structure += getPageStructure(child, depth + 1, maxDepth);
                }
            }
            
            return structure;
        }
        
        return getPageStructure();
    })()
`
		return (await this.get_current_page()).evaluate(debug_script)
	}
	async get_state(this:BrowserContext):Promise<BrowserState>{
		await this._wait_for_page_and_frames_load()
		let session=await this.get_session()
		session.cached_state=await this._update_state()

		if (this.config.cookies_file){
			await this.save_cookies(true)

		}
		else if(this.config.s3Storage){
			await this.save_cookies(false)
		}

		return session.cached_state!


	}
	async _update_state(this:BrowserContext, focus_element: number = -1):Promise<BrowserState>{
		let session=await this.get_session()
		let page:Page|undefined=undefined
		try{
			const page=await this.get_current_page()
			await page.evaluate('1')
		}
		catch(e){
			let pages=await session.context.pages()
			if(pages){
				this.state!.target_id=null
				const page=await this.get_current_page()


			}
			else{
				throw new BrowserError('Browser closed: no valid pages available')
			}
		}
		try{
			await this.remove_highlights()
			const dom_service = new DomService(page!)
			const content = await dom_service.getClickableElements(
				this.config.highlight_elements,
				focus_element,
				this.config.viewport_expansion,
				
			)

			const screenshot_b64 = await this.take_screenshot()
			const [pixels_above, pixels_below] = await this.get_scroll_info(page!)

			this.current_state = new BrowserState(
				content.elementTree,
				content.selectorMap,
				await page!.url(),
				await page!.title(),
				await this.get_tabs_info(),
				screenshot_b64,
				pixels_above,
				pixels_below,
		)

			return this.current_state
		}
		catch(e){
			console.error(`Failed to update state: ${e}`)
			// Return last known good state if available
			if (this.current_state) {
				return this.current_state
			}
			throw e
		}
	}
	async take_screenshot(this:BrowserContext, full_page: boolean = false): Promise<string> {
		const page = await this.get_current_page()
		await page.bringToFront()
		await page.waitForLoadState()
		const screenshot:Buffer = await page.screenshot({
			fullPage:full_page,
			animations:'disabled'
		})
		const screenshot_b64 = screenshot.toString('base64')
		return screenshot_b64
	}
	async remove_highlights(this:BrowserContext): Promise<void> {
		try {
			const page = await this.get_current_page()
			await page.evaluate(
				`
					try {
						// Remove the highlight container and all its contents
						const container = document.getElementById('playwright-highlight-container');
						if (container) {
							container.remove();
						}

						// Remove highlight attributes from elements
						const highlightedElements = document.querySelectorAll('[browser-user-highlight-id^="playwright-highlight-"]');
						highlightedElements.forEach(el => {
							el.removeAttribute('browser-user-highlight-id');
						});
					} catch (e) {
						console.error('Failed to remove highlights:', e);
					}
				`
			)
		} catch (e) {
			console.error(`Failed to remove highlights: ${e}`)
			// Don't raise the error since this is not critical functionality
		}
	}
	
	async _convert_simple_xpath_to_css_selector(xpath: string): Promise<string> {
    /**
     * Converts simple XPath expressions to CSS selectors.
     *
     * @param xpath - The XPath expression to convert.
     * @returns A CSS selector string.
     */
    if (!xpath) {
        return '';
    }

    // Remove leading slash if present
    xpath = xpath.replace(/^\//, '');

    // Split into parts
    const parts = xpath.split('/');
    const css_parts: string[] = [];

    for (const part of parts) {
        if (!part) {
            continue;
        }

        // Handle custom elements with colons by escaping them
        if (part.includes(':') && !part.includes('[')) {
            const base_part = part.replace(/:/g, '\\:');
            css_parts.push(base_part);
            continue;
        }

        // Handle index notation [n]
        if (part.includes('[')) {
            let base_part = part.slice(0, part.indexOf('['));
            // Handle custom elements with colons in the base part
            if (base_part.includes(':')) {
                base_part = base_part.replace(/:/g, '\\:');
            }
            const index_part = part.slice(part.indexOf('['));

            // Handle multiple indices
            const indices = index_part.split(']').slice(0, -1).map(i => i.replace(/\[|\]/g, ''));

            for (const idx of indices) {
                try {
                    // Handle numeric indices
                    if (!isNaN(Number(idx))) {
                        const index = parseInt(idx, 10) - 1;
                        base_part += `:nth-of-type(${index + 1})`;
                    // Handle last() function
                    } else if (idx === 'last()') {
                        base_part += ':last-of-type';
                    // Handle position() functions
                    } else if (idx.includes('position()')) {
                        if (idx.includes('>1')) {
                            base_part += ':nth-of-type(n+2)';
                        }
                    }
                } catch (e) {
                    continue;
                }
            }

            css_parts.push(base_part);
        } else {
            css_parts.push(part);
        }
    }

    return css_parts.join(' > ');
}

async _enhanced_css_selector_for_element(element: DOMElementNode, include_dynamic_attributes: boolean = true): Promise<string> {
    /**
     * Creates a CSS selector for a DOM element, handling various edge cases and special characters.
     *
     * @param element - The DOM element to create a selector for.
     * @param include_dynamic_attributes - Whether to include dynamic attributes in the selector.
     * @returns A valid CSS selector string.
     */
    try {
        // Get base selector from XPath
        let css_selector = await this._convert_simple_xpath_to_css_selector(element.xpath);

        // Handle class attributes
        if ('class' in element.attributes && element.attributes['class'] && include_dynamic_attributes) {
            // Define a regex pattern for valid class names in CSS
            const valid_class_name_pattern = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

            // Iterate through the class attribute values
            const classes = element.attributes['class'].split(' ');
            for (const class_name of classes) {
                // Skip empty class names
                if (!class_name.trim()) {
                    continue;
                }

                // Check if the class name is valid
                if (valid_class_name_pattern.test(class_name)) {
                    // Append the valid class name to the CSS selector
                    css_selector += `.${class_name}`;
                }
            }
        }

        // Expanded set of safe attributes that are stable and useful for selection
        const SAFE_ATTRIBUTES = new Set([
            'id', 'name', 'type', 'placeholder',
            'aria-label', 'aria-labelledby', 'aria-describedby', 'role',
            'for', 'autocomplete', 'required', 'readonly',
            'alt', 'title', 'src', 'href', 'target',
        ]);

        if (include_dynamic_attributes) {
            const dynamic_attributes = ['data-id', 'data-qa', 'data-cy', 'data-testid'];
            dynamic_attributes.forEach(attr => SAFE_ATTRIBUTES.add(attr));
        }

        // Handle other attributes
        for (const [attribute, value] of Object.entries(element.attributes)) {
            if (attribute === 'class') {
                continue;
            }

            // Skip invalid attribute names
            if (!attribute.trim()) {
                continue;
            }

            if (!SAFE_ATTRIBUTES.has(attribute)) {
                continue;
            }

            // Escape special characters in attribute names
            const safe_attribute = attribute.replace(/:/g, '\\:');

            // Handle different value cases
            if (value === '') {
                css_selector += `[${safe_attribute}]`;
            } else if (/["'<>`\n\r\t]/.test(value)) {
                // Use contains for values with special characters
                const collapsed_value = value.replace(/\s+/g, ' ').trim();
                const safe_value = collapsed_value.replace(/"/g, '\\"');
                css_selector += `[${safe_attribute}*="${safe_value}"]`;
            } else {
                css_selector += `[${safe_attribute}="${value}"]`;
            }
        }

        return css_selector;

    } catch (e) {
        // Fallback to a more basic selector if something goes wrong
        const tag_name = element.tagName || '*';
        return `${tag_name}[highlight_index='${element.highlightIndex}']`;
    }
}
async get_locate_element(this:BrowserContext, element: DOMElementNode): Promise<ElementHandle | null> {
    let current_frame:any=await(this.get_current_page())
	let current=element
	let parent:Array<DOMElementNode>=[]
	while(current.parent!==null){
		parent.push(current.parent)
		current=current.parent
	}
	parent.reverse()
	const iframes = parent.filter(item => item.tagName === 'iframe');
	for(const iframe of iframes){
		let css_selector=await this._enhanced_css_selector_for_element(iframe,
			this.config.include_dynamic_attributes
		)
		current_frame=current_frame.frameLocator(css_selector)
	}
	let css_selector=await this._enhanced_css_selector_for_element(element,
		this.config.include_dynamic_attributes
	)
	try {
		if ('frameLocator' in current_frame && typeof current_frame.frameLocator === 'function') {
			const element_handle = await current_frame.locator(css_selector).elementHandle();
			return element_handle;
		} else {
			// Try to scroll into view if hidden
			const element_handle = await current_frame.querySelector(css_selector);
			if (element_handle) {
				await element_handle.scrollIntoViewIfNeeded();
				return element_handle;
			}
			return null;
		}
	} catch (e) {
		console.error(`Failed to locate element: ${e}`);
		return null;
	}
}
async _input_text_element_node(this:BrowserContext, element_node: DOMElementNode, text: string): Promise<void> {
	try{
		await this._update_state(element_node.highlightIndex||undefined)
		let element_handle=await this.get_locate_element(element_node)
		if(element_handle===null){
			throw new BrowserError(`Element: ${element_node} not found`)
		}
		try{
			await element_handle.waitForElementState('stable',{timeout:1000})
			await element_handle.scrollIntoViewIfNeeded({timeout:1000})
		}
		catch{
			console.debug('Element not stable or not visible')
		}
		let tag_handle=await element_handle.getProperty('tagName')
		let tag_name=(await tag_handle.jsonValue()).toLowerCase()
		let is_contenteditable=await element_handle.getProperty('isContentEditable')
		let readonly_handle=await element_handle.getProperty('readOnly')
		let disabled_handle=await element_handle.getProperty('disabled')
		let readonly=(await readonly_handle.jsonValue()) as boolean
		let disabled=(await disabled_handle.jsonValue()) as boolean
		if((await is_contenteditable.jsonValue()||tag_name==='input')&&!(readonly||disabled)){
			await element_handle.evaluate('el=>el.textContent=""')
			await element_handle.type(text,{delay:5})
		}
		else{
			await element_handle.fill(text)
		}
	}
	catch(e){
		console.error(`Failed to input text into element: ${e}`)
		throw new BrowserError(`Failed to input text into index ${element_node.highlightIndex}`)
	}
}
async _click_element_node(this:BrowserContext, element_node: DOMElementNode){
	const page=await this.get_current_page()
	try{
		// Highlight before clicking
		const element_handle=await this.get_locate_element(element_node)
		if(element_handle===null){
			throw new BrowserError(`Element: ${element_node} not found`)
		}
		const perform_click = async (click_func: () => Promise<void>) =>{
			if(this.config.save_downloads_path){
				try{
					// Try short-timeout expect_download to detect a file download has been been triggered
					const download_info = await page.waitForEvent('download', {timeout:5000})
					await click_func()
					// Determine file path
					let suggested_filename = download_info.suggestedFilename()
					let unique_filename = await this._get_unique_filename(this.config.save_downloads_path, suggested_filename)
					let download_path = path.join(this.config.save_downloads_path, unique_filename)
					await download_info.saveAs(download_path)
					console.log(`Download triggered. Saved file to: ${download_path}`)
					return download_path
				}
				catch(e){
					// If no download is triggered, treat as normal click
					console.debug('No download triggered within timeout. Checking navigation...')
					await page.waitForLoadState()
					await this._check_and_handle_navigation(page)
				}
			}
			else{
				// Standard click logic if no download is expected
				await click_func()
				await page.waitForLoadState()
				await this._check_and_handle_navigation(page)
			}
		}
		try{
			return await perform_click(async () => {
				await element_handle.click({ timeout: 1500 })
			})
		}
		catch(e){
			if(e instanceof URLNotAllowedError){
				throw e
			}
			try{
				return await perform_click(async () => {
					await page.evaluate('(el) => el.click()', element_handle)
				})
			}
			catch(e){
				console.error(`Failed to click element: ${e}`)
				throw new BrowserError(`Failed to click element: ${e}`)
			}
		}
	}
	catch(e){
		console.error(`Failed to click element: ${e}`)
		throw new BrowserError(`Failed to click element: ${e}`)
	}
}

async get_tabs_info(this:BrowserContext): Promise<TabInfo[]> {
	const session = await this.get_session()
	const tabs_info = await Promise.all(session.context.pages().map(async (page, page_id) => new TabInfo(page_id, page.url(), await page.title())))
	return tabs_info
}

async swtch_to_tab(this:BrowserContext, page_id: number): Promise<void> {
	const session=await this.get_session()
	let pages=session.context.pages()
	if(page_id>=pages.length){
		throw new BrowserError(`No tab found with page_id: ${page_id}`)
	}
	const page=pages[page_id]
	await page.bringToFront()
	await page.waitForLoadState()
	await this._check_and_handle_navigation(page)
}

async create_new_tab(this:BrowserContext, url: string | null = null): Promise<void> {
	const session = await this.get_session()
	const new_page = await session.context.newPage()
	await new_page.waitForLoadState()

	if (url) {
		await new_page.goto(url)
		await this._wait_for_page_and_frames_load()
	}
}

async _get_current_page(this:BrowserContext,session:BrowserSession): Promise<Page> {
	const pages = session.context.pages()
	return pages[pages.length - 1]
}

async get_selector_map(this:BrowserContext): Promise<SelectorMap> {
	const session = await this.get_session()
	if (session.cached_state === null) {
		return {}
	}
	return session.cached_state.selectorMap
}

async get_element_by_index(this:BrowserContext, index: number): Promise<ElementHandle | null> {
	const selector_map = await this.get_selector_map()
	const element_handle = await this.get_locate_element(selector_map[index])
	return element_handle
}
async get_dom_element_by_index(this:BrowserContext, index: number): Promise<DOMElementNode> {
	const selector_map = await this.get_selector_map()
	return selector_map[index]
}	
async is_file_uploader(this:BrowserContext, element_node: DOMElementNode, max_depth: number = 3, current_depth: number = 0): Promise<boolean> {
	if (current_depth > max_depth) {
		return false
	}	
	let is_uploader = false
	
	if (!(element_node instanceof DOMElementNode)) {
		return false
	}

	// Check for file input attributes
	if (element_node.tagName === 'input') {
		is_uploader = element_node.attributes['type'] === 'file' || element_node.attributes['accept'] !== null
	}

	// Recursively check children
	if (element_node.children && current_depth < max_depth) {
		for (const child of element_node.children) {
			if (await this.is_file_uploader(child as DOMElementNode, max_depth, current_depth + 1)) {
				return true
			}
		}
	}

	return is_uploader
}
async get_scroll_info(this:BrowserContext, page: Page): Promise<[number, number]> {
	const scroll_y:number = await page.evaluate('window.scrollY')
	const viewport_height:number = await page.evaluate('window.innerHeight')
	const total_height:number = await page.evaluate('document.documentElement.scrollHeight')
	const pixels_above:number = scroll_y
	const pixels_below:number = total_height - (scroll_y + viewport_height)
	return [pixels_above, pixels_below]
}
async reset_context(this:BrowserContext): Promise<void> {
	const session = await this.get_session()

	const pages = session.context.pages()
	for (const page of pages) {
		await page.close()
	}

	session.cached_state = null
	this.state!.target_id = ""
}
async _get_unique_filename(this:BrowserContext, directory: string, filename: string): Promise<string> {
    const base = path.basename(filename, path.extname(filename));
    const ext = path.extname(filename);
    let counter = 1;
    let new_filename = filename;

    while (fs.existsSync(path.join(directory, new_filename))) {
        new_filename = `${base} (${counter})${ext}`;
        counter += 1;
    }

    return new_filename;
}

}