/**
 * @env-module fetch
 * @description Fetch API模拟
 * @compatibility Chrome 80+, Firefox 75+, Edge 79+
 */

(function() {
    // Headers
    function Headers(init) {
        this._headers = {};
        
        if (init) {
            if (init instanceof Headers) {
                init.forEach((value, key) => {
                    this.append(key, value);
                });
            } else if (Array.isArray(init)) {
                init.forEach(([key, value]) => {
                    this.append(key, value);
                });
            } else if (typeof init === 'object') {
                Object.entries(init).forEach(([key, value]) => {
                    this.append(key, value);
                });
            }
        }
    }

    Headers.prototype = {
        append: function(name, value) {
            name = name.toLowerCase();
            if (!this._headers[name]) {
                this._headers[name] = [];
            }
            this._headers[name].push(String(value));
        },
        delete: function(name) {
            delete this._headers[name.toLowerCase()];
        },
        get: function(name) {
            const values = this._headers[name.toLowerCase()];
            return values ? values.join(', ') : null;
        },
        has: function(name) {
            return name.toLowerCase() in this._headers;
        },
        set: function(name, value) {
            this._headers[name.toLowerCase()] = [String(value)];
        },
        forEach: function(callback, thisArg) {
            Object.entries(this._headers).forEach(([name, values]) => {
                values.forEach(value => {
                    callback.call(thisArg, value, name, this);
                });
            });
        },
        entries: function() {
            const entries = [];
            this.forEach((value, key) => {
                entries.push([key, value]);
            });
            return entries[Symbol.iterator]();
        },
        keys: function() {
            return Object.keys(this._headers)[Symbol.iterator]();
        },
        values: function() {
            const values = [];
            this.forEach(value => values.push(value));
            return values[Symbol.iterator]();
        },
        [Symbol.iterator]: function() {
            return this.entries();
        }
    };

    // Request
    function Request(input, init) {
        init = init || {};
        
        if (input instanceof Request) {
            this.url = input.url;
            this.method = input.method;
            this.headers = new Headers(input.headers);
            this.body = input.body;
            this.mode = input.mode;
            this.credentials = input.credentials;
            this.cache = input.cache;
            this.redirect = input.redirect;
            this.referrer = input.referrer;
            this.referrerPolicy = input.referrerPolicy;
            this.integrity = input.integrity;
        } else {
            this.url = String(input);
        }
        
        if (init.method) this.method = init.method.toUpperCase();
        else if (!this.method) this.method = 'GET';
        
        if (init.headers) this.headers = new Headers(init.headers);
        else if (!this.headers) this.headers = new Headers();
        
        if (init.body !== undefined) this.body = init.body;
        
        this.mode = init.mode || this.mode || 'cors';
        this.credentials = init.credentials || this.credentials || 'same-origin';
        this.cache = init.cache || this.cache || 'default';
        this.redirect = init.redirect || this.redirect || 'follow';
        this.referrer = init.referrer !== undefined ? init.referrer : (this.referrer || 'about:client');
        this.referrerPolicy = init.referrerPolicy || this.referrerPolicy || '';
        this.integrity = init.integrity || this.integrity || '';
        this.signal = init.signal || null;
        
        this.bodyUsed = false;
    }

    Request.prototype = {
        clone: function() {
            return new Request(this);
        },
        arrayBuffer: function() {
            this.bodyUsed = true;
            return Promise.resolve(new ArrayBuffer(0));
        },
        blob: function() {
            this.bodyUsed = true;
            return Promise.resolve(new Blob([]));
        },
        formData: function() {
            this.bodyUsed = true;
            return Promise.resolve(new FormData());
        },
        json: function() {
            this.bodyUsed = true;
            return Promise.resolve({});
        },
        text: function() {
            this.bodyUsed = true;
            return Promise.resolve('');
        }
    };

    // Response
    function Response(body, init) {
        init = init || {};
        
        this.body = body || null;
        this.status = init.status !== undefined ? init.status : 200;
        this.statusText = init.statusText || '';
        this.ok = this.status >= 200 && this.status < 300;
        this.headers = new Headers(init.headers);
        this.type = 'basic';
        this.url = init.url || '';
        this.redirected = false;
        this.bodyUsed = false;
        
        this._body = body;
    }

    Response.prototype = {
        clone: function() {
            return new Response(this._body, {
                status: this.status,
                statusText: this.statusText,
                headers: this.headers,
                url: this.url
            });
        },
        arrayBuffer: function() {
            this.bodyUsed = true;
            if (this._body instanceof ArrayBuffer) {
                return Promise.resolve(this._body);
            }
            return Promise.resolve(new ArrayBuffer(0));
        },
        blob: function() {
            this.bodyUsed = true;
            if (this._body instanceof Blob) {
                return Promise.resolve(this._body);
            }
            return Promise.resolve(new Blob([this._body || '']));
        },
        formData: function() {
            this.bodyUsed = true;
            return Promise.resolve(new FormData());
        },
        json: function() {
            this.bodyUsed = true;
            try {
                const data = typeof this._body === 'string' ? JSON.parse(this._body) : this._body;
                return Promise.resolve(data || {});
            } catch (e) {
                return Promise.reject(new SyntaxError('Unexpected token'));
            }
        },
        text: function() {
            this.bodyUsed = true;
            return Promise.resolve(String(this._body || ''));
        }
    };

    Response.error = function() {
        const response = new Response(null, { status: 0, statusText: '' });
        response.type = 'error';
        return response;
    };

    Response.redirect = function(url, status) {
        status = status || 302;
        const response = new Response(null, { status, headers: { Location: url } });
        return response;
    };

    // fetch函数
    function fetch(input, init) {
        console.log('[fetch]', typeof input === 'string' ? input : input.url, init);
        
        return new Promise((resolve, reject) => {
            const request = input instanceof Request ? input : new Request(input, init);
            
            // 模拟网络延迟
            setTimeout(() => {
                // 返回模拟响应
                const response = new Response(JSON.stringify({
                    success: true,
                    message: 'Simulated response'
                }), {
                    status: 200,
                    statusText: 'OK',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    url: request.url
                });
                
                resolve(response);
            }, 10);
        });
    }

    // AbortController
    function AbortController() {
        this.signal = new AbortSignal();
    }
    AbortController.prototype.abort = function(reason) {
        this.signal._aborted = true;
        this.signal.reason = reason || new DOMException('The operation was aborted.', 'AbortError');
        if (this.signal.onabort) {
            this.signal.onabort(new Event('abort'));
        }
    };

    function AbortSignal() {
        this._aborted = false;
        this.reason = undefined;
        this.onabort = null;
        this._listeners = [];
    }
    AbortSignal.prototype = {
        get aborted() {
            return this._aborted;
        },
        addEventListener: function(type, listener) {
            if (type === 'abort') {
                this._listeners.push(listener);
            }
        },
        removeEventListener: function(type, listener) {
            if (type === 'abort') {
                this._listeners = this._listeners.filter(l => l !== listener);
            }
        },
        throwIfAborted: function() {
            if (this._aborted) {
                throw this.reason;
            }
        }
    };
    AbortSignal.abort = function(reason) {
        const signal = new AbortSignal();
        signal._aborted = true;
        signal.reason = reason || new DOMException('The operation was aborted.', 'AbortError');
        return signal;
    };
    AbortSignal.timeout = function(milliseconds) {
        const signal = new AbortSignal();
        setTimeout(() => {
            signal._aborted = true;
            signal.reason = new DOMException('The operation timed out.', 'TimeoutError');
        }, milliseconds);
        return signal;
    };

    // 挂载到window和global
    window.Headers = Headers;
    window.Request = Request;
    window.Response = Response;
    window.fetch = fetch;
    window.AbortController = AbortController;
    window.AbortSignal = AbortSignal;
    global.Headers = Headers;
    global.Request = Request;
    global.Response = Response;
    global.fetch = fetch;
    global.AbortController = AbortController;
    global.AbortSignal = AbortSignal;
})();
