/**
 * @env-module document
 * @description 浏览器document对象模拟 - 带完整监控功能和灵活mock支持
 * @compatibility Chrome 80+, Firefox 75+, Edge 79+
 * @version 2.0.0
 */

(function() {
    'use strict';
    
    // ==================== 获取监控系统 ====================
    const Monitor = window.__EnvMonitor__ || window.__envMonitor__ || {
        log: function() {},
        logUndefined: function() {},
        logCall: function() {},
        logCreate: function() {},
        hasMock: function() { return false; },
        executeMock: function() { return { mocked: false }; },
        pushChain: function() {},
        popChain: function() {},
        config: { enabled: false }
    };
    
    // ==================== 唯一ID生成器 ====================
    let __elementId__ = 0;
    function generateElementId() {
        return 'el_' + (++__elementId__);
    }
    
    // ==================== 存储创建的元素 ====================
    const __createdElements__ = new Map();
    window.__createdElements__ = __createdElements__;
    
    // ==================== CSSStyleDeclaration ====================
    function CSSStyleDeclaration(element) {
        this._element = element;
        this._styles = {};
        this._importantStyles = {};
        
        return new Proxy(this, {
            get: function(target, prop) {
                if (prop in target) return target[prop];
                if (typeof prop === 'symbol') return target[prop];
                const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                return target._styles[prop] || target._styles[cssProp] || '';
            },
            set: function(target, prop, value) {
                if (prop.startsWith('_')) {
                    target[prop] = value;
                    return true;
                }
                const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                target._styles[prop] = value;
                target._styles[cssProp] = value;
                
                Monitor.log('Style', 'setStyle', {
                    elementId: target._element?.__id__,
                    tagName: target._element?.tagName,
                    property: prop,
                    value: value
                });
                return true;
            }
        });
    }
    
    CSSStyleDeclaration.prototype = {
        getPropertyValue: function(prop) { return this._styles[prop] || ''; },
        setProperty: function(prop, value, priority) {
            this._styles[prop] = value;
            if (priority === 'important') this._importantStyles[prop] = true;
            Monitor.log('Style', 'setProperty', {
                elementId: this._element?.__id__,
                property: prop,
                value: value,
                priority: priority
            });
        },
        removeProperty: function(prop) {
            const value = this._styles[prop];
            delete this._styles[prop];
            delete this._importantStyles[prop];
            return value || '';
        },
        getPropertyPriority: function(prop) {
            return this._importantStyles[prop] ? 'important' : '';
        },
        get cssText() {
            return Object.entries(this._styles)
                .filter(([k]) => !k.startsWith('_'))
                .map(([k, v]) => `${k}: ${v}`)
                .join('; ');
        },
        set cssText(value) {
            this._styles = {};
            if (value) {
                value.split(';').forEach(part => {
                    const [prop, val] = part.split(':').map(s => s?.trim());
                    if (prop && val) this._styles[prop] = val;
                });
            }
        },
        get length() {
            return Object.keys(this._styles).filter(k => !k.startsWith('_')).length;
        },
        item: function(index) {
            return Object.keys(this._styles).filter(k => !k.startsWith('_'))[index] || '';
        }
    };
    
    // ==================== DOMTokenList (classList) ====================
    function DOMTokenList(element, attrName) {
        this._element = element;
        this._attrName = attrName;
        this._tokens = [];
    }
    
    DOMTokenList.prototype = {
        _update: function() {
            if (this._element && this._attrName === 'class') {
                this._element.className = this._tokens.join(' ');
            }
        },
        add: function(...tokens) {
            tokens.forEach(token => {
                if (token && !this._tokens.includes(token)) {
                    this._tokens.push(token);
                }
            });
            this._update();
            Monitor.log('Element', 'classList.add', {
                elementId: this._element?.__id__,
                tagName: this._element?.tagName,
                tokens: tokens
            });
        },
        remove: function(...tokens) {
            tokens.forEach(token => {
                const idx = this._tokens.indexOf(token);
                if (idx > -1) this._tokens.splice(idx, 1);
            });
            this._update();
            Monitor.log('Element', 'classList.remove', {
                elementId: this._element?.__id__,
                tagName: this._element?.tagName,
                tokens: tokens
            });
        },
        contains: function(token) { return this._tokens.includes(token); },
        toggle: function(token, force) {
            if (force !== undefined) {
                if (force) this.add(token);
                else this.remove(token);
                return force;
            }
            if (this.contains(token)) {
                this.remove(token);
                return false;
            }
            this.add(token);
            return true;
        },
        replace: function(oldToken, newToken) {
            const idx = this._tokens.indexOf(oldToken);
            if (idx > -1) {
                this._tokens[idx] = newToken;
                this._update();
                return true;
            }
            return false;
        },
        item: function(index) { return this._tokens[index] || null; },
        get length() { return this._tokens.length; },
        get value() { return this._tokens.join(' '); },
        set value(val) {
            this._tokens = val ? val.split(/\s+/).filter(Boolean) : [];
            this._update();
        },
        toString: function() { return this._tokens.join(' '); },
        forEach: function(callback, thisArg) { this._tokens.forEach(callback, thisArg); },
        entries: function() { return this._tokens.entries(); },
        keys: function() { return this._tokens.keys(); },
        values: function() { return this._tokens.values(); },
        [Symbol.iterator]: function() { return this._tokens[Symbol.iterator](); }
    };
    
    // ==================== NamedNodeMap (attributes) ====================
    function NamedNodeMap(element) {
        this._element = element;
        this._attrs = {};
        this.length = 0;
    }
    
    NamedNodeMap.prototype = {
        getNamedItem: function(name) { return this._attrs[name] || null; },
        setNamedItem: function(attr) {
            this._attrs[attr.name] = attr;
            this._updateLength();
            return attr;
        },
        removeNamedItem: function(name) {
            const attr = this._attrs[name];
            delete this._attrs[name];
            this._updateLength();
            return attr;
        },
        item: function(index) {
            return this._attrs[Object.keys(this._attrs)[index]] || null;
        },
        _updateLength: function() {
            this.length = Object.keys(this._attrs).length;
        },
        [Symbol.iterator]: function() {
            const attrs = Object.values(this._attrs);
            let index = 0;
            return {
                next: () => index < attrs.length 
                    ? { value: attrs[index++], done: false } 
                    : { done: true }
            };
        }
    };
    
    // ==================== Attr ====================
    function Attr(name, value, element) {
        this.name = name;
        this.localName = name;
        this.value = value !== undefined ? String(value) : '';
        this.ownerElement = element;
        this.specified = true;
        this.namespaceURI = null;
        this.prefix = null;
    }
    
    // ==================== DOMStringMap (dataset) ====================
    function DOMStringMap(element) {
        this._element = element;
        
        return new Proxy(this, {
            get: function(target, prop) {
                if (prop.startsWith('_') || typeof prop === 'symbol') return target[prop];
                const attrName = 'data-' + prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                return target._element.getAttribute(attrName);
            },
            set: function(target, prop, value) {
                if (prop.startsWith('_')) {
                    target[prop] = value;
                    return true;
                }
                const attrName = 'data-' + prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                target._element.setAttribute(attrName, value);
                return true;
            },
            deleteProperty: function(target, prop) {
                const attrName = 'data-' + prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                target._element.removeAttribute(attrName);
                return true;
            },
            ownKeys: function(target) {
                const keys = [];
                const attrs = target._element.attributes;
                for (let i = 0; i < attrs.length; i++) {
                    const attr = attrs.item(i);
                    if (attr && attr.name.startsWith('data-')) {
                        keys.push(attr.name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
                    }
                }
                return keys;
            },
            getOwnPropertyDescriptor: function(target, prop) {
                return { enumerable: true, configurable: true, value: target[prop] };
            }
        });
    }
    
    // ==================== DOMRect ====================
    function DOMRect(x, y, width, height) {
        this.x = x || 0;
        this.y = y || 0;
        this.width = width || 0;
        this.height = height || 0;
        this.top = this.y;
        this.left = this.x;
        this.right = this.x + this.width;
        this.bottom = this.y + this.height;
    }
    window.DOMRect = DOMRect;
    
    // ==================== Node 基类 ====================
    function Node() {
        this.__id__ = generateElementId();
        this.nodeType = 1;
        this.nodeName = '';
        this.nodeValue = null;
        this.childNodes = [];
        this.parentNode = null;
        this.parentElement = null;
        this.firstChild = null;
        this.lastChild = null;
        this.previousSibling = null;
        this.nextSibling = null;
        this.ownerDocument = null;
        this.textContent = '';
        this.isConnected = false;
    }
    
    Node.prototype = {
        // 节点类型常量
        ELEMENT_NODE: 1,
        ATTRIBUTE_NODE: 2,
        TEXT_NODE: 3,
        CDATA_SECTION_NODE: 4,
        PROCESSING_INSTRUCTION_NODE: 7,
        COMMENT_NODE: 8,
        DOCUMENT_NODE: 9,
        DOCUMENT_TYPE_NODE: 10,
        DOCUMENT_FRAGMENT_NODE: 11,
        
        appendChild: function(child) {
            if (child.parentNode) child.parentNode.removeChild(child);
            child.parentNode = this;
            child.parentElement = this.nodeType === 1 ? this : null;
            child.ownerDocument = this.ownerDocument;
            this.childNodes.push(child);
            this._updateChildReferences();
            
            Monitor.log('DOM', 'appendChild', {
                parentId: this.__id__,
                parentTag: this.tagName || this.nodeName,
                childId: child.__id__,
                childTag: child.tagName || child.nodeName
            });
            return child;
        },
        
        removeChild: function(child) {
            const idx = this.childNodes.indexOf(child);
            if (idx === -1) {
                throw new DOMException("Failed to execute 'removeChild': The node to be removed is not a child of this node.", 'NotFoundError');
            }
            this.childNodes.splice(idx, 1);
            child.parentNode = null;
            child.parentElement = null;
            this._updateChildReferences();
            
            Monitor.log('DOM', 'removeChild', {
                parentId: this.__id__,
                childId: child.__id__
            });
            return child;
        },
        
        insertBefore: function(newNode, referenceNode) {
            if (!referenceNode) return this.appendChild(newNode);
            const idx = this.childNodes.indexOf(referenceNode);
            if (idx === -1) {
                throw new DOMException("Failed to execute 'insertBefore': reference node is not a child.", 'NotFoundError');
            }
            if (newNode.parentNode) newNode.parentNode.removeChild(newNode);
            newNode.parentNode = this;
            newNode.parentElement = this.nodeType === 1 ? this : null;
            newNode.ownerDocument = this.ownerDocument;
            this.childNodes.splice(idx, 0, newNode);
            this._updateChildReferences();
            
            Monitor.log('DOM', 'insertBefore', {
                parentId: this.__id__,
                newNodeId: newNode.__id__,
                referenceId: referenceNode.__id__
            });
            return newNode;
        },
        
        replaceChild: function(newChild, oldChild) {
            const idx = this.childNodes.indexOf(oldChild);
            if (idx === -1) {
                throw new DOMException("Failed to execute 'replaceChild': old child is not a child.", 'NotFoundError');
            }
            if (newChild.parentNode) newChild.parentNode.removeChild(newChild);
            newChild.parentNode = this;
            newChild.parentElement = this.nodeType === 1 ? this : null;
            newChild.ownerDocument = this.ownerDocument;
            this.childNodes[idx] = newChild;
            oldChild.parentNode = null;
            oldChild.parentElement = null;
            this._updateChildReferences();
            
            Monitor.log('DOM', 'replaceChild', {
                parentId: this.__id__,
                newChildId: newChild.__id__,
                oldChildId: oldChild.__id__
            });
            return oldChild;
        },
        
        cloneNode: function(deep) {
            Monitor.log('DOM', 'cloneNode', { elementId: this.__id__, deep });
            const clone = Object.create(Object.getPrototypeOf(this));
            Object.assign(clone, this);
            clone.__id__ = generateElementId();
            clone.childNodes = [];
            clone.parentNode = null;
            clone.parentElement = null;
            
            if (deep && this.childNodes.length) {
                this.childNodes.forEach(child => {
                    if (child.cloneNode) {
                        clone.appendChild(child.cloneNode(true));
                    }
                });
            }
            return clone;
        },
        
        contains: function(node) {
            if (node === this) return true;
            for (const child of this.childNodes) {
                if (child === node || (child.contains && child.contains(node))) {
                    return true;
                }
            }
            return false;
        },
        
        hasChildNodes: function() { return this.childNodes.length > 0; },
        
        normalize: function() {},
        
        compareDocumentPosition: function(other) { return 0; },
        
        isEqualNode: function(other) {
            return this.nodeType === other?.nodeType && this.nodeName === other?.nodeName;
        },
        
        isSameNode: function(other) { return this === other; },
        
        _updateChildReferences: function() {
            this.firstChild = this.childNodes[0] || null;
            this.lastChild = this.childNodes[this.childNodes.length - 1] || null;
            
            for (let i = 0; i < this.childNodes.length; i++) {
                const node = this.childNodes[i];
                node.previousSibling = this.childNodes[i - 1] || null;
                node.nextSibling = this.childNodes[i + 1] || null;
            }
        }
    };
    
    // ==================== Element 基类 ====================
    function Element(tagName, namespaceURI) {
        Node.call(this);
        this.tagName = tagName.toUpperCase();
        this.localName = tagName.toLowerCase();
        this.nodeName = this.tagName;
        this.nodeType = 1;
        this.namespaceURI = namespaceURI || 'http://www.w3.org/1999/xhtml';
        this.prefix = null;
        
        // 子元素相关
        this.children = [];
        this.firstElementChild = null;
        this.lastElementChild = null;
        this.childElementCount = 0;
        this.previousElementSibling = null;
        this.nextElementSibling = null;
        
        // 属性
        this.attributes = new NamedNodeMap(this);
        this._attrValues = {};
        
        // 样式和类
        this.style = new CSSStyleDeclaration(this);
        this.classList = new DOMTokenList(this, 'class');
        this.dataset = new DOMStringMap(this);
        
        // 常用属性
        this.id = '';
        this.className = '';
        this.innerHTML = '';
        this.outerHTML = '';
        this.innerText = '';
        
        // 事件
        this._eventListeners = {};
        
        // 尺寸
        this.scrollTop = 0;
        this.scrollLeft = 0;
        this.scrollWidth = 0;
        this.scrollHeight = 0;
        this.clientTop = 0;
        this.clientLeft = 0;
        this.clientWidth = 0;
        this.clientHeight = 0;
        this.offsetTop = 0;
        this.offsetLeft = 0;
        this.offsetWidth = 0;
        this.offsetHeight = 0;
        this.offsetParent = null;
        
        // 存储
        __createdElements__.set(this.__id__, this);
    }
    
    Element.prototype = Object.create(Node.prototype);
    Element.prototype.constructor = Element;
    
    // 属性操作
    Element.prototype.getAttribute = function(name) {
        Monitor.log('Attribute', 'getAttribute', {
            elementId: this.__id__,
            tagName: this.tagName,
            name: name,
            value: this._attrValues[name]
        });
        return this._attrValues[name] !== undefined ? this._attrValues[name] : null;
    };
    
    Element.prototype.setAttribute = function(name, value) {
        const strValue = String(value);
        this._attrValues[name] = strValue;
        this.attributes.setNamedItem(new Attr(name, strValue, this));
        
        if (name === 'id') this.id = strValue;
        if (name === 'class') {
            this.className = strValue;
            this.classList._tokens = strValue.split(/\s+/).filter(Boolean);
        }
        if (name === 'style') this.style.cssText = strValue;
        
        Monitor.log('Attribute', 'setAttribute', {
            elementId: this.__id__,
            tagName: this.tagName,
            name: name,
            value: strValue
        });
    };
    
    Element.prototype.removeAttribute = function(name) {
        delete this._attrValues[name];
        this.attributes.removeNamedItem(name);
        if (name === 'id') this.id = '';
        if (name === 'class') { this.className = ''; this.classList._tokens = []; }
        
        Monitor.log('Attribute', 'removeAttribute', {
            elementId: this.__id__,
            tagName: this.tagName,
            name: name
        });
    };
    
    Element.prototype.hasAttribute = function(name) { return name in this._attrValues; };
    Element.prototype.hasAttributes = function() { return Object.keys(this._attrValues).length > 0; };
    Element.prototype.getAttributeNames = function() { return Object.keys(this._attrValues); };
    Element.prototype.toggleAttribute = function(name, force) {
        if (force !== undefined) {
            if (force) { this.setAttribute(name, ''); return true; }
            else { this.removeAttribute(name); return false; }
        }
        if (this.hasAttribute(name)) { this.removeAttribute(name); return false; }
        this.setAttribute(name, ''); return true;
    };
    
    // 子元素更新
    Element.prototype._updateChildReferences = function() {
        Node.prototype._updateChildReferences.call(this);
        this.children = this.childNodes.filter(n => n.nodeType === 1);
        this.childElementCount = this.children.length;
        this.firstElementChild = this.children[0] || null;
        this.lastElementChild = this.children[this.children.length - 1] || null;
        
        for (let i = 0; i < this.children.length; i++) {
            this.children[i].previousElementSibling = this.children[i - 1] || null;
            this.children[i].nextElementSibling = this.children[i + 1] || null;
        }
    };
    
    // DOM 操作
    Element.prototype.append = function(...nodes) {
        nodes.forEach(node => {
            if (typeof node === 'string') {
                this.appendChild(new Text(node));
            } else {
                this.appendChild(node);
            }
        });
    };
    
    Element.prototype.prepend = function(...nodes) {
        const first = this.firstChild;
        nodes.forEach(node => {
            if (typeof node === 'string') {
                this.insertBefore(new Text(node), first);
            } else {
                this.insertBefore(node, first);
            }
        });
    };
    
    Element.prototype.after = function(...nodes) {
        const parent = this.parentNode;
        if (!parent) return;
        const next = this.nextSibling;
        nodes.forEach(node => {
            if (typeof node === 'string') {
                parent.insertBefore(new Text(node), next);
            } else {
                parent.insertBefore(node, next);
            }
        });
    };
    
    Element.prototype.before = function(...nodes) {
        const parent = this.parentNode;
        if (!parent) return;
        nodes.forEach(node => {
            if (typeof node === 'string') {
                parent.insertBefore(new Text(node), this);
            } else {
                parent.insertBefore(node, this);
            }
        });
    };
    
    Element.prototype.remove = function() {
        if (this.parentNode) this.parentNode.removeChild(this);
    };
    
    Element.prototype.replaceWith = function(...nodes) {
        const parent = this.parentNode;
        if (!parent) return;
        const next = this.nextSibling;
        parent.removeChild(this);
        nodes.forEach(node => {
            if (typeof node === 'string') {
                parent.insertBefore(new Text(node), next);
            } else {
                parent.insertBefore(node, next);
            }
        });
    };
    
    // 查询
    Element.prototype.querySelector = function(selector) {
        Monitor.log('DOM', 'querySelector', { elementId: this.__id__, selector });
        
        const mock = Monitor.executeMock('element.querySelector', [selector], this);
        if (mock.mocked) return mock.result;
        
        return null;
    };
    
    Element.prototype.querySelectorAll = function(selector) {
        Monitor.log('DOM', 'querySelectorAll', { elementId: this.__id__, selector });
        
        const mock = Monitor.executeMock('element.querySelectorAll', [selector], this);
        if (mock.mocked) return mock.result;
        
        return [];
    };
    
    Element.prototype.getElementsByTagName = function(tagName) {
        Monitor.log('DOM', 'getElementsByTagName', { elementId: this.__id__, tagName });
        return [];
    };
    
    Element.prototype.getElementsByClassName = function(className) {
        Monitor.log('DOM', 'getElementsByClassName', { elementId: this.__id__, className });
        return [];
    };
    
    Element.prototype.closest = function(selector) {
        Monitor.log('DOM', 'closest', { elementId: this.__id__, selector });
        return null;
    };
    
    Element.prototype.matches = function(selector) {
        Monitor.log('DOM', 'matches', { elementId: this.__id__, selector });
        return false;
    };
    
    // 几何相关
    Element.prototype.getBoundingClientRect = function() {
        Monitor.log('DOM', 'getBoundingClientRect', { elementId: this.__id__ });
        
        const mock = Monitor.executeMock('element.getBoundingClientRect', [], this);
        if (mock.mocked) return mock.result;
        
        return new DOMRect(0, 0, this.offsetWidth || 100, this.offsetHeight || 100);
    };
    
    Element.prototype.getClientRects = function() {
        Monitor.log('DOM', 'getClientRects', { elementId: this.__id__ });
        return [this.getBoundingClientRect()];
    };
    
    Element.prototype.scrollIntoView = function(options) {
        Monitor.log('DOM', 'scrollIntoView', { elementId: this.__id__, options });
    };
    
    Element.prototype.scroll = function(x, y) { this.scrollTop = y; this.scrollLeft = x; };
    Element.prototype.scrollTo = Element.prototype.scroll;
    Element.prototype.scrollBy = function(x, y) { this.scrollTop += y; this.scrollLeft += x; };
    
    // 焦点
    Element.prototype.focus = function(options) {
        Monitor.log('DOM', 'focus', { elementId: this.__id__ });
    };
    Element.prototype.blur = function() {
        Monitor.log('DOM', 'blur', { elementId: this.__id__ });
    };
    Element.prototype.click = function() {
        Monitor.log('DOM', 'click', { elementId: this.__id__ });
        this.dispatchEvent(new Event('click'));
    };
    
    // 事件
    Element.prototype.addEventListener = function(type, listener, options) {
        if (!this._eventListeners[type]) this._eventListeners[type] = [];
        this._eventListeners[type].push({ listener, options });
        Monitor.log('Event', 'addEventListener', {
            elementId: this.__id__,
            tagName: this.tagName,
            type: type
        });
    };
    
    Element.prototype.removeEventListener = function(type, listener, options) {
        if (this._eventListeners[type]) {
            this._eventListeners[type] = this._eventListeners[type].filter(l => l.listener !== listener);
        }
        Monitor.log('Event', 'removeEventListener', {
            elementId: this.__id__,
            type: type
        });
    };
    
    Element.prototype.dispatchEvent = function(event) {
        event.target = this;
        event.currentTarget = this;
        const listeners = this._eventListeners[event.type] || [];
        listeners.forEach(({ listener }) => {
            if (typeof listener === 'function') {
                listener.call(this, event);
            } else if (listener && typeof listener.handleEvent === 'function') {
                listener.handleEvent(event);
            }
        });
        return !event.defaultPrevented;
    };
    
    // 其他
    Element.prototype.insertAdjacentHTML = function(position, html) {
        Monitor.log('DOM', 'insertAdjacentHTML', { elementId: this.__id__, position, html: html?.substring(0, 100) });
    };
    Element.prototype.insertAdjacentElement = function(position, element) {
        Monitor.log('DOM', 'insertAdjacentElement', { elementId: this.__id__, position });
        return element;
    };
    Element.prototype.insertAdjacentText = function(position, text) {
        Monitor.log('DOM', 'insertAdjacentText', { elementId: this.__id__, position });
    };
    Element.prototype.attachShadow = function(options) {
        Monitor.log('DOM', 'attachShadow', { elementId: this.__id__, options });
        return { mode: options?.mode || 'open', host: this };
    };
    Element.prototype.animate = function(keyframes, options) {
        Monitor.log('DOM', 'animate', { elementId: this.__id__ });
        return { cancel: function() {}, play: function() {}, pause: function() {} };
    };
    Element.prototype.getAnimations = function() { return []; };
    Element.prototype.requestFullscreen = function() { return Promise.resolve(); };
    
    // ==================== HTMLElement ====================
    function HTMLElement(tagName) {
        Element.call(this, tagName || 'div');
        this.title = '';
        this.lang = '';
        this.dir = '';
        this.hidden = false;
        this.tabIndex = -1;
        this.accessKey = '';
        this.draggable = false;
        this.spellcheck = true;
        this.contentEditable = 'inherit';
        this.isContentEditable = false;
        this.translate = true;
        this.autocapitalize = '';
        this.inputMode = '';
        this.enterKeyHint = '';
    }
    HTMLElement.prototype = Object.create(Element.prototype);
    HTMLElement.prototype.constructor = HTMLElement;
    
    // ==================== 具体 HTML 元素类型 ====================
    
    // HTMLDivElement
    function HTMLDivElement() {
        HTMLElement.call(this, 'div');
        this.align = '';
    }
    HTMLDivElement.prototype = Object.create(HTMLElement.prototype);
    HTMLDivElement.prototype.constructor = HTMLDivElement;
    
    // HTMLSpanElement
    function HTMLSpanElement() {
        HTMLElement.call(this, 'span');
    }
    HTMLSpanElement.prototype = Object.create(HTMLElement.prototype);
    HTMLSpanElement.prototype.constructor = HTMLSpanElement;
    
    // HTMLParagraphElement
    function HTMLParagraphElement() {
        HTMLElement.call(this, 'p');
        this.align = '';
    }
    HTMLParagraphElement.prototype = Object.create(HTMLElement.prototype);
    HTMLParagraphElement.prototype.constructor = HTMLParagraphElement;
    
    // HTMLHeadingElement (h1-h6)
    function HTMLHeadingElement(level) {
        HTMLElement.call(this, 'h' + (level || 1));
        this.align = '';
    }
    HTMLHeadingElement.prototype = Object.create(HTMLElement.prototype);
    HTMLHeadingElement.prototype.constructor = HTMLHeadingElement;
    
    // HTMLBRElement
    function HTMLBRElement() {
        HTMLElement.call(this, 'br');
        this.clear = '';
    }
    HTMLBRElement.prototype = Object.create(HTMLElement.prototype);
    HTMLBRElement.prototype.constructor = HTMLBRElement;
    
    // HTMLHRElement
    function HTMLHRElement() {
        HTMLElement.call(this, 'hr');
        this.align = '';
        this.color = '';
        this.noShade = false;
        this.size = '';
        this.width = '';
    }
    HTMLHRElement.prototype = Object.create(HTMLElement.prototype);
    HTMLHRElement.prototype.constructor = HTMLHRElement;
    
    // HTMLPreElement
    function HTMLPreElement() {
        HTMLElement.call(this, 'pre');
        this.width = 0;
    }
    HTMLPreElement.prototype = Object.create(HTMLElement.prototype);
    HTMLPreElement.prototype.constructor = HTMLPreElement;
    
    // HTMLScriptElement
    function HTMLScriptElement() {
        HTMLElement.call(this, 'script');
        this.src = '';
        this.type = '';
        this.charset = '';
        this.async = false;
        this.defer = false;
        this.crossOrigin = null;
        this.text = '';
        this.noModule = false;
        this.integrity = '';
        this.referrerPolicy = '';
    }
    HTMLScriptElement.prototype = Object.create(HTMLElement.prototype);
    HTMLScriptElement.prototype.constructor = HTMLScriptElement;
    
    // HTMLCanvasElement
    function HTMLCanvasElement() {
        HTMLElement.call(this, 'canvas');
        this.width = 300;
        this.height = 150;
        this._contexts = {};
    }
    HTMLCanvasElement.prototype = Object.create(HTMLElement.prototype);
    HTMLCanvasElement.prototype.constructor = HTMLCanvasElement;
    
    HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
        Monitor.pushChain('canvas.getContext');
        Monitor.log('Canvas', 'getContext', {
            elementId: this.__id__,
            contextType: contextType,
            attributes: contextAttributes
        });
        
        // 检查 mock
        const mock = Monitor.executeMock('canvas.getContext', [contextType, contextAttributes], this);
        if (mock.mocked) {
            Monitor.popChain();
            return mock.result;
        }
        
        if (this._contexts[contextType]) {
            Monitor.popChain();
            return this._contexts[contextType];
        }
        
        let ctx;
        if (contextType === '2d') {
            ctx = new CanvasRenderingContext2D(this);
        } else if (contextType === 'webgl' || contextType === 'webgl2' || contextType === 'experimental-webgl') {
            ctx = new WebGLRenderingContext(this, contextType);
        } else {
            ctx = null;
        }
        
        this._contexts[contextType] = ctx;
        Monitor.popChain();
        return ctx;
    };
    
    HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
        Monitor.log('Canvas', 'toDataURL', { elementId: this.__id__, type, quality });
        
        const mock = Monitor.executeMock('canvas.toDataURL', [type, quality], this);
        if (mock.mocked) return mock.result;
        
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    };
    
    HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
        Monitor.log('Canvas', 'toBlob', { elementId: this.__id__, type, quality });
        if (callback) {
            setTimeout(() => callback(new Blob([''], { type: type || 'image/png' })), 0);
        }
    };
    
    HTMLCanvasElement.prototype.captureStream = function(frameRate) {
        Monitor.log('Canvas', 'captureStream', { elementId: this.__id__, frameRate });
        return { getTracks: () => [], getVideoTracks: () => [], getAudioTracks: () => [] };
    };
    
    HTMLCanvasElement.prototype.transferControlToOffscreen = function() {
        Monitor.log('Canvas', 'transferControlToOffscreen', { elementId: this.__id__ });
        return new OffscreenCanvas(this.width, this.height);
    };
    
    // OffscreenCanvas
    function OffscreenCanvas(width, height) {
        this.width = width || 300;
        this.height = height || 150;
        this._contexts = {};
    }
    OffscreenCanvas.prototype.getContext = function(type, attrs) {
        Monitor.log('OffscreenCanvas', 'getContext', { type });
        if (type === '2d') {
            return new CanvasRenderingContext2D({ width: this.width, height: this.height });
        }
        return null;
    };
    OffscreenCanvas.prototype.convertToBlob = function(options) {
        return Promise.resolve(new Blob([''], { type: options?.type || 'image/png' }));
    };
    OffscreenCanvas.prototype.transferToImageBitmap = function() {
        return { width: this.width, height: this.height, close: function() {} };
    };
    window.OffscreenCanvas = OffscreenCanvas;
    
    // CanvasRenderingContext2D
    function CanvasRenderingContext2D(canvas) {
        this.canvas = canvas;
        
        // 状态
        this.fillStyle = '#000000';
        this.strokeStyle = '#000000';
        this.lineWidth = 1;
        this.lineCap = 'butt';
        this.lineJoin = 'miter';
        this.miterLimit = 10;
        this.lineDashOffset = 0;
        this.font = '10px sans-serif';
        this.textAlign = 'start';
        this.textBaseline = 'alphabetic';
        this.direction = 'ltr';
        this.globalAlpha = 1;
        this.globalCompositeOperation = 'source-over';
        this.shadowBlur = 0;
        this.shadowColor = 'rgba(0, 0, 0, 0)';
        this.shadowOffsetX = 0;
        this.shadowOffsetY = 0;
        this.imageSmoothingEnabled = true;
        this.imageSmoothingQuality = 'low';
        this.filter = 'none';
        
        this._stack = [];
    }
    
    CanvasRenderingContext2D.prototype = {
        // 路径
        beginPath: function() { Monitor.log('Canvas2D', 'beginPath', {}); },
        closePath: function() { Monitor.log('Canvas2D', 'closePath', {}); },
        moveTo: function(x, y) { Monitor.log('Canvas2D', 'moveTo', { x, y }); },
        lineTo: function(x, y) { Monitor.log('Canvas2D', 'lineTo', { x, y }); },
        bezierCurveTo: function(cp1x, cp1y, cp2x, cp2y, x, y) {},
        quadraticCurveTo: function(cpx, cpy, x, y) {},
        arc: function(x, y, radius, startAngle, endAngle, anticlockwise) {},
        arcTo: function(x1, y1, x2, y2, radius) {},
        ellipse: function(x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise) {},
        rect: function(x, y, width, height) {},
        roundRect: function(x, y, w, h, radii) {},
        
        // 绘制
        fill: function(fillRule) { Monitor.log('Canvas2D', 'fill', { fillRule }); },
        stroke: function() { Monitor.log('Canvas2D', 'stroke', {}); },
        clip: function(fillRule) {},
        isPointInPath: function(x, y, fillRule) { return false; },
        isPointInStroke: function(x, y) { return false; },
        
        // 矩形
        fillRect: function(x, y, width, height) {
            Monitor.log('Canvas2D', 'fillRect', { x, y, width, height });
        },
        strokeRect: function(x, y, width, height) {
            Monitor.log('Canvas2D', 'strokeRect', { x, y, width, height });
        },
        clearRect: function(x, y, width, height) {
            Monitor.log('Canvas2D', 'clearRect', { x, y, width, height });
        },
        
        // 文本
        fillText: function(text, x, y, maxWidth) {
            Monitor.log('Canvas2D', 'fillText', { text, x, y, maxWidth });
        },
        strokeText: function(text, x, y, maxWidth) {
            Monitor.log('Canvas2D', 'strokeText', { text, x, y, maxWidth });
        },
        measureText: function(text) {
            Monitor.log('Canvas2D', 'measureText', { text });
            return {
                width: text.length * 10,
                actualBoundingBoxLeft: 0,
                actualBoundingBoxRight: text.length * 10,
                actualBoundingBoxAscent: 10,
                actualBoundingBoxDescent: 2,
                fontBoundingBoxAscent: 12,
                fontBoundingBoxDescent: 3,
                emHeightAscent: 10,
                emHeightDescent: 2,
                hangingBaseline: 9,
                alphabeticBaseline: 0,
                ideographicBaseline: -2
            };
        },
        
        // 图像
        drawImage: function(image, ...args) {
            Monitor.log('Canvas2D', 'drawImage', { args });
        },
        createImageData: function(width, height) {
            const data = new Uint8ClampedArray(width * height * 4);
            return { width, height, data, colorSpace: 'srgb' };
        },
        getImageData: function(x, y, width, height, settings) {
            Monitor.log('Canvas2D', 'getImageData', { x, y, width, height });
            
            const mock = Monitor.executeMock('canvas2d.getImageData', [x, y, width, height], this);
            if (mock.mocked) return mock.result;
            
            const data = new Uint8ClampedArray(width * height * 4);
            return { width, height, data, colorSpace: 'srgb' };
        },
        putImageData: function(imageData, dx, dy, ...args) {
            Monitor.log('Canvas2D', 'putImageData', { dx, dy });
        },
        
        // 渐变和图案
        createLinearGradient: function(x0, y0, x1, y1) {
            return {
                addColorStop: function(offset, color) {}
            };
        },
        createRadialGradient: function(x0, y0, r0, x1, y1, r1) {
            return {
                addColorStop: function(offset, color) {}
            };
        },
        createConicGradient: function(startAngle, x, y) {
            return {
                addColorStop: function(offset, color) {}
            };
        },
        createPattern: function(image, repetition) { return {}; },
        
        // 变换
        scale: function(x, y) {},
        rotate: function(angle) {},
        translate: function(x, y) {},
        transform: function(a, b, c, d, e, f) {},
        setTransform: function(a, b, c, d, e, f) {},
        getTransform: function() {
            return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
        },
        resetTransform: function() {},
        
        // 状态
        save: function() { this._stack.push({}); },
        restore: function() { this._stack.pop(); },
        reset: function() {},
        
        // 其他
        setLineDash: function(segments) {},
        getLineDash: function() { return []; },
        createPath2D: function() { return new Path2D(); }
    };
    window.CanvasRenderingContext2D = CanvasRenderingContext2D;
    
    // Path2D
    function Path2D(path) {
        this._path = path || '';
    }
    Path2D.prototype = {
        addPath: function(path, transform) {},
        closePath: function() {},
        moveTo: function(x, y) {},
        lineTo: function(x, y) {},
        bezierCurveTo: function(cp1x, cp1y, cp2x, cp2y, x, y) {},
        quadraticCurveTo: function(cpx, cpy, x, y) {},
        arc: function(x, y, radius, startAngle, endAngle, anticlockwise) {},
        arcTo: function(x1, y1, x2, y2, radius) {},
        ellipse: function(x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise) {},
        rect: function(x, y, width, height) {},
        roundRect: function(x, y, w, h, radii) {}
    };
    window.Path2D = Path2D;
    
    // WebGLRenderingContext (简化版)
    function WebGLRenderingContext(canvas, contextType) {
        this.canvas = canvas;
        this.contextType = contextType;
        this.drawingBufferWidth = canvas.width;
        this.drawingBufferHeight = canvas.height;
        
        // WebGL 常量
        this.DEPTH_BUFFER_BIT = 0x00000100;
        this.STENCIL_BUFFER_BIT = 0x00000400;
        this.COLOR_BUFFER_BIT = 0x00004000;
        this.POINTS = 0x0000;
        this.LINES = 0x0001;
        this.TRIANGLES = 0x0004;
        this.VERTEX_SHADER = 0x8B31;
        this.FRAGMENT_SHADER = 0x8B30;
        this.ARRAY_BUFFER = 0x8892;
        this.ELEMENT_ARRAY_BUFFER = 0x8893;
        this.FLOAT = 0x1406;
        this.RGBA = 0x1908;
        this.UNSIGNED_BYTE = 0x1401;
        this.TEXTURE_2D = 0x0DE1;
        this.TEXTURE0 = 0x84C0;
        this.COMPILE_STATUS = 0x8B81;
        this.LINK_STATUS = 0x8B82;
    }
    
    WebGLRenderingContext.prototype = {
        getExtension: function(name) {
            Monitor.log('WebGL', 'getExtension', { name });
            return null;
        },
        getSupportedExtensions: function() { return []; },
        getParameter: function(pname) {
            Monitor.log('WebGL', 'getParameter', { pname });
            
            const mock = Monitor.executeMock('webgl.getParameter', [pname], this);
            if (mock.mocked) return mock.result;
            
            return null;
        },
        getShaderPrecisionFormat: function(shadertype, precisiontype) {
            return { rangeMin: 127, rangeMax: 127, precision: 23 };
        },
        createShader: function(type) { return { _type: type }; },
        shaderSource: function(shader, source) { shader._source = source; },
        compileShader: function(shader) { shader._compiled = true; },
        getShaderParameter: function(shader, pname) { return pname === this.COMPILE_STATUS; },
        getShaderInfoLog: function(shader) { return ''; },
        createProgram: function() { return { _shaders: [] }; },
        attachShader: function(program, shader) { program._shaders.push(shader); },
        linkProgram: function(program) { program._linked = true; },
        getProgramParameter: function(program, pname) { return pname === this.LINK_STATUS; },
        getProgramInfoLog: function(program) { return ''; },
        useProgram: function(program) {},
        deleteShader: function(shader) {},
        deleteProgram: function(program) {},
        createBuffer: function() { return {}; },
        bindBuffer: function(target, buffer) {},
        bufferData: function(target, data, usage) {},
        deleteBuffer: function(buffer) {},
        createTexture: function() { return {}; },
        bindTexture: function(target, texture) {},
        texImage2D: function(...args) {},
        texParameteri: function(target, pname, param) {},
        deleteTexture: function(texture) {},
        activeTexture: function(texture) {},
        createFramebuffer: function() { return {}; },
        bindFramebuffer: function(target, framebuffer) {},
        framebufferTexture2D: function(...args) {},
        deleteFramebuffer: function(framebuffer) {},
        getUniformLocation: function(program, name) { return { _name: name }; },
        getAttribLocation: function(program, name) { return 0; },
        uniform1f: function(location, x) {},
        uniform2f: function(location, x, y) {},
        uniform3f: function(location, x, y, z) {},
        uniform4f: function(location, x, y, z, w) {},
        uniform1i: function(location, x) {},
        uniformMatrix4fv: function(location, transpose, value) {},
        vertexAttribPointer: function(...args) {},
        enableVertexAttribArray: function(index) {},
        disableVertexAttribArray: function(index) {},
        viewport: function(x, y, width, height) {},
        clear: function(mask) {},
        clearColor: function(red, green, blue, alpha) {},
        clearDepth: function(depth) {},
        clearStencil: function(s) {},
        enable: function(cap) {},
        disable: function(cap) {},
        blendFunc: function(sfactor, dfactor) {},
        depthFunc: function(func) {},
        cullFace: function(mode) {},
        drawArrays: function(mode, first, count) {},
        drawElements: function(mode, count, type, offset) {},
        flush: function() {},
        finish: function() {},
        readPixels: function(x, y, width, height, format, type, pixels) {
            Monitor.log('WebGL', 'readPixels', { x, y, width, height });
        },
        getContextAttributes: function() {
            return {
                alpha: true,
                antialias: true,
                depth: true,
                failIfMajorPerformanceCaveat: false,
                powerPreference: 'default',
                premultipliedAlpha: true,
                preserveDrawingBuffer: false,
                stencil: false
            };
        },
        isContextLost: function() { return false; }
    };
    window.WebGLRenderingContext = WebGLRenderingContext;
    
    // HTMLImageElement
    function HTMLImageElement() {
        HTMLElement.call(this, 'img');
        this.src = '';
        this.alt = '';
        this.srcset = '';
        this.sizes = '';
        this.crossOrigin = null;
        this.useMap = '';
        this.isMap = false;
        this.width = 0;
        this.height = 0;
        this.naturalWidth = 0;
        this.naturalHeight = 0;
        this.complete = false;
        this.currentSrc = '';
        this.referrerPolicy = '';
        this.decoding = 'auto';
        this.loading = 'eager';
        this.fetchPriority = 'auto';
        
        // 模拟图片加载
        const self = this;
        Object.defineProperty(this, 'src', {
            get: function() { return this._src || ''; },
            set: function(val) {
                this._src = val;
                this.currentSrc = val;
                Monitor.log('Image', 'setSrc', { elementId: self.__id__, src: val });
                // 模拟异步加载完成
                setTimeout(() => {
                    self.complete = true;
                    self.naturalWidth = 100;
                    self.naturalHeight = 100;
                    if (self.onload) self.onload.call(self, new Event('load'));
                }, 0);
            }
        });
    }
    HTMLImageElement.prototype = Object.create(HTMLElement.prototype);
    HTMLImageElement.prototype.constructor = HTMLImageElement;
    HTMLImageElement.prototype.decode = function() {
        Monitor.log('Image', 'decode', { elementId: this.__id__ });
        return Promise.resolve();
    };
    
    // Image 构造函数
    window.Image = function(width, height) {
        const img = new HTMLImageElement();
        if (width !== undefined) img.width = width;
        if (height !== undefined) img.height = height;
        return img;
    };
    
    // HTMLInputElement
    function HTMLInputElement() {
        HTMLElement.call(this, 'input');
        this.type = 'text';
        this.value = '';
        this.defaultValue = '';
        this.checked = false;
        this.defaultChecked = false;
        this.name = '';
        this.disabled = false;
        this.readOnly = false;
        this.required = false;
        this.placeholder = '';
        this.autocomplete = '';
        this.autofocus = false;
        this.min = '';
        this.max = '';
        this.step = '';
        this.pattern = '';
        this.size = 20;
        this.maxLength = -1;
        this.minLength = -1;
        this.multiple = false;
        this.files = null;
        this.form = null;
        this.accept = '';
        this.capture = '';
        this.src = '';
        this.alt = '';
        this.width = 0;
        this.height = 0;
        this.indeterminate = false;
        this.list = null;
        this.validity = {
            valid: true, valueMissing: false, typeMismatch: false,
            patternMismatch: false, tooLong: false, tooShort: false,
            rangeUnderflow: false, rangeOverflow: false, stepMismatch: false,
            badInput: false, customError: false
        };
        this.validationMessage = '';
        this.willValidate = true;
        this.selectionStart = 0;
        this.selectionEnd = 0;
        this.selectionDirection = 'forward';
    }
    HTMLInputElement.prototype = Object.create(HTMLElement.prototype);
    HTMLInputElement.prototype.constructor = HTMLInputElement;
    HTMLInputElement.prototype.select = function() {};
    HTMLInputElement.prototype.setSelectionRange = function(start, end, direction) {
        this.selectionStart = start;
        this.selectionEnd = end;
        this.selectionDirection = direction || 'none';
    };
    HTMLInputElement.prototype.setRangeText = function(replacement, start, end, selectMode) {};
    HTMLInputElement.prototype.stepUp = function(n) {};
    HTMLInputElement.prototype.stepDown = function(n) {};
    HTMLInputElement.prototype.checkValidity = function() { return this.validity.valid; };
    HTMLInputElement.prototype.reportValidity = function() { return this.validity.valid; };
    HTMLInputElement.prototype.setCustomValidity = function(message) {
        this.validationMessage = message;
        this.validity.customError = !!message;
        this.validity.valid = !message;
    };
    
    // HTMLButtonElement
    function HTMLButtonElement() {
        HTMLElement.call(this, 'button');
        this.type = 'submit';
        this.value = '';
        this.name = '';
        this.disabled = false;
        this.autofocus = false;
        this.form = null;
        this.formAction = '';
        this.formEnctype = '';
        this.formMethod = '';
        this.formNoValidate = false;
        this.formTarget = '';
        this.validity = { valid: true };
        this.validationMessage = '';
        this.willValidate = true;
        this.labels = [];
    }
    HTMLButtonElement.prototype = Object.create(HTMLElement.prototype);
    HTMLButtonElement.prototype.constructor = HTMLButtonElement;
    HTMLButtonElement.prototype.checkValidity = function() { return true; };
    HTMLButtonElement.prototype.reportValidity = function() { return true; };
    HTMLButtonElement.prototype.setCustomValidity = function(message) {};
    
    // HTMLTextAreaElement
    function HTMLTextAreaElement() {
        HTMLElement.call(this, 'textarea');
        this.value = '';
        this.defaultValue = '';
        this.name = '';
        this.disabled = false;
        this.readOnly = false;
        this.required = false;
        this.placeholder = '';
        this.autocomplete = '';
        this.autofocus = false;
        this.cols = 20;
        this.rows = 2;
        this.wrap = 'soft';
        this.maxLength = -1;
        this.minLength = -1;
        this.form = null;
        this.textLength = 0;
        this.validity = { valid: true };
        this.validationMessage = '';
        this.willValidate = true;
        this.selectionStart = 0;
        this.selectionEnd = 0;
        this.selectionDirection = 'forward';
    }
    HTMLTextAreaElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTextAreaElement.prototype.constructor = HTMLTextAreaElement;
    HTMLTextAreaElement.prototype.select = function() {};
    HTMLTextAreaElement.prototype.setSelectionRange = function(start, end, direction) {
        this.selectionStart = start;
        this.selectionEnd = end;
        this.selectionDirection = direction || 'none';
    };
    HTMLTextAreaElement.prototype.setRangeText = function(replacement, start, end, selectMode) {};
    HTMLTextAreaElement.prototype.checkValidity = function() { return true; };
    HTMLTextAreaElement.prototype.reportValidity = function() { return true; };
    HTMLTextAreaElement.prototype.setCustomValidity = function(message) {};
    
    // HTMLSelectElement
    function HTMLSelectElement() {
        HTMLElement.call(this, 'select');
        this.name = '';
        this.value = '';
        this.disabled = false;
        this.required = false;
        this.autofocus = false;
        this.multiple = false;
        this.size = 0;
        this.form = null;
        this.options = [];
        this.selectedOptions = [];
        this.selectedIndex = -1;
        this.length = 0;
        this.type = 'select-one';
        this.validity = { valid: true };
        this.validationMessage = '';
        this.willValidate = true;
        this.labels = [];
    }
    HTMLSelectElement.prototype = Object.create(HTMLElement.prototype);
    HTMLSelectElement.prototype.constructor = HTMLSelectElement;
    HTMLSelectElement.prototype.add = function(element, before) {};
    HTMLSelectElement.prototype.remove = function(index) {};
    HTMLSelectElement.prototype.item = function(index) { return this.options[index] || null; };
    HTMLSelectElement.prototype.namedItem = function(name) { return null; };
    HTMLSelectElement.prototype.checkValidity = function() { return true; };
    HTMLSelectElement.prototype.reportValidity = function() { return true; };
    HTMLSelectElement.prototype.setCustomValidity = function(message) {};
    
    // HTMLOptionElement
    function HTMLOptionElement() {
        HTMLElement.call(this, 'option');
        this.value = '';
        this.text = '';
        this.label = '';
        this.disabled = false;
        this.defaultSelected = false;
        this.selected = false;
        this.index = 0;
        this.form = null;
    }
    HTMLOptionElement.prototype = Object.create(HTMLElement.prototype);
    HTMLOptionElement.prototype.constructor = HTMLOptionElement;
    
    // Option 构造函数
    window.Option = function(text, value, defaultSelected, selected) {
        const opt = new HTMLOptionElement();
        if (text !== undefined) opt.text = text;
        if (value !== undefined) opt.value = value;
        if (defaultSelected !== undefined) opt.defaultSelected = defaultSelected;
        if (selected !== undefined) opt.selected = selected;
        return opt;
    };
    
    // HTMLAnchorElement
    function HTMLAnchorElement() {
        HTMLElement.call(this, 'a');
        this.href = '';
        this.target = '';
        this.rel = '';
        this.download = '';
        this.hreflang = '';
        this.type = '';
        this.text = '';
        this.referrerPolicy = '';
        this.origin = '';
        this.protocol = '';
        this.host = '';
        this.hostname = '';
        this.port = '';
        this.pathname = '';
        this.search = '';
        this.hash = '';
        this.ping = '';
    }
    HTMLAnchorElement.prototype = Object.create(HTMLElement.prototype);
    HTMLAnchorElement.prototype.constructor = HTMLAnchorElement;
    HTMLAnchorElement.prototype.toString = function() { return this.href; };
    
    // HTMLFormElement
    function HTMLFormElement() {
        HTMLElement.call(this, 'form');
        this.action = '';
        this.method = 'get';
        this.enctype = 'application/x-www-form-urlencoded';
        this.encoding = 'application/x-www-form-urlencoded';
        this.target = '';
        this.acceptCharset = '';
        this.autocomplete = 'on';
        this.noValidate = false;
        this.name = '';
        this.elements = [];
        this.length = 0;
    }
    HTMLFormElement.prototype = Object.create(HTMLElement.prototype);
    HTMLFormElement.prototype.constructor = HTMLFormElement;
    HTMLFormElement.prototype.submit = function() {
        Monitor.log('Form', 'submit', { elementId: this.__id__, action: this.action });
    };
    HTMLFormElement.prototype.reset = function() {
        Monitor.log('Form', 'reset', { elementId: this.__id__ });
    };
    HTMLFormElement.prototype.requestSubmit = function(submitter) {
        this.submit();
    };
    HTMLFormElement.prototype.checkValidity = function() { return true; };
    HTMLFormElement.prototype.reportValidity = function() { return true; };
    
    // HTMLIFrameElement
    function HTMLIFrameElement() {
        HTMLElement.call(this, 'iframe');
        this.src = '';
        this.srcdoc = '';
        this.name = '';
        this.sandbox = '';
        this.allow = '';
        this.allowFullscreen = false;
        this.width = '';
        this.height = '';
        this.referrerPolicy = '';
        this.loading = 'eager';
        this.contentDocument = null;
        this.contentWindow = null;
    }
    HTMLIFrameElement.prototype = Object.create(HTMLElement.prototype);
    HTMLIFrameElement.prototype.constructor = HTMLIFrameElement;
    
    // HTMLVideoElement
    function HTMLVideoElement() {
        HTMLElement.call(this, 'video');
        this.src = '';
        this.currentSrc = '';
        this.poster = '';
        this.width = 0;
        this.height = 0;
        this.videoWidth = 0;
        this.videoHeight = 0;
        this.autoplay = false;
        this.controls = false;
        this.loop = false;
        this.muted = false;
        this.defaultMuted = false;
        this.preload = 'auto';
        this.currentTime = 0;
        this.duration = NaN;
        this.paused = true;
        this.ended = false;
        this.volume = 1;
        this.playbackRate = 1;
        this.defaultPlaybackRate = 1;
        this.readyState = 0;
        this.networkState = 0;
        this.buffered = { length: 0, start: () => 0, end: () => 0 };
        this.played = { length: 0, start: () => 0, end: () => 0 };
        this.seekable = { length: 0, start: () => 0, end: () => 0 };
        this.seeking = false;
        this.error = null;
        this.crossOrigin = null;
        this.playsInline = false;
        this.disablePictureInPicture = false;
        this.textTracks = [];
        this.mediaKeys = null;
    }
    HTMLVideoElement.prototype = Object.create(HTMLElement.prototype);
    HTMLVideoElement.prototype.constructor = HTMLVideoElement;
    HTMLVideoElement.prototype.play = function() {
        Monitor.log('Video', 'play', { elementId: this.__id__ });
        this.paused = false;
        return Promise.resolve();
    };
    HTMLVideoElement.prototype.pause = function() {
        Monitor.log('Video', 'pause', { elementId: this.__id__ });
        this.paused = true;
    };
    HTMLVideoElement.prototype.load = function() {
        Monitor.log('Video', 'load', { elementId: this.__id__ });
    };
    HTMLVideoElement.prototype.canPlayType = function(type) {
        Monitor.log('Video', 'canPlayType', { type });
        return 'maybe';
    };
    HTMLVideoElement.prototype.captureStream = function() {
        return { getTracks: () => [], getVideoTracks: () => [], getAudioTracks: () => [] };
    };
    HTMLVideoElement.prototype.requestPictureInPicture = function() {
        return Promise.resolve({});
    };
    HTMLVideoElement.prototype.getVideoPlaybackQuality = function() {
        return { creationTime: 0, totalVideoFrames: 0, droppedVideoFrames: 0 };
    };
    HTMLVideoElement.prototype.addTextTrack = function(kind, label, language) {
        return { kind, label, language };
    };
    HTMLVideoElement.prototype.setMediaKeys = function(mediaKeys) {
        this.mediaKeys = mediaKeys;
        return Promise.resolve();
    };
    
    // HTMLAudioElement
    function HTMLAudioElement() {
        HTMLVideoElement.call(this);
        this.tagName = 'AUDIO';
        this.localName = 'audio';
        this.nodeName = 'AUDIO';
    }
    HTMLAudioElement.prototype = Object.create(HTMLVideoElement.prototype);
    HTMLAudioElement.prototype.constructor = HTMLAudioElement;
    
    // Audio 构造函数
    window.Audio = function(src) {
        const audio = new HTMLAudioElement();
        if (src) audio.src = src;
        return audio;
    };
    
    // HTMLStyleElement
    function HTMLStyleElement() {
        HTMLElement.call(this, 'style');
        this.type = 'text/css';
        this.media = '';
        this.disabled = false;
        this.sheet = null;
    }
    HTMLStyleElement.prototype = Object.create(HTMLElement.prototype);
    HTMLStyleElement.prototype.constructor = HTMLStyleElement;
    
    // HTMLLinkElement
    function HTMLLinkElement() {
        HTMLElement.call(this, 'link');
        this.href = '';
        this.rel = '';
        this.type = '';
        this.media = '';
        this.crossOrigin = null;
        this.referrerPolicy = '';
        this.as = '';
        this.disabled = false;
        this.sheet = null;
        this.integrity = '';
    }
    HTMLLinkElement.prototype = Object.create(HTMLElement.prototype);
    HTMLLinkElement.prototype.constructor = HTMLLinkElement;
    
    // HTMLMetaElement
    function HTMLMetaElement() {
        HTMLElement.call(this, 'meta');
        this.content = '';
        this.httpEquiv = '';
        this.name = '';
        this.charset = '';
    }
    HTMLMetaElement.prototype = Object.create(HTMLElement.prototype);
    HTMLMetaElement.prototype.constructor = HTMLMetaElement;
    
    // HTMLTitleElement
    function HTMLTitleElement() {
        HTMLElement.call(this, 'title');
        this.text = '';
    }
    HTMLTitleElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTitleElement.prototype.constructor = HTMLTitleElement;
    
    // HTMLBaseElement
    function HTMLBaseElement() {
        HTMLElement.call(this, 'base');
        this.href = '';
        this.target = '';
    }
    HTMLBaseElement.prototype = Object.create(HTMLElement.prototype);
    HTMLBaseElement.prototype.constructor = HTMLBaseElement;
    
    // HTMLHeadElement
    function HTMLHeadElement() {
        HTMLElement.call(this, 'head');
    }
    HTMLHeadElement.prototype = Object.create(HTMLElement.prototype);
    HTMLHeadElement.prototype.constructor = HTMLHeadElement;
    
    // HTMLBodyElement
    function HTMLBodyElement() {
        HTMLElement.call(this, 'body');
        this.aLink = '';
        this.background = '';
        this.bgColor = '';
        this.link = '';
        this.text = '';
        this.vLink = '';
    }
    HTMLBodyElement.prototype = Object.create(HTMLElement.prototype);
    HTMLBodyElement.prototype.constructor = HTMLBodyElement;
    
    // HTMLHtmlElement
    function HTMLHtmlElement() {
        HTMLElement.call(this, 'html');
        this.version = '';
    }
    HTMLHtmlElement.prototype = Object.create(HTMLElement.prototype);
    HTMLHtmlElement.prototype.constructor = HTMLHtmlElement;
    
    // HTMLTableElement
    function HTMLTableElement() {
        HTMLElement.call(this, 'table');
        this.caption = null;
        this.tHead = null;
        this.tFoot = null;
        this.tBodies = [];
        this.rows = [];
        this.align = '';
        this.bgColor = '';
        this.border = '';
        this.cellPadding = '';
        this.cellSpacing = '';
        this.frame = '';
        this.rules = '';
        this.summary = '';
        this.width = '';
    }
    HTMLTableElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTableElement.prototype.constructor = HTMLTableElement;
    HTMLTableElement.prototype.createCaption = function() { return new HTMLTableCaptionElement(); };
    HTMLTableElement.prototype.deleteCaption = function() { this.caption = null; };
    HTMLTableElement.prototype.createTHead = function() { return new HTMLTableSectionElement('thead'); };
    HTMLTableElement.prototype.deleteTHead = function() { this.tHead = null; };
    HTMLTableElement.prototype.createTFoot = function() { return new HTMLTableSectionElement('tfoot'); };
    HTMLTableElement.prototype.deleteTFoot = function() { this.tFoot = null; };
    HTMLTableElement.prototype.createTBody = function() { return new HTMLTableSectionElement('tbody'); };
    HTMLTableElement.prototype.insertRow = function(index) { return new HTMLTableRowElement(); };
    HTMLTableElement.prototype.deleteRow = function(index) {};
    
    // HTMLTableSectionElement (thead, tbody, tfoot)
    function HTMLTableSectionElement(tagName) {
        HTMLElement.call(this, tagName || 'tbody');
        this.rows = [];
        this.align = '';
        this.ch = '';
        this.chOff = '';
        this.vAlign = '';
    }
    HTMLTableSectionElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTableSectionElement.prototype.constructor = HTMLTableSectionElement;
    HTMLTableSectionElement.prototype.insertRow = function(index) { return new HTMLTableRowElement(); };
    HTMLTableSectionElement.prototype.deleteRow = function(index) {};
    
    // HTMLTableRowElement
    function HTMLTableRowElement() {
        HTMLElement.call(this, 'tr');
        this.cells = [];
        this.rowIndex = -1;
        this.sectionRowIndex = -1;
        this.align = '';
        this.bgColor = '';
        this.ch = '';
        this.chOff = '';
        this.vAlign = '';
    }
    HTMLTableRowElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTableRowElement.prototype.constructor = HTMLTableRowElement;
    HTMLTableRowElement.prototype.insertCell = function(index) { return new HTMLTableCellElement(); };
    HTMLTableRowElement.prototype.deleteCell = function(index) {};
    
    // HTMLTableCellElement (td, th)
    function HTMLTableCellElement(tagName) {
        HTMLElement.call(this, tagName || 'td');
        this.colSpan = 1;
        this.rowSpan = 1;
        this.headers = '';
        this.cellIndex = -1;
        this.abbr = '';
        this.align = '';
        this.axis = '';
        this.bgColor = '';
        this.ch = '';
        this.chOff = '';
        this.height = '';
        this.noWrap = false;
        this.scope = '';
        this.vAlign = '';
        this.width = '';
    }
    HTMLTableCellElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTableCellElement.prototype.constructor = HTMLTableCellElement;
    
    // HTMLTableCaptionElement
    function HTMLTableCaptionElement() {
        HTMLElement.call(this, 'caption');
        this.align = '';
    }
    HTMLTableCaptionElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTableCaptionElement.prototype.constructor = HTMLTableCaptionElement;
    
    // HTMLUListElement
    function HTMLUListElement() {
        HTMLElement.call(this, 'ul');
        this.compact = false;
        this.type = '';
    }
    HTMLUListElement.prototype = Object.create(HTMLElement.prototype);
    HTMLUListElement.prototype.constructor = HTMLUListElement;
    
    // HTMLOListElement
    function HTMLOListElement() {
        HTMLElement.call(this, 'ol');
        this.compact = false;
        this.reversed = false;
        this.start = 1;
        this.type = '';
    }
    HTMLOListElement.prototype = Object.create(HTMLElement.prototype);
    HTMLOListElement.prototype.constructor = HTMLOListElement;
    
    // HTMLLIElement
    function HTMLLIElement() {
        HTMLElement.call(this, 'li');
        this.type = '';
        this.value = 0;
    }
    HTMLLIElement.prototype = Object.create(HTMLElement.prototype);
    HTMLLIElement.prototype.constructor = HTMLLIElement;
    
    // HTMLDListElement
    function HTMLDListElement() {
        HTMLElement.call(this, 'dl');
        this.compact = false;
    }
    HTMLDListElement.prototype = Object.create(HTMLElement.prototype);
    HTMLDListElement.prototype.constructor = HTMLDListElement;
    
    // HTMLLabelElement
    function HTMLLabelElement() {
        HTMLElement.call(this, 'label');
        this.htmlFor = '';
        this.control = null;
        this.form = null;
    }
    HTMLLabelElement.prototype = Object.create(HTMLElement.prototype);
    HTMLLabelElement.prototype.constructor = HTMLLabelElement;
    
    // HTMLFieldSetElement
    function HTMLFieldSetElement() {
        HTMLElement.call(this, 'fieldset');
        this.disabled = false;
        this.form = null;
        this.name = '';
        this.type = 'fieldset';
        this.elements = [];
        this.validity = { valid: true };
        this.validationMessage = '';
        this.willValidate = false;
    }
    HTMLFieldSetElement.prototype = Object.create(HTMLElement.prototype);
    HTMLFieldSetElement.prototype.constructor = HTMLFieldSetElement;
    HTMLFieldSetElement.prototype.checkValidity = function() { return true; };
    HTMLFieldSetElement.prototype.reportValidity = function() { return true; };
    HTMLFieldSetElement.prototype.setCustomValidity = function(message) {};
    
    // HTMLLegendElement
    function HTMLLegendElement() {
        HTMLElement.call(this, 'legend');
        this.form = null;
        this.align = '';
    }
    HTMLLegendElement.prototype = Object.create(HTMLElement.prototype);
    HTMLLegendElement.prototype.constructor = HTMLLegendElement;
    
    // HTMLProgressElement
    function HTMLProgressElement() {
        HTMLElement.call(this, 'progress');
        this.max = 1;
        this.value = 0;
        this.position = -1;
        this.labels = [];
    }
    HTMLProgressElement.prototype = Object.create(HTMLElement.prototype);
    HTMLProgressElement.prototype.constructor = HTMLProgressElement;
    
    // HTMLMeterElement
    function HTMLMeterElement() {
        HTMLElement.call(this, 'meter');
        this.min = 0;
        this.max = 1;
        this.value = 0;
        this.low = 0;
        this.high = 1;
        this.optimum = 0.5;
        this.labels = [];
    }
    HTMLMeterElement.prototype = Object.create(HTMLElement.prototype);
    HTMLMeterElement.prototype.constructor = HTMLMeterElement;
    
    // HTMLOutputElement
    function HTMLOutputElement() {
        HTMLElement.call(this, 'output');
        this.defaultValue = '';
        this.value = '';
        this.htmlFor = '';
        this.form = null;
        this.name = '';
        this.type = 'output';
        this.validity = { valid: true };
        this.validationMessage = '';
        this.willValidate = false;
        this.labels = [];
    }
    HTMLOutputElement.prototype = Object.create(HTMLElement.prototype);
    HTMLOutputElement.prototype.constructor = HTMLOutputElement;
    HTMLOutputElement.prototype.checkValidity = function() { return true; };
    HTMLOutputElement.prototype.reportValidity = function() { return true; };
    HTMLOutputElement.prototype.setCustomValidity = function(message) {};
    
    // HTMLDetailsElement
    function HTMLDetailsElement() {
        HTMLElement.call(this, 'details');
        this.open = false;
    }
    HTMLDetailsElement.prototype = Object.create(HTMLElement.prototype);
    HTMLDetailsElement.prototype.constructor = HTMLDetailsElement;
    
    // HTMLSummaryElement
    function HTMLSummaryElement() {
        HTMLElement.call(this, 'summary');
    }
    HTMLSummaryElement.prototype = Object.create(HTMLElement.prototype);
    HTMLSummaryElement.prototype.constructor = HTMLSummaryElement;
    
    // HTMLDialogElement
    function HTMLDialogElement() {
        HTMLElement.call(this, 'dialog');
        this.open = false;
        this.returnValue = '';
    }
    HTMLDialogElement.prototype = Object.create(HTMLElement.prototype);
    HTMLDialogElement.prototype.constructor = HTMLDialogElement;
    HTMLDialogElement.prototype.show = function() {
        this.open = true;
        Monitor.log('Dialog', 'show', { elementId: this.__id__ });
    };
    HTMLDialogElement.prototype.showModal = function() {
        this.open = true;
        Monitor.log('Dialog', 'showModal', { elementId: this.__id__ });
    };
    HTMLDialogElement.prototype.close = function(returnValue) {
        this.open = false;
        if (returnValue !== undefined) this.returnValue = returnValue;
        Monitor.log('Dialog', 'close', { elementId: this.__id__, returnValue });
    };
    
    // HTMLSlotElement
    function HTMLSlotElement() {
        HTMLElement.call(this, 'slot');
        this.name = '';
    }
    HTMLSlotElement.prototype = Object.create(HTMLElement.prototype);
    HTMLSlotElement.prototype.constructor = HTMLSlotElement;
    HTMLSlotElement.prototype.assignedNodes = function(options) { return []; };
    HTMLSlotElement.prototype.assignedElements = function(options) { return []; };
    HTMLSlotElement.prototype.assign = function(...nodes) {};
    
    // HTMLTemplateElement
    function HTMLTemplateElement() {
        HTMLElement.call(this, 'template');
        this.content = new DocumentFragment();
    }
    HTMLTemplateElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTemplateElement.prototype.constructor = HTMLTemplateElement;
    
    // HTMLPictureElement
    function HTMLPictureElement() {
        HTMLElement.call(this, 'picture');
    }
    HTMLPictureElement.prototype = Object.create(HTMLElement.prototype);
    HTMLPictureElement.prototype.constructor = HTMLPictureElement;
    
    // HTMLSourceElement
    function HTMLSourceElement() {
        HTMLElement.call(this, 'source');
        this.src = '';
        this.srcset = '';
        this.sizes = '';
        this.type = '';
        this.media = '';
        this.width = 0;
        this.height = 0;
    }
    HTMLSourceElement.prototype = Object.create(HTMLElement.prototype);
    HTMLSourceElement.prototype.constructor = HTMLSourceElement;
    
    // HTMLTrackElement
    function HTMLTrackElement() {
        HTMLElement.call(this, 'track');
        this.kind = 'subtitles';
        this.src = '';
        this.srclang = '';
        this.label = '';
        this.default = false;
        this.readyState = 0;
        this.track = null;
    }
    HTMLTrackElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTrackElement.prototype.constructor = HTMLTrackElement;
    
    // HTMLEmbedElement
    function HTMLEmbedElement() {
        HTMLElement.call(this, 'embed');
        this.src = '';
        this.type = '';
        this.width = '';
        this.height = '';
        this.align = '';
        this.name = '';
    }
    HTMLEmbedElement.prototype = Object.create(HTMLElement.prototype);
    HTMLEmbedElement.prototype.constructor = HTMLEmbedElement;
    HTMLEmbedElement.prototype.getSVGDocument = function() { return null; };
    
    // HTMLObjectElement
    function HTMLObjectElement() {
        HTMLElement.call(this, 'object');
        this.data = '';
        this.type = '';
        this.name = '';
        this.useMap = '';
        this.form = null;
        this.width = '';
        this.height = '';
        this.contentDocument = null;
        this.contentWindow = null;
        this.validity = { valid: true };
        this.validationMessage = '';
        this.willValidate = false;
    }
    HTMLObjectElement.prototype = Object.create(HTMLElement.prototype);
    HTMLObjectElement.prototype.constructor = HTMLObjectElement;
    HTMLObjectElement.prototype.checkValidity = function() { return true; };
    HTMLObjectElement.prototype.reportValidity = function() { return true; };
    HTMLObjectElement.prototype.setCustomValidity = function(message) {};
    HTMLObjectElement.prototype.getSVGDocument = function() { return null; };
    
    // ==================== 元素类型映射 ====================
    const elementConstructors = {
        // 基础元素
        'div': HTMLDivElement,
        'span': HTMLSpanElement,
        'p': HTMLParagraphElement,
        'br': HTMLBRElement,
        'hr': HTMLHRElement,
        'pre': HTMLPreElement,
        
        // 标题
        'h1': function() { return new HTMLHeadingElement(1); },
        'h2': function() { return new HTMLHeadingElement(2); },
        'h3': function() { return new HTMLHeadingElement(3); },
        'h4': function() { return new HTMLHeadingElement(4); },
        'h5': function() { return new HTMLHeadingElement(5); },
        'h6': function() { return new HTMLHeadingElement(6); },
        
        // 文档结构
        'html': HTMLHtmlElement,
        'head': HTMLHeadElement,
        'body': HTMLBodyElement,
        'title': HTMLTitleElement,
        'base': HTMLBaseElement,
        'meta': HTMLMetaElement,
        'link': HTMLLinkElement,
        'style': HTMLStyleElement,
        'script': HTMLScriptElement,
        
        // 表单
        'form': HTMLFormElement,
        'input': HTMLInputElement,
        'button': HTMLButtonElement,
        'textarea': HTMLTextAreaElement,
        'select': HTMLSelectElement,
        'option': HTMLOptionElement,
        'optgroup': HTMLElement,
        'label': HTMLLabelElement,
        'fieldset': HTMLFieldSetElement,
        'legend': HTMLLegendElement,
        'datalist': HTMLElement,
        'output': HTMLOutputElement,
        'progress': HTMLProgressElement,
        'meter': HTMLMeterElement,
        
        // 表格
        'table': HTMLTableElement,
        'thead': function() { return new HTMLTableSectionElement('thead'); },
        'tbody': function() { return new HTMLTableSectionElement('tbody'); },
        'tfoot': function() { return new HTMLTableSectionElement('tfoot'); },
        'tr': HTMLTableRowElement,
        'td': function() { return new HTMLTableCellElement('td'); },
        'th': function() { return new HTMLTableCellElement('th'); },
        'caption': HTMLTableCaptionElement,
        'colgroup': HTMLElement,
        'col': HTMLElement,
        
        // 列表
        'ul': HTMLUListElement,
        'ol': HTMLOListElement,
        'li': HTMLLIElement,
        'dl': HTMLDListElement,
        'dt': HTMLElement,
        'dd': HTMLElement,
        
        // 媒体
        'img': HTMLImageElement,
        'video': HTMLVideoElement,
        'audio': HTMLAudioElement,
        'source': HTMLSourceElement,
        'track': HTMLTrackElement,
        'picture': HTMLPictureElement,
        'canvas': HTMLCanvasElement,
        'embed': HTMLEmbedElement,
        'object': HTMLObjectElement,
        'iframe': HTMLIFrameElement,
        
        // 链接
        'a': HTMLAnchorElement,
        'area': HTMLElement,
        'map': HTMLElement,
        
        // 交互
        'details': HTMLDetailsElement,
        'summary': HTMLSummaryElement,
        'dialog': HTMLDialogElement,
        
        // Web Components
        'slot': HTMLSlotElement,
        'template': HTMLTemplateElement,
        
        // 语义化标签
        'header': HTMLElement,
        'footer': HTMLElement,
        'main': HTMLElement,
        'nav': HTMLElement,
        'aside': HTMLElement,
        'section': HTMLElement,
        'article': HTMLElement,
        'figure': HTMLElement,
        'figcaption': HTMLElement,
        'mark': HTMLElement,
        'time': HTMLElement,
        'address': HTMLElement,
        'blockquote': HTMLElement,
        'q': HTMLElement,
        'cite': HTMLElement,
        'code': HTMLElement,
        'kbd': HTMLElement,
        'samp': HTMLElement,
        'var': HTMLElement,
        'abbr': HTMLElement,
        'dfn': HTMLElement,
        'em': HTMLElement,
        'strong': HTMLElement,
        'small': HTMLElement,
        'sub': HTMLElement,
        'sup': HTMLElement,
        'i': HTMLElement,
        'b': HTMLElement,
        'u': HTMLElement,
        's': HTMLElement,
        'del': HTMLElement,
        'ins': HTMLElement,
        'wbr': HTMLElement,
        'ruby': HTMLElement,
        'rt': HTMLElement,
        'rp': HTMLElement,
        'bdi': HTMLElement,
        'bdo': HTMLElement,
        'data': HTMLElement,
        'noscript': HTMLElement
    };
    
    // ==================== Text Node ====================
    function Text(data) {
        Node.call(this);
        this.nodeType = 3;
        this.nodeName = '#text';
        this._data = data !== undefined ? String(data) : '';
        this.nodeValue = this._data;
        this.textContent = this._data;
        this.length = this._data.length;
        
        Object.defineProperty(this, 'data', {
            get: function() { return this._data; },
            set: function(val) {
                this._data = String(val);
                this.nodeValue = this._data;
                this.textContent = this._data;
                this.length = this._data.length;
            }
        });
    }
    Text.prototype = Object.create(Node.prototype);
    Text.prototype.constructor = Text;
    Text.prototype.substringData = function(offset, count) { return this._data.substring(offset, offset + count); };
    Text.prototype.appendData = function(data) { this.data += data; };
    Text.prototype.insertData = function(offset, data) { this.data = this._data.slice(0, offset) + data + this._data.slice(offset); };
    Text.prototype.deleteData = function(offset, count) { this.data = this._data.slice(0, offset) + this._data.slice(offset + count); };
    Text.prototype.replaceData = function(offset, count, data) { this.data = this._data.slice(0, offset) + data + this._data.slice(offset + count); };
    Text.prototype.splitText = function(offset) {
        const newText = new Text(this._data.slice(offset));
        this.data = this._data.slice(0, offset);
        if (this.parentNode) this.parentNode.insertBefore(newText, this.nextSibling);
        return newText;
    };
    Text.prototype.cloneNode = function() { return new Text(this._data); };
    window.Text = Text;
    
    // ==================== Comment ====================
    function Comment(data) {
        Node.call(this);
        this.nodeType = 8;
        this.nodeName = '#comment';
        this.data = data || '';
        this.nodeValue = this.data;
        this.textContent = this.data;
        this.length = this.data.length;
    }
    Comment.prototype = Object.create(Node.prototype);
    Comment.prototype.constructor = Comment;
    Comment.prototype.cloneNode = function() { return new Comment(this.data); };
    window.Comment = Comment;
    
    // ==================== DocumentFragment ====================
    function DocumentFragment() {
        Node.call(this);
        this.nodeType = 11;
        this.nodeName = '#document-fragment';
        this.children = [];
        this.childElementCount = 0;
        this.firstElementChild = null;
        this.lastElementChild = null;
    }
    DocumentFragment.prototype = Object.create(Node.prototype);
    DocumentFragment.prototype.constructor = DocumentFragment;
    DocumentFragment.prototype._updateChildReferences = Element.prototype._updateChildReferences;
    DocumentFragment.prototype.getElementById = function(id) { return null; };
    DocumentFragment.prototype.querySelector = function(selector) { return null; };
    DocumentFragment.prototype.querySelectorAll = function(selector) { return []; };
    DocumentFragment.prototype.append = Element.prototype.append;
    DocumentFragment.prototype.prepend = Element.prototype.prepend;
    DocumentFragment.prototype.replaceChildren = function(...nodes) {
        while (this.firstChild) this.removeChild(this.firstChild);
        this.append(...nodes);
    };
    window.DocumentFragment = DocumentFragment;
    
    // ==================== DOMException ====================
    function DOMException(message, name) {
        Error.call(this, message);
        this.name = name || 'DOMException';
        this.message = message || '';
        this.code = 0;
    }
    DOMException.prototype = Object.create(Error.prototype);
    DOMException.prototype.constructor = DOMException;
    window.DOMException = DOMException;
    
    // ==================== Document ====================
    const document = {
        // 基本属性
        nodeType: 9,
        nodeName: '#document',
        nodeValue: null,
        ownerDocument: null,
        
        // 文档信息
        documentElement: null,
        head: null,
        body: null,
        title: '',
        characterSet: 'UTF-8',
        charset: 'UTF-8',
        inputEncoding: 'UTF-8',
        contentType: 'text/html',
        doctype: { name: 'html', publicId: '', systemId: '' },
        
        // URL 相关
        URL: 'https://example.com/',
        documentURI: 'https://example.com/',
        baseURI: 'https://example.com/',
        domain: 'example.com',
        referrer: '',
        cookie: '',
        lastModified: new Date().toUTCString(),
        
        // 状态
        readyState: 'complete',
        hidden: false,
        visibilityState: 'visible',
        hasFocus: true,
        fullscreenEnabled: true,
        fullscreenElement: null,
        pictureInPictureEnabled: true,
        pictureInPictureElement: null,
        pointerLockElement: null,
        designMode: 'off',
        dir: '',
        
        // 事件监听器
        _eventListeners: {},
        
        // ========== 创建元素（增强监控） ==========
        createElement: function(tagName, options) {
            Monitor.pushChain('document.createElement');
            
            const lowerTag = tagName.toLowerCase();
            
            // 检查 mock
            const mock = Monitor.executeMock('document.createElement', [tagName, options], this);
            if (mock.mocked) {
                Monitor.popChain();
                return mock.result;
            }
            
            let element;
            const Constructor = elementConstructors[lowerTag];
            
            if (Constructor) {
                if (typeof Constructor === 'function') {
                    // 检查是否是工厂函数（返回实例）还是构造函数
                    try {
                        element = new Constructor();
                    } catch (e) {
                        // 如果 new 失败，可能是工厂函数
                        element = Constructor();
                    }
                } else {
                    element = new HTMLElement(lowerTag);
                }
            } else {
                element = new HTMLElement(lowerTag);
            }
            
            element.ownerDocument = this;
            
            // 记录创建
            Monitor.logCreate(tagName, element, options);
            Monitor.log('DOM', 'createElement', {
                tagName: tagName,
                elementId: element.__id__,
                options: options
            });
            
            Monitor.popChain();
            return element;
        },
        
        createElementNS: function(namespaceURI, qualifiedName, options) {
            Monitor.pushChain('document.createElementNS');
            
            const mock = Monitor.executeMock('document.createElementNS', [namespaceURI, qualifiedName, options], this);
            if (mock.mocked) {
                Monitor.popChain();
                return mock.result;
            }
            
            const element = new Element(qualifiedName, namespaceURI);
            element.ownerDocument = this;
            
            Monitor.logCreate(qualifiedName, element, { namespaceURI });
            Monitor.log('DOM', 'createElementNS', {
                namespaceURI: namespaceURI,
                qualifiedName: qualifiedName,
                elementId: element.__id__
            });
            
            Monitor.popChain();
            return element;
        },
        
        createTextNode: function(data) {
            const node = new Text(data);
            node.ownerDocument = this;
            Monitor.log('DOM', 'createTextNode', { data: data?.substring(0, 50) });
            return node;
        },
        
        createComment: function(data) {
            const node = new Comment(data);
            node.ownerDocument = this;
            Monitor.log('DOM', 'createComment', { data: data?.substring(0, 50) });
            return node;
        },
        
        createDocumentFragment: function() {
            const fragment = new DocumentFragment();
            fragment.ownerDocument = this;
            Monitor.log('DOM', 'createDocumentFragment', {});
            return fragment;
        },
        
        createEvent: function(type) {
            Monitor.log('DOM', 'createEvent', { type });
            return new Event('');
        },
        
        createRange: function() {
            Monitor.log('DOM', 'createRange', {});
            return {
                startContainer: null,
                startOffset: 0,
                endContainer: null,
                endOffset: 0,
                collapsed: true,
                commonAncestorContainer: null,
                setStart: function(node, offset) { this.startContainer = node; this.startOffset = offset; },
                setEnd: function(node, offset) { this.endContainer = node; this.endOffset = offset; },
                setStartBefore: function(node) {},
                setStartAfter: function(node) {},
                setEndBefore: function(node) {},
                setEndAfter: function(node) {},
                selectNode: function(node) {},
                selectNodeContents: function(node) {},
                collapse: function(toStart) { this.collapsed = true; },
                cloneContents: function() { return document.createDocumentFragment(); },
                deleteContents: function() {},
                extractContents: function() { return document.createDocumentFragment(); },
                insertNode: function(node) {},
                surroundContents: function(node) {},
                cloneRange: function() { return document.createRange(); },
                detach: function() {},
                toString: function() { return ''; },
                createContextualFragment: function(html) { return document.createDocumentFragment(); },
                getBoundingClientRect: function() { return new DOMRect(0, 0, 0, 0); },
                getClientRects: function() { return []; }
            };
        },
        
        createTreeWalker: function(root, whatToShow, filter) {
            Monitor.log('DOM', 'createTreeWalker', { rootId: root?.__id__, whatToShow });
            return {
                root: root,
                whatToShow: whatToShow || 0xFFFFFFFF,
                filter: filter,
                currentNode: root,
                parentNode: function() { return null; },
                firstChild: function() { return null; },
                lastChild: function() { return null; },
                previousSibling: function() { return null; },
                nextSibling: function() { return null; },
                previousNode: function() { return null; },
                nextNode: function() { return null; }
            };
        },
        
        createNodeIterator: function(root, whatToShow, filter) {
            Monitor.log('DOM', 'createNodeIterator', { rootId: root?.__id__ });
            return {
                root: root,
                whatToShow: whatToShow || 0xFFFFFFFF,
                filter: filter,
                referenceNode: root,
                pointerBeforeReferenceNode: true,
                nextNode: function() { return null; },
                previousNode: function() { return null; },
                detach: function() {}
            };
        },
        
        // ========== 查询（增强监控） ==========
        getElementById: function(id) {
            Monitor.pushChain('document.getElementById');
            Monitor.log('DOM', 'getElementById', { id: id });
            
            const mock = Monitor.executeMock('document.getElementById', [id], this);
            Monitor.popChain();
            
            if (mock.mocked) return mock.result;
            return null;
        },
        
        getElementsByName: function(name) {
            Monitor.log('DOM', 'getElementsByName', { name });
            
            const mock = Monitor.executeMock('document.getElementsByName', [name], this);
            if (mock.mocked) return mock.result;
            
            return [];
        },
        
        getElementsByTagName: function(tagName) {
            Monitor.log('DOM', 'getElementsByTagName', { tagName });
            
            const mock = Monitor.executeMock('document.getElementsByTagName', [tagName], this);
            if (mock.mocked) return mock.result;
            
            return [];
        },
        
        getElementsByClassName: function(className) {
            Monitor.log('DOM', 'getElementsByClassName', { className });
            
            const mock = Monitor.executeMock('document.getElementsByClassName', [className], this);
            if (mock.mocked) return mock.result;
            
            return [];
        },
        
        querySelector: function(selector) {
            Monitor.log('DOM', 'querySelector', { selector });
            
            const mock = Monitor.executeMock('document.querySelector', [selector], this);
            if (mock.mocked) return mock.result;
            
            return null;
        },
        
        querySelectorAll: function(selector) {
            Monitor.log('DOM', 'querySelectorAll', { selector });
            
            const mock = Monitor.executeMock('document.querySelectorAll', [selector], this);
            if (mock.mocked) return mock.result;
            
            return [];
        },
        
        // ========== 文档操作 ==========
        write: function(...args) {
            Monitor.log('DOM', 'write', { content: args.join('').substring(0, 100) });
        },
        
        writeln: function(...args) {
            Monitor.log('DOM', 'writeln', { content: args.join('').substring(0, 100) });
        },
        
        open: function(url, name, features) {
            Monitor.log('DOM', 'open', { url, name });
            return this;
        },
        
        close: function() {
            Monitor.log('DOM', 'close', {});
        },
        
        // ========== 其他方法 ==========
        getSelection: function() {
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
        },
        
        elementFromPoint: function(x, y) {
            Monitor.log('DOM', 'elementFromPoint', { x, y });
            
            const mock = Monitor.executeMock('document.elementFromPoint', [x, y], this);
            if (mock.mocked) return mock.result;
            
            return null;
        },
        
        elementsFromPoint: function(x, y) {
            Monitor.log('DOM', 'elementsFromPoint', { x, y });
            return [];
        },
        
        caretPositionFromPoint: function(x, y) {
            return null;
        },
        
        caretRangeFromPoint: function(x, y) {
            return null;
        },
        
        createAttribute: function(name) {
            return new Attr(name, '', null);
        },
        
        createAttributeNS: function(namespaceURI, qualifiedName) {
            const attr = new Attr(qualifiedName, '', null);
            attr.namespaceURI = namespaceURI;
            return attr;
        },
        
        importNode: function(node, deep) {
            Monitor.log('DOM', 'importNode', { deep });
            return node.cloneNode(deep);
        },
        
        adoptNode: function(node) {
            Monitor.log('DOM', 'adoptNode', {});
            if (node.parentNode) node.parentNode.removeChild(node);
            node.ownerDocument = this;
            return node;
        },
        
        execCommand: function(command, showUI, value) {
            Monitor.log('DOM', 'execCommand', { command, showUI, value });
            return false;
        },
        
        queryCommandEnabled: function(command) { return false; },
        queryCommandIndeterm: function(command) { return false; },
        queryCommandState: function(command) { return false; },
        queryCommandSupported: function(command) { return false; },
        queryCommandValue: function(command) { return ''; },
        
        hasFocus: function() { return true; },
        
        exitFullscreen: function() { return Promise.resolve(); },
        exitPictureInPicture: function() { return Promise.resolve(); },
        exitPointerLock: function() {},
        
        // 事件
        addEventListener: function(type, listener, options) {
            if (!this._eventListeners[type]) this._eventListeners[type] = [];
            this._eventListeners[type].push({ listener, options });
            Monitor.log('Event', 'addEventListener', { target: 'document', type });
        },
        
        removeEventListener: function(type, listener, options) {
            if (this._eventListeners[type]) {
                this._eventListeners[type] = this._eventListeners[type].filter(l => l.listener !== listener);
            }
            Monitor.log('Event', 'removeEventListener', { target: 'document', type });
        },
        
        dispatchEvent: function(event) {
            event.target = this;
            event.currentTarget = this;
            const listeners = this._eventListeners[event.type] || [];
            listeners.forEach(({ listener }) => {
                if (typeof listener === 'function') {
                    listener.call(this, event);
                }
            });
            return !event.defaultPrevented;
        },
        
        // 其他属性
        defaultView: null,
        implementation: {
            createDocument: function() { return {}; },
            createDocumentType: function() { return {}; },
            createHTMLDocument: function(title) { return {}; },
            hasFeature: function() { return true; }
        },
        
        fonts: {
            ready: Promise.resolve(),
            status: 'loaded',
            check: function() { return true; },
            load: function() { return Promise.resolve([]); },
            add: function() {},
            delete: function() { return false; },
            clear: function() {},
            forEach: function() {},
            entries: function() { return [][Symbol.iterator](); },
            keys: function() { return [][Symbol.iterator](); },
            values: function() { return [][Symbol.iterator](); },
            [Symbol.iterator]: function() { return [][Symbol.iterator](); }
        },
        
        styleSheets: [],
        adoptedStyleSheets: [],
        
        timeline: {
            currentTime: 0
        },
        
        scrollingElement: null,
        
        activeElement: null,
        
        // 兼容性属性
        all: [],
        anchors: [],
        applets: [],
        embeds: [],
        forms: [],
        images: [],
        links: [],
        plugins: [],
        scripts: []
    };
    
    // 初始化文档结构
    function initDocumentStructure() {
        // 创建 html 元素
        document.documentElement = document.createElement('html');
        document.documentElement.ownerDocument = document;
        
        // 创建 head 和 body
        document.head = document.createElement('head');
        document.body = document.createElement('body');
        
        document.documentElement.appendChild(document.head);
        document.documentElement.appendChild(document.body);
        
        // 设置相关引用
        document.defaultView = window;
        document.scrollingElement = document.documentElement;
        document.activeElement = document.body;
    }
    
    initDocumentStructure();
    
    // ==================== 暴露到全局 ====================
    window.document = document;
    window.Document = function() { return document; };
    window.Element = Element;
    window.HTMLElement = HTMLElement;
    window.HTMLDivElement = HTMLDivElement;
    window.HTMLSpanElement = HTMLSpanElement;
    window.HTMLCanvasElement = HTMLCanvasElement;
    window.HTMLImageElement = HTMLImageElement;
    window.HTMLInputElement = HTMLInputElement;
    window.HTMLButtonElement = HTMLButtonElement;
    window.HTMLTextAreaElement = HTMLTextAreaElement;
    window.HTMLSelectElement = HTMLSelectElement;
    window.HTMLOptionElement = HTMLOptionElement;
    window.HTMLAnchorElement = HTMLAnchorElement;
    window.HTMLFormElement = HTMLFormElement;
    window.HTMLIFrameElement = HTMLIFrameElement;
    window.HTMLVideoElement = HTMLVideoElement;
    window.HTMLAudioElement = HTMLAudioElement;
    window.HTMLScriptElement = HTMLScriptElement;
    window.HTMLStyleElement = HTMLStyleElement;
    window.HTMLLinkElement = HTMLLinkElement;
    window.HTMLMetaElement = HTMLMetaElement;
    window.HTMLTableElement = HTMLTableElement;
    window.HTMLTableRowElement = HTMLTableRowElement;
    window.HTMLTableCellElement = HTMLTableCellElement;
    window.HTMLUListElement = HTMLUListElement;
    window.HTMLOListElement = HTMLOListElement;
    window.HTMLLIElement = HTMLLIElement;
    window.HTMLDialogElement = HTMLDialogElement;
    window.HTMLProgressElement = HTMLProgressElement;
    window.HTMLMeterElement = HTMLMeterElement;
    window.HTMLTemplateElement = HTMLTemplateElement;
    window.Node = Node;
    
})();
