/**
 * @env-module XMLHttpRequest
 * @description XMLHttpRequest模拟
 * @compatibility Chrome 80+, Firefox 75+, Edge 79+
 */

(function() {
    function XMLHttpRequest() {
        this.readyState = 0;
        this.response = null;
        this.responseText = '';
        this.responseType = '';
        this.responseURL = '';
        this.responseXML = null;
        this.status = 0;
        this.statusText = '';
        this.timeout = 0;
        this.withCredentials = false;
        
        this._method = '';
        this._url = '';
        this._async = true;
        this._headers = {};
        this._responseHeaders = {};
        this._aborted = false;
        
        // Event handlers
        this.onreadystatechange = null;
        this.onload = null;
        this.onerror = null;
        this.onabort = null;
        this.ontimeout = null;
        this.onloadstart = null;
        this.onloadend = null;
        this.onprogress = null;
        
        this._listeners = {};
    }

    XMLHttpRequest.UNSENT = 0;
    XMLHttpRequest.OPENED = 1;
    XMLHttpRequest.HEADERS_RECEIVED = 2;
    XMLHttpRequest.LOADING = 3;
    XMLHttpRequest.DONE = 4;

    XMLHttpRequest.prototype = {
        open: function(method, url, async, user, password) {
            this._method = method.toUpperCase();
            this._url = url;
            this._async = async !== false;
            this.readyState = XMLHttpRequest.OPENED;
            this._dispatchReadyStateChange();
        },

        setRequestHeader: function(name, value) {
            this._headers[name.toLowerCase()] = value;
        },

        getResponseHeader: function(name) {
            return this._responseHeaders[name.toLowerCase()] || null;
        },

        getAllResponseHeaders: function() {
            return Object.entries(this._responseHeaders)
                .map(([name, value]) => `${name}: ${value}`)
                .join('\r\n');
        },

        overrideMimeType: function(mime) {
            this._mimeType = mime;
        },

        send: function(body) {
            if (this._aborted) return;
            
            console.log('[XMLHttpRequest.send]', this._method, this._url);
            
            this._dispatchEvent('loadstart');
            
            // 模拟请求
            const self = this;
            setTimeout(function() {
                if (self._aborted) return;
                
                // 模拟响应
                self.readyState = XMLHttpRequest.HEADERS_RECEIVED;
                self._responseHeaders = {
                    'content-type': 'application/json'
                };
                self._dispatchReadyStateChange();
                
                setTimeout(function() {
                    if (self._aborted) return;
                    
                    self.readyState = XMLHttpRequest.LOADING;
                    self._dispatchReadyStateChange();
                    self._dispatchEvent('progress', { loaded: 50, total: 100 });
                    
                    setTimeout(function() {
                        if (self._aborted) return;
                        
                        self.readyState = XMLHttpRequest.DONE;
                        self.status = 200;
                        self.statusText = 'OK';
                        self.responseText = JSON.stringify({ success: true, message: 'Simulated XHR response' });
                        self.response = self.responseText;
                        self.responseURL = self._url;
                        
                        self._dispatchReadyStateChange();
                        self._dispatchEvent('progress', { loaded: 100, total: 100 });
                        self._dispatchEvent('load');
                        self._dispatchEvent('loadend');
                    }, 10);
                }, 10);
            }, 10);
        },

        abort: function() {
            this._aborted = true;
            this.readyState = XMLHttpRequest.UNSENT;
            this._dispatchEvent('abort');
            this._dispatchEvent('loadend');
        },

        addEventListener: function(type, listener) {
            if (!this._listeners[type]) {
                this._listeners[type] = [];
            }
            this._listeners[type].push(listener);
        },

        removeEventListener: function(type, listener) {
            if (this._listeners[type]) {
                this._listeners[type] = this._listeners[type].filter(l => l !== listener);
            }
        },

        _dispatchEvent: function(type, props) {
            const event = {
                type: type,
                target: this,
                currentTarget: this,
                loaded: props?.loaded || 0,
                total: props?.total || 0,
                lengthComputable: props?.total > 0
            };
            
            // 调用on*处理器
            const handler = this['on' + type];
            if (typeof handler === 'function') {
                handler.call(this, event);
            }
            
            // 调用addEventListener添加的处理器
            const listeners = this._listeners[type] || [];
            listeners.forEach(listener => {
                if (typeof listener === 'function') {
                    listener.call(this, event);
                }
            });
        },

        _dispatchReadyStateChange: function() {
            this._dispatchEvent('readystatechange');
        }
    };

    // 挂载到window
    window.XMLHttpRequest = XMLHttpRequest;
    global.XMLHttpRequest = XMLHttpRequest;
})();
