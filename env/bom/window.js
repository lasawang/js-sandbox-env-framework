/**
 * @env-module window
 * @description 浏览器window全局对象模拟 - 增强版，支持完整监控
 * @compatibility Chrome 80+, Firefox 75+, Edge 79+
 * @version 2.0.0
 */

(function() {
    'use strict';
    
    // 获取监控系统
    const Monitor = window.__EnvMonitor__ || window.__envMonitor__ || {
        log: function() {},
        logCall: function() {},
        hasMock: function() { return false; },
        executeMock: function() { return { mocked: false }; }
    };
    
    // ==================== 基础属性 ====================
    window.name = '';
    window.status = '';
    window.closed = false;
    window.innerWidth = 1920;
    window.innerHeight = 1080;
    window.outerWidth = 1920;
    window.outerHeight = 1080;
    window.screenX = 0;
    window.screenY = 0;
    window.screenLeft = 0;
    window.screenTop = 0;
    window.pageXOffset = 0;
    window.pageYOffset = 0;
    window.scrollX = 0;
    window.scrollY = 0;
    window.devicePixelRatio = 1;
    window.isSecureContext = true;
    window.origin = 'https://example.com';
    window.crossOriginIsolated = false;
    
    // frames 相关
    window.length = 0;
    window.frames = window;
    window.parent = window;
    window.top = window;
    window.self = window;
    window.opener = null;
    window.frameElement = null;
    
    // 可视化视口
    window.visualViewport = {
        width: window.innerWidth,
        height: window.innerHeight,
        offsetLeft: 0,
        offsetTop: 0,
        pageLeft: 0,
        pageTop: 0,
        scale: 1,
        onresize: null,
        onscroll: null,
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return true; }
    };
    
    // ==================== 对话框方法 ====================
    window.alert = function(message) {
        Monitor.log('Window', 'alert', { message: String(message).substring(0, 100) });
        console.log('[Alert]', message);
    };
    
    window.confirm = function(message) {
        Monitor.log('Window', 'confirm', { message: String(message).substring(0, 100) });
        console.log('[Confirm]', message);
        
        const mock = Monitor.executeMock('window.confirm', [message]);
        if (mock.mocked) return mock.result;
        
        return true;
    };
    
    window.prompt = function(message, defaultValue) {
        Monitor.log('Window', 'prompt', { message: String(message).substring(0, 100), defaultValue });
        console.log('[Prompt]', message);
        
        const mock = Monitor.executeMock('window.prompt', [message, defaultValue]);
        if (mock.mocked) return mock.result;
        
        return defaultValue || '';
    };
    
    // ==================== 窗口操作 ====================
    window.open = function(url, name, features) {
        Monitor.log('Window', 'open', { url, name, features });
        console.log('[window.open]', url, name);
        
        const mock = Monitor.executeMock('window.open', [url, name, features]);
        if (mock.mocked) return mock.result;
        
        return null;
    };
    
    window.close = function() {
        Monitor.log('Window', 'close', {});
        console.log('[window.close]');
    };
    
    window.focus = function() {
        Monitor.log('Window', 'focus', {});
    };
    
    window.blur = function() {
        Monitor.log('Window', 'blur', {});
    };
    
    window.print = function() {
        Monitor.log('Window', 'print', {});
    };
    
    window.stop = function() {
        Monitor.log('Window', 'stop', {});
    };
    
    // ==================== 窗口位置和大小 ====================
    window.moveBy = function(x, y) {
        Monitor.log('Window', 'moveBy', { x, y });
    };
    
    window.moveTo = function(x, y) {
        Monitor.log('Window', 'moveTo', { x, y });
    };
    
    window.resizeBy = function(x, y) {
        Monitor.log('Window', 'resizeBy', { x, y });
    };
    
    window.resizeTo = function(width, height) {
        Monitor.log('Window', 'resizeTo', { width, height });
    };
    
    // ==================== 滚动方法 ====================
    window.scroll = function(xOrOptions, y) {
        let x = xOrOptions, yPos = y;
        if (typeof xOrOptions === 'object') {
            x = xOrOptions.left || 0;
            yPos = xOrOptions.top || 0;
        }
        window.scrollX = x;
        window.scrollY = yPos;
        window.pageXOffset = x;
        window.pageYOffset = yPos;
        Monitor.log('Window', 'scroll', { x, y: yPos });
    };
    
    window.scrollTo = window.scroll;
    
    window.scrollBy = function(xOrOptions, y) {
        let x = xOrOptions, yPos = y;
        if (typeof xOrOptions === 'object') {
            x = xOrOptions.left || 0;
            yPos = xOrOptions.top || 0;
        }
        window.scroll(window.scrollX + x, window.scrollY + yPos);
    };
    
    // ==================== 动画帧 ====================
    let rafId = 0;
    const rafCallbacks = new Map();
    
    window.requestAnimationFrame = function(callback) {
        const id = ++rafId;
        Monitor.log('Window', 'requestAnimationFrame', { id });
        
        const mock = Monitor.executeMock('window.requestAnimationFrame', [callback]);
        if (mock.mocked) return mock.result;
        
        rafCallbacks.set(id, callback);
        // 模拟下一帧执行
        setTimeout(() => {
            if (rafCallbacks.has(id)) {
                rafCallbacks.delete(id);
                try {
                    callback(Date.now());
                } catch (e) {}
            }
        }, 16);
        return id;
    };
    
    window.cancelAnimationFrame = function(id) {
        Monitor.log('Window', 'cancelAnimationFrame', { id });
        rafCallbacks.delete(id);
    };
    
    // ==================== 空闲回调 ====================
    let ricId = 0;
    const ricCallbacks = new Map();
    
    window.requestIdleCallback = function(callback, options) {
        const id = ++ricId;
        Monitor.log('Window', 'requestIdleCallback', { id, options });
        
        const mock = Monitor.executeMock('window.requestIdleCallback', [callback, options]);
        if (mock.mocked) return mock.result;
        
        ricCallbacks.set(id, callback);
        setTimeout(() => {
            if (ricCallbacks.has(id)) {
                ricCallbacks.delete(id);
                try {
                    callback({
                        didTimeout: false,
                        timeRemaining: function() { return 50; }
                    });
                } catch (e) {}
            }
        }, options?.timeout || 50);
        return id;
    };
    
    window.cancelIdleCallback = function(id) {
        Monitor.log('Window', 'cancelIdleCallback', { id });
        ricCallbacks.delete(id);
    };
    
    // ==================== 样式计算 ====================
    window.getComputedStyle = function(element, pseudoElement) {
        Monitor.log('Window', 'getComputedStyle', { 
            elementId: element?.__id__,
            tagName: element?.tagName,
            pseudoElement 
        });
        
        const mock = Monitor.executeMock('window.getComputedStyle', [element, pseudoElement]);
        if (mock.mocked) return mock.result;
        
        // 返回元素的 style 对象或默认空样式
        const styles = element?.style?._styles || {};
        
        return {
            getPropertyValue: function(prop) {
                const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                return styles[prop] || styles[camelProp] || '';
            },
            getPropertyPriority: function(prop) {
                return '';
            },
            setProperty: function() {},
            removeProperty: function() {},
            item: function(index) { return ''; },
            length: 0,
            cssText: '',
            parentRule: null,
            // 常用属性默认值
            display: styles.display || 'block',
            position: styles.position || 'static',
            visibility: styles.visibility || 'visible',
            opacity: styles.opacity || '1',
            width: styles.width || 'auto',
            height: styles.height || 'auto',
            margin: styles.margin || '0px',
            padding: styles.padding || '0px',
            border: styles.border || '',
            color: styles.color || 'rgb(0, 0, 0)',
            backgroundColor: styles.backgroundColor || 'rgba(0, 0, 0, 0)',
            fontSize: styles.fontSize || '16px',
            fontFamily: styles.fontFamily || 'sans-serif',
            fontWeight: styles.fontWeight || '400',
            lineHeight: styles.lineHeight || 'normal',
            textAlign: styles.textAlign || 'start',
            transform: styles.transform || 'none',
            transition: styles.transition || '',
            overflow: styles.overflow || 'visible',
            zIndex: styles.zIndex || 'auto'
        };
    };
    
    // ==================== 媒体查询 ====================
    window.matchMedia = function(query) {
        Monitor.log('Window', 'matchMedia', { query });
        
        const mock = Monitor.executeMock('window.matchMedia', [query]);
        if (mock.mocked) return mock.result;
        
        // 简单的媒体查询匹配逻辑
        let matches = false;
        
        // 常见查询模式处理
        if (query.includes('prefers-color-scheme: dark')) {
            matches = false; // 默认亮色模式
        } else if (query.includes('prefers-color-scheme: light')) {
            matches = true;
        } else if (query.includes('prefers-reduced-motion')) {
            matches = false;
        } else if (query.includes('min-width')) {
            const match = query.match(/min-width:\s*(\d+)px/);
            if (match) {
                matches = window.innerWidth >= parseInt(match[1]);
            }
        } else if (query.includes('max-width')) {
            const match = query.match(/max-width:\s*(\d+)px/);
            if (match) {
                matches = window.innerWidth <= parseInt(match[1]);
            }
        }
        
        return {
            matches: matches,
            media: query,
            onchange: null,
            addListener: function(listener) { /* deprecated */ },
            removeListener: function(listener) { /* deprecated */ },
            addEventListener: function(type, listener) {},
            removeEventListener: function(type, listener) {},
            dispatchEvent: function(event) { return true; }
        };
    };
    
    // ==================== 选择 ====================
    window.getSelection = function() {
        Monitor.log('Window', 'getSelection', {});
        
        const mock = Monitor.executeMock('window.getSelection', []);
        if (mock.mocked) return mock.result;
        
        return {
            anchorNode: null,
            anchorOffset: 0,
            focusNode: null,
            focusOffset: 0,
            isCollapsed: true,
            rangeCount: 0,
            type: 'None',
            addRange: function() {},
            collapse: function() {},
            collapseToEnd: function() {},
            collapseToStart: function() {},
            containsNode: function() { return false; },
            deleteFromDocument: function() {},
            empty: function() {},
            extend: function() {},
            getRangeAt: function() { return null; },
            removeAllRanges: function() {},
            removeRange: function() {},
            selectAllChildren: function() {},
            setBaseAndExtent: function() {},
            setPosition: function() {},
            toString: function() { return ''; }
        };
    };
    
    // ==================== 消息传递 ====================
    window.postMessage = function(message, targetOrigin, transfer) {
        Monitor.log('Window', 'postMessage', { 
            message: typeof message === 'object' ? '[Object]' : String(message).substring(0, 100),
            targetOrigin 
        });
        console.log('[postMessage]', message, targetOrigin);
    };
    
    // ==================== Fetch API ====================
    if (typeof window.fetch === 'undefined') {
        window.fetch = function(url, options) {
            Monitor.log('Window', 'fetch', { url, method: options?.method || 'GET' });
            console.log('[fetch]', url);
            
            const mock = Monitor.executeMock('window.fetch', [url, options]);
            if (mock.mocked) return mock.result;
            
            return Promise.resolve({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers(),
                url: url,
                redirected: false,
                type: 'basic',
                clone: function() { return this; },
                json: function() { return Promise.resolve({}); },
                text: function() { return Promise.resolve(''); },
                blob: function() { return Promise.resolve(new Blob()); },
                arrayBuffer: function() { return Promise.resolve(new ArrayBuffer(0)); },
                formData: function() { return Promise.resolve(new FormData()); }
            });
        };
    }
    
    // ==================== Web Workers (stub) ====================
    window.Worker = function(scriptURL, options) {
        Monitor.log('Window', 'Worker', { scriptURL, options });
        
        this.onmessage = null;
        this.onerror = null;
        this.onmessageerror = null;
        
        this.postMessage = function(message, transfer) {
            Monitor.log('Worker', 'postMessage', { message: typeof message });
        };
        
        this.terminate = function() {
            Monitor.log('Worker', 'terminate', {});
        };
        
        this.addEventListener = function(type, listener) {};
        this.removeEventListener = function(type, listener) {};
        this.dispatchEvent = function(event) { return true; };
    };
    
    // ==================== SharedWorker (stub) ====================
    window.SharedWorker = function(scriptURL, options) {
        Monitor.log('Window', 'SharedWorker', { scriptURL, options });
        
        this.port = {
            start: function() {},
            close: function() {},
            postMessage: function(message, transfer) {},
            onmessage: null,
            onmessageerror: null,
            addEventListener: function() {},
            removeEventListener: function() {},
            dispatchEvent: function() { return true; }
        };
        this.onerror = null;
    };
    
    // ==================== Service Worker (stub) ====================
    window.ServiceWorker = function() {};
    
    // ==================== 导航器（navigator 在单独文件中） ====================
    
    // ==================== 结构化克隆 ====================
    window.structuredClone = function(value, options) {
        Monitor.log('Window', 'structuredClone', {});
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (e) {
            return value;
        }
    };
    
    // ==================== queueMicrotask ====================
    window.queueMicrotask = function(callback) {
        Monitor.log('Window', 'queueMicrotask', {});
        Promise.resolve().then(callback);
    };
    
    // ==================== reportError ====================
    window.reportError = function(error) {
        Monitor.log('Window', 'reportError', { error: String(error) });
        console.error('[reportError]', error);
    };
    
    // ==================== Crypto Random ====================
    if (!window.crypto) {
        window.crypto = {
            subtle: {},
            getRandomValues: function(array) {
                for (let i = 0; i < array.length; i++) {
                    array[i] = Math.floor(Math.random() * 256);
                }
                return array;
            },
            randomUUID: function() {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }
        };
    }
    
    // ==================== 事件监听 ====================
    const windowEventListeners = {};
    
    window.addEventListener = function(type, listener, options) {
        if (!windowEventListeners[type]) {
            windowEventListeners[type] = [];
        }
        windowEventListeners[type].push({ listener, options });
        Monitor.log('Event', 'addEventListener', { target: 'window', type });
    };
    
    window.removeEventListener = function(type, listener, options) {
        if (windowEventListeners[type]) {
            windowEventListeners[type] = windowEventListeners[type].filter(l => l.listener !== listener);
        }
        Monitor.log('Event', 'removeEventListener', { target: 'window', type });
    };
    
    window.dispatchEvent = function(event) {
        event.target = window;
        event.currentTarget = window;
        const listeners = windowEventListeners[event.type] || [];
        listeners.forEach(({ listener }) => {
            if (typeof listener === 'function') {
                listener.call(window, event);
            }
        });
        return !event.defaultPrevented;
    };
    
    // ==================== 全屏 API ====================
    window.requestFullscreen = function() {
        Monitor.log('Window', 'requestFullscreen', {});
        return Promise.resolve();
    };
    
    // ==================== 屏幕唤醒锁 ====================
    window.WakeLock = function() {};
    
    // ==================== 位置相关 （location 在单独文件中）====================
    
    // ==================== 历史记录（history 在单独文件中）====================
    
    // ==================== IndexedDB (stub) ====================
    window.indexedDB = {
        open: function(name, version) {
            Monitor.log('IndexedDB', 'open', { name, version });
            
            const request = {
                result: null,
                error: null,
                source: null,
                transaction: null,
                readyState: 'pending',
                onsuccess: null,
                onerror: null,
                onupgradeneeded: null,
                onblocked: null
            };
            
            setTimeout(() => {
                request.readyState = 'done';
                request.result = {
                    name: name,
                    version: version || 1,
                    objectStoreNames: [],
                    createObjectStore: function(name, options) {
                        return {
                            name: name,
                            keyPath: options?.keyPath,
                            autoIncrement: options?.autoIncrement,
                            indexNames: [],
                            createIndex: function() {},
                            deleteIndex: function() {},
                            add: function() { return request; },
                            put: function() { return request; },
                            get: function() { return request; },
                            delete: function() { return request; },
                            clear: function() { return request; },
                            getAll: function() { return request; },
                            getAllKeys: function() { return request; },
                            count: function() { return request; },
                            openCursor: function() { return request; },
                            openKeyCursor: function() { return request; }
                        };
                    },
                    deleteObjectStore: function() {},
                    transaction: function(storeNames, mode) {
                        return {
                            objectStore: function(name) {
                                return request.result.createObjectStore(name);
                            },
                            abort: function() {},
                            commit: function() {},
                            oncomplete: null,
                            onerror: null,
                            onabort: null
                        };
                    },
                    close: function() {}
                };
                if (request.onsuccess) request.onsuccess({ target: request });
            }, 0);
            
            return request;
        },
        deleteDatabase: function(name) {
            Monitor.log('IndexedDB', 'deleteDatabase', { name });
            const request = { onsuccess: null, onerror: null };
            setTimeout(() => {
                if (request.onsuccess) request.onsuccess({});
            }, 0);
            return request;
        },
        cmp: function(a, b) {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        },
        databases: function() {
            return Promise.resolve([]);
        }
    };
    
    // IDBKeyRange
    window.IDBKeyRange = {
        only: function(value) {
            return { lower: value, upper: value, lowerOpen: false, upperOpen: false };
        },
        lowerBound: function(lower, open) {
            return { lower, upper: undefined, lowerOpen: !!open, upperOpen: true };
        },
        upperBound: function(upper, open) {
            return { lower: undefined, upper, lowerOpen: true, upperOpen: !!open };
        },
        bound: function(lower, upper, lowerOpen, upperOpen) {
            return { lower, upper, lowerOpen: !!lowerOpen, upperOpen: !!upperOpen };
        }
    };
    
    // ==================== Broadcast Channel ====================
    window.BroadcastChannel = function(name) {
        Monitor.log('Window', 'BroadcastChannel', { name });
        
        this.name = name;
        this.onmessage = null;
        this.onmessageerror = null;
        
        this.postMessage = function(message) {
            Monitor.log('BroadcastChannel', 'postMessage', { name, message: typeof message });
        };
        
        this.close = function() {
            Monitor.log('BroadcastChannel', 'close', { name });
        };
        
        this.addEventListener = function(type, listener) {};
        this.removeEventListener = function(type, listener) {};
        this.dispatchEvent = function(event) { return true; };
    };
    
    // ==================== MessageChannel ====================
    window.MessageChannel = function() {
        Monitor.log('Window', 'MessageChannel', {});
        
        const port1Listeners = {};
        const port2Listeners = {};
        
        this.port1 = {
            postMessage: function(message, transfer) {
                Monitor.log('MessagePort', 'postMessage', { port: 1 });
            },
            start: function() {},
            close: function() {},
            onmessage: null,
            onmessageerror: null,
            addEventListener: function(type, listener) {
                if (!port1Listeners[type]) port1Listeners[type] = [];
                port1Listeners[type].push(listener);
            },
            removeEventListener: function(type, listener) {},
            dispatchEvent: function(event) { return true; }
        };
        
        this.port2 = {
            postMessage: function(message, transfer) {
                Monitor.log('MessagePort', 'postMessage', { port: 2 });
            },
            start: function() {},
            close: function() {},
            onmessage: null,
            onmessageerror: null,
            addEventListener: function(type, listener) {
                if (!port2Listeners[type]) port2Listeners[type] = [];
                port2Listeners[type].push(listener);
            },
            removeEventListener: function(type, listener) {},
            dispatchEvent: function(event) { return true; }
        };
    };
    
    // ==================== Notification (stub) ====================
    window.Notification = function(title, options) {
        Monitor.log('Window', 'Notification', { title, options });
        
        this.title = title;
        this.body = options?.body || '';
        this.icon = options?.icon || '';
        this.tag = options?.tag || '';
        this.data = options?.data;
        this.requireInteraction = options?.requireInteraction || false;
        this.silent = options?.silent || false;
        
        this.onclick = null;
        this.onclose = null;
        this.onerror = null;
        this.onshow = null;
        
        this.close = function() {
            Monitor.log('Notification', 'close', {});
        };
        
        this.addEventListener = function() {};
        this.removeEventListener = function() {};
        this.dispatchEvent = function() { return true; };
    };
    
    window.Notification.permission = 'default';
    window.Notification.requestPermission = function(callback) {
        Monitor.log('Notification', 'requestPermission', {});
        const result = 'granted';
        if (callback) callback(result);
        return Promise.resolve(result);
    };
    
    // ==================== Clipboard API ====================
    if (!window.navigator) window.navigator = {};
    
    window.navigator.clipboard = {
        read: function() {
            Monitor.log('Clipboard', 'read', {});
            return Promise.resolve([]);
        },
        readText: function() {
            Monitor.log('Clipboard', 'readText', {});
            return Promise.resolve('');
        },
        write: function(data) {
            Monitor.log('Clipboard', 'write', {});
            return Promise.resolve();
        },
        writeText: function(text) {
            Monitor.log('Clipboard', 'writeText', { text: text?.substring(0, 50) });
            return Promise.resolve();
        }
    };
    
    // ==================== Screen Orientation ====================
    window.screen = window.screen || {};
    window.screen.orientation = {
        type: 'landscape-primary',
        angle: 0,
        onchange: null,
        lock: function(orientation) {
            Monitor.log('ScreenOrientation', 'lock', { orientation });
            return Promise.resolve();
        },
        unlock: function() {
            Monitor.log('ScreenOrientation', 'unlock', {});
        },
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return true; }
    };
    
    // ==================== ResizeObserver ====================
    window.ResizeObserver = function(callback) {
        Monitor.log('Window', 'ResizeObserver', {});
        
        this._callback = callback;
        this._targets = [];
        
        this.observe = function(target, options) {
            Monitor.log('ResizeObserver', 'observe', { elementId: target?.__id__ });
            this._targets.push({ target, options });
        };
        
        this.unobserve = function(target) {
            Monitor.log('ResizeObserver', 'unobserve', { elementId: target?.__id__ });
            this._targets = this._targets.filter(t => t.target !== target);
        };
        
        this.disconnect = function() {
            Monitor.log('ResizeObserver', 'disconnect', {});
            this._targets = [];
        };
    };
    
    // ==================== IntersectionObserver ====================
    window.IntersectionObserver = function(callback, options) {
        Monitor.log('Window', 'IntersectionObserver', { options });
        
        this._callback = callback;
        this._options = options || {};
        this._targets = [];
        
        this.root = options?.root || null;
        this.rootMargin = options?.rootMargin || '0px';
        this.thresholds = options?.threshold 
            ? (Array.isArray(options.threshold) ? options.threshold : [options.threshold])
            : [0];
        
        this.observe = function(target) {
            Monitor.log('IntersectionObserver', 'observe', { elementId: target?.__id__ });
            this._targets.push(target);
            
            // 模拟初始回调
            const self = this;
            setTimeout(() => {
                if (self._callback) {
                    self._callback([{
                        target: target,
                        isIntersecting: true,
                        intersectionRatio: 1,
                        boundingClientRect: target.getBoundingClientRect ? target.getBoundingClientRect() : {},
                        intersectionRect: target.getBoundingClientRect ? target.getBoundingClientRect() : {},
                        rootBounds: null,
                        time: Date.now()
                    }], self);
                }
            }, 0);
        };
        
        this.unobserve = function(target) {
            Monitor.log('IntersectionObserver', 'unobserve', { elementId: target?.__id__ });
            this._targets = this._targets.filter(t => t !== target);
        };
        
        this.disconnect = function() {
            Monitor.log('IntersectionObserver', 'disconnect', {});
            this._targets = [];
        };
        
        this.takeRecords = function() {
            return [];
        };
    };
    
    // ==================== MutationObserver ====================
    window.MutationObserver = function(callback) {
        Monitor.log('Window', 'MutationObserver', {});
        
        this._callback = callback;
        this._targets = [];
        
        this.observe = function(target, options) {
            Monitor.log('MutationObserver', 'observe', { 
                elementId: target?.__id__,
                options 
            });
            this._targets.push({ target, options });
        };
        
        this.disconnect = function() {
            Monitor.log('MutationObserver', 'disconnect', {});
            this._targets = [];
        };
        
        this.takeRecords = function() {
            return [];
        };
    };
    
    // ==================== PerformanceObserver ====================
    window.PerformanceObserver = function(callback) {
        Monitor.log('Window', 'PerformanceObserver', {});
        
        this._callback = callback;
        
        this.observe = function(options) {
            Monitor.log('PerformanceObserver', 'observe', { options });
        };
        
        this.disconnect = function() {
            Monitor.log('PerformanceObserver', 'disconnect', {});
        };
        
        this.takeRecords = function() {
            return [];
        };
    };
    
    window.PerformanceObserver.supportedEntryTypes = [
        'element', 'event', 'first-input', 'largest-contentful-paint',
        'layout-shift', 'longtask', 'mark', 'measure', 'navigation',
        'paint', 'resource'
    ];
    
    // ==================== ReportingObserver ====================
    window.ReportingObserver = function(callback, options) {
        Monitor.log('Window', 'ReportingObserver', { options });
        
        this._callback = callback;
        this._options = options || {};
        
        this.observe = function() {
            Monitor.log('ReportingObserver', 'observe', {});
        };
        
        this.disconnect = function() {
            Monitor.log('ReportingObserver', 'disconnect', {});
        };
        
        this.takeRecords = function() {
            return [];
        };
    };
    
    // ==================== CSS 相关 ====================
    window.CSS = {
        supports: function(property, value) {
            Monitor.log('CSS', 'supports', { property, value });
            return true;
        },
        escape: function(ident) {
            return ident.replace(/([^\w-])/g, '\\$1');
        },
        registerProperty: function(definition) {
            Monitor.log('CSS', 'registerProperty', { name: definition?.name });
        },
        Hz: function(value) { return value + 'Hz'; },
        Q: function(value) { return value + 'Q'; },
        ch: function(value) { return value + 'ch'; },
        cm: function(value) { return value + 'cm'; },
        deg: function(value) { return value + 'deg'; },
        dpcm: function(value) { return value + 'dpcm'; },
        dpi: function(value) { return value + 'dpi'; },
        dppx: function(value) { return value + 'dppx'; },
        em: function(value) { return value + 'em'; },
        ex: function(value) { return value + 'ex'; },
        fr: function(value) { return value + 'fr'; },
        grad: function(value) { return value + 'grad'; },
        in: function(value) { return value + 'in'; },
        kHz: function(value) { return value + 'kHz'; },
        mm: function(value) { return value + 'mm'; },
        ms: function(value) { return value + 'ms'; },
        number: function(value) { return value; },
        pc: function(value) { return value + 'pc'; },
        percent: function(value) { return value + '%'; },
        pt: function(value) { return value + 'pt'; },
        px: function(value) { return value + 'px'; },
        rad: function(value) { return value + 'rad'; },
        rem: function(value) { return value + 'rem'; },
        s: function(value) { return value + 's'; },
        turn: function(value) { return value + 'turn'; },
        vh: function(value) { return value + 'vh'; },
        vmax: function(value) { return value + 'vmax'; },
        vmin: function(value) { return value + 'vmin'; },
        vw: function(value) { return value + 'vw'; }
    };
    
    // ==================== CSSStyleSheet ====================
    window.CSSStyleSheet = function(options) {
        this.cssRules = [];
        this.ownerRule = null;
        this.ownerNode = null;
        this.href = null;
        this.title = null;
        this.type = 'text/css';
        this.disabled = false;
        this.media = { length: 0 };
        
        this.insertRule = function(rule, index) {
            this.cssRules.splice(index, 0, { cssText: rule });
            return index;
        };
        
        this.deleteRule = function(index) {
            this.cssRules.splice(index, 1);
        };
        
        this.replace = function(text) {
            this.cssRules = [{ cssText: text }];
            return Promise.resolve(this);
        };
        
        this.replaceSync = function(text) {
            this.cssRules = [{ cssText: text }];
        };
    };
    
    // ==================== 计时器 (已在 timer 模块中实现) ====================
    
    // ==================== Scheduler API ====================
    window.scheduler = {
        postTask: function(callback, options) {
            Monitor.log('Scheduler', 'postTask', { options });
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve(callback());
                }, 0);
            });
        },
        yield: function() {
            return Promise.resolve();
        }
    };
    
    // ==================== Trusted Types (stub) ====================
    window.trustedTypes = {
        createPolicy: function(name, rules) {
            Monitor.log('TrustedTypes', 'createPolicy', { name });
            return {
                name: name,
                createHTML: rules?.createHTML || function(s) { return s; },
                createScript: rules?.createScript || function(s) { return s; },
                createScriptURL: rules?.createScriptURL || function(s) { return s; }
            };
        },
        isHTML: function(value) { return false; },
        isScript: function(value) { return false; },
        isScriptURL: function(value) { return false; },
        getAttributeType: function(tagName, attribute) { return null; },
        getPropertyType: function(tagName, property) { return null; },
        defaultPolicy: null,
        emptyHTML: '',
        emptyScript: ''
    };
    
    // ==================== 缓存 API (stub) ====================
    window.caches = {
        open: function(cacheName) {
            Monitor.log('CacheStorage', 'open', { cacheName });
            return Promise.resolve({
                match: function() { return Promise.resolve(undefined); },
                matchAll: function() { return Promise.resolve([]); },
                add: function() { return Promise.resolve(); },
                addAll: function() { return Promise.resolve(); },
                put: function() { return Promise.resolve(); },
                delete: function() { return Promise.resolve(true); },
                keys: function() { return Promise.resolve([]); }
            });
        },
        match: function(request) {
            Monitor.log('CacheStorage', 'match', {});
            return Promise.resolve(undefined);
        },
        has: function(cacheName) {
            return Promise.resolve(false);
        },
        delete: function(cacheName) {
            return Promise.resolve(true);
        },
        keys: function() {
            return Promise.resolve([]);
        }
    };
    
    // ==================== 常用事件属性 ====================
    window.onload = null;
    window.onunload = null;
    window.onbeforeunload = null;
    window.onerror = null;
    window.onresize = null;
    window.onscroll = null;
    window.onhashchange = null;
    window.onpopstate = null;
    window.onfocus = null;
    window.onblur = null;
    window.onmessage = null;
    window.ononline = null;
    window.onoffline = null;
    window.onstorage = null;
    window.onpagehide = null;
    window.onpageshow = null;
    window.onrejectionhandled = null;
    window.onunhandledrejection = null;
    
    // ==================== 其他常用属性 ====================
    window.customElements = {
        define: function(name, constructor, options) {
            Monitor.log('CustomElements', 'define', { name });
        },
        get: function(name) {
            return undefined;
        },
        getName: function(constructor) {
            return null;
        },
        whenDefined: function(name) {
            return Promise.resolve(function() {});
        },
        upgrade: function(root) {}
    };
    
    // ==================== SpeechSynthesis (stub) ====================
    window.speechSynthesis = {
        speaking: false,
        pending: false,
        paused: false,
        onvoiceschanged: null,
        speak: function(utterance) {
            Monitor.log('SpeechSynthesis', 'speak', { text: utterance?.text?.substring(0, 50) });
        },
        cancel: function() {},
        pause: function() {},
        resume: function() {},
        getVoices: function() { return []; },
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return true; }
    };
    
    // ==================== Intl (usually built-in) ====================
    if (!window.Intl) {
        window.Intl = {
            DateTimeFormat: function() { return { format: function(date) { return date.toString(); } }; },
            NumberFormat: function() { return { format: function(num) { return num.toString(); } }; },
            Collator: function() { return { compare: function(a, b) { return a.localeCompare(b); } }; },
            PluralRules: function() { return { select: function() { return 'other'; } }; }
        };
    }
    
    Monitor.log('BOM', 'window.init', { version: '2.0.0' });
    
})();
