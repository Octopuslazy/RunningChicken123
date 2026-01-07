// Comprehensive DOM type declarations for web environment
declare global {
  // Window interface
  interface Window {
    innerWidth: number;
    innerHeight: number;
    devicePixelRatio: number;
    location: Location;
    CSS: {
      supports(property: string, value: string): boolean;
    };
    WebAssembly?: any;
    open(url: string, target?: string, features?: string): Window | null;
    addEventListener(type: string, listener: EventListener | EventListenerObject): void;
    removeEventListener(type: string, listener: EventListener | EventListenerObject): void;
    setTimeout(handler: Function, timeout?: number): number;
  }

  // Document interface
  interface Document {
    getElementById(id: string): HTMLElement | null;
    createElement(tagName: string): HTMLElement;
    body: HTMLBodyElement;
    documentElement: HTMLElement;
    head: HTMLHeadElement;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
    readyState: string;
  }

  // HTMLElement base interface
  interface HTMLElement extends Node {
    id: string;
    className: string;
    style: CSSStyleDeclaration;
    appendChild(child: Node): Node;
    removeChild(child: Node): Node;
    querySelector(selector: string): HTMLElement | null;
    querySelectorAll(selector: string): NodeList;
    getBoundingClientRect(): DOMRect;
    addEventListener(type: string, listener: EventListener | EventListenerObject): void;
    removeEventListener(type: string, listener: EventListener | EventListenerObject): void;
    textContent: string | null;
    innerHTML: string;
    cloneNode(deep?: boolean): Node;
    onclick: ((event: Event) => void) | null;
  }

  // Canvas Element
  interface HTMLCanvasElement extends HTMLElement {
    width: number;
    height: number;
    clientWidth: number;
    clientHeight: number;
    getContext(contextId: '2d'): CanvasRenderingContext2D | null;
    getContext(contextId: 'webgl' | 'webgl2'): WebGLRenderingContext | null;
  }

  // Button Element
  interface HTMLButtonElement extends HTMLElement {
    onclick: ((event: Event) => void) | null;
  }

  // Div Element  
  interface HTMLDivElement extends HTMLElement {
    innerHTML: string;
  }

  // Body Element
  interface HTMLBodyElement extends HTMLElement {}

  // Head Element
  interface HTMLHeadElement extends HTMLElement {}

  // Audio Element
  interface HTMLAudioElement extends HTMLElement {
    src: string;
    play(): Promise<void>;
    pause(): void;
    currentTime: number;
    volume: number;
    loop: boolean;
    autoplay: boolean;
    muted: boolean;
    duration: number;
    preload: string;
    readyState: number;
    paused: boolean;
    cloneNode(deep?: boolean): HTMLAudioElement;
  }

  // CSS Style Declaration
  interface CSSStyleDeclaration {
    [property: string]: string | number;
    width: string;
    height: string;
    position: string;
    top: string;
    left: string;
    right: string;
    bottom: string;
    zIndex: string;
    display: string;
    visibility: string;
    opacity: string;
    background: string;
    backgroundColor: string;
    color: string;
    fontSize: string;
    fontFamily: string;
    textAlign: string;
    margin: string;
    padding: string;
    border: string;
    borderRadius: string;
    getPropertyValue(property: string): string;
  }

  // DOM Rect
  interface DOMRect {
    x: number;
    y: number;
    width: number;
    height: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
  }

  // Node interface
  interface Node {
    nodeType: number;
    parentNode: Node | null;
    childNodes: NodeList;
    firstChild: Node | null;
    lastChild: Node | null;
  }

  // NodeList interface
  interface NodeList {
    length: number;
    [index: number]: Node;
  }

  // Event interfaces
  interface Event {
    type: string;
    target: EventTarget | null;
    preventDefault(): void;
    stopPropagation(): void;
  }

  interface KeyboardEvent extends Event {
    code: string;
    key: string;
    keyCode: number;
  }

  interface EventTarget {
    addEventListener(type: string, listener: EventListener | EventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener(type: string, listener: EventListener | EventListenerObject, options?: boolean | EventListenerOptions): void;
  }

  interface EventListener {
    (event: Event): void;
  }

  interface EventListenerObject {
    handleEvent(event: Event): void;
  }

  interface AddEventListenerOptions extends EventListenerOptions {
    passive?: boolean;
    once?: boolean;
    signal?: AbortSignal;
  }

  interface EventListenerOptions {
    capture?: boolean;
  }

  interface AbortSignal extends EventTarget {
    readonly aborted: boolean;
    readonly reason: any;
  }

  interface EventListenerObject {
    handleEvent(event: Event): void;
  }

  // Location interface
  interface Location {
    href: string;
    hostname: string;
    pathname: string;
    search: string;
    hash: string;
    reload(): void;
  }

  // Navigator interface
  interface Navigator {
    userAgent: string;
    language: string;
    maxTouchPoints: number;
  }

  // Screen interface with event handling
  interface Screen {
    width: number;
    height: number;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
    orientation?: ScreenOrientation;
  }

  interface ScreenOrientation {
    lock(orientation: string): Promise<void>;
    addEventListener(type: string, listener: EventListener): void;
  }

  // Global variables
  declare var window: Window;
  declare var document: Document;
  declare var navigator: Navigator;
  declare var location: Location;
  declare var screen: Screen;

  // Audio constructor  
  declare class Audio implements HTMLAudioElement {
    constructor(src?: string);
    src: string;
    play(): Promise<void>;
    pause(): void;
    currentTime: number;
    volume: number;
    loop: boolean;
    autoplay: boolean;
    muted: boolean;
    duration: number;
    preload: string;
    readyState: number;
    paused: boolean;
    
    // HTMLElement properties
    id: string;
    className: string;
    style: CSSStyleDeclaration;
    appendChild(child: Node): Node;
    removeChild(child: Node): Node;
    querySelector(selector: string): HTMLElement | null;
    querySelectorAll(selector: string): NodeList;
    getBoundingClientRect(): DOMRect;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
    textContent: string | null;
    innerHTML: string;
    cloneNode(deep?: boolean): HTMLAudioElement;
    onclick: ((event: Event) => void) | null;
    
    // Node properties
    nodeType: number;
    parentNode: Node | null;
    childNodes: NodeList;
    firstChild: Node | null;
    lastChild: Node | null;
  }

  // Global functions
  declare function requestAnimationFrame(callback: (time: number) => void): number;
  declare function cancelAnimationFrame(id: number): void;
  declare function getComputedStyle(element: HTMLElement): CSSStyleDeclaration;

  // Console
  declare var console: {
    log(...args: any[]): void;
    error(...args: any[]): void;
    warn(...args: any[]): void;
    info(...args: any[]): void;
    debug(...args: any[]): void;
  };
}

// Empty export to make this a module
export {};