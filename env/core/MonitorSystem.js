/**
 * @env-module MonitorSystem
 * @description 增强版环境监控系统 - 支持灵活mock、方法调用链监控、返回值控制
 * @compatibility Chrome 80+, Firefox 75+, Edge 79+
 * @generated-by Claude
 */

(function() {
    'use strict';
    
    // ==================== 核心监控系统 ====================
    const __EnvMonitor__ = {
        // 版本
        version: '2.0.0',
        
        // ========== 配置 ==========
        config: {
            enabled: true,           // 总开关
            maxLogs: 10000,          // 最大日志数
            consoleOutput: false,    // 控制台输出
            stackTrace: true,        // 记录调用栈
            trackChain: true,        // 追踪调用链
            detailedArgs: true       // 详细参数记录
        },
        
        // ========== 日志存储 ==========
        logs: {
            access: [],       // 属性访问日志
            calls: [],        // 方法调用日志
            create: [],       // 元素创建日志
            undefined: [],    // undefined 访问日志
            chain: [],        // 调用链日志
            custom: []        // 自定义日志
        },
        
        // ========== Mock 配置中心 ==========
        mocks: {
            // 格式: 'path.to.method': { returnValue: any, handler: function, beforeCall: function, afterCall: function }
            // 示例:
            // 'document.getElementById': { returnValue: null }
            // 'document.createElement': { handler: (tagName) => customElement }
            // 'canvas.getContext': { returnValue: mockCanvasContext }
            // 'navigator.userAgent': { returnValue: 'Custom UA' }
        },
        
        // ========== 属性监控配置 ==========
        watchedProperties: {
            // 格式: 'path.to.property': { onChange: callback, onAccess: callback }
        },
        
        // ========== 元素追踪 ==========
        elements: {
            created: new Map(),      // 创建的元素 id -> element
            byTag: new Map(),        // 按标签分类 tagName -> [elements]
            tree: []                 // 元素树结构
        },
        
        // ========== 调用链追踪 ==========
        callChain: {
            current: null,
            stack: [],
            maxDepth: 50
        },
        
        // ==================== 核心方法 ====================
        
        /**
         * 记录日志
         */
        log: function(category, action, details, level = 'info') {
            if (!this.config.enabled) return;
            
            const entry = {
                id: this._generateId(),
                timestamp: Date.now(),
                category: category,
                action: action,
                details: details,
                level: level,
                chain: this.config.trackChain ? [...this.callChain.stack] : null,
                stack: this.config.stackTrace ? this._getStack() : null
            };
            
            // 分类存储
            const logType = this._getLogType(category);
            this.logs[logType].push(entry);
            
            // 限制数量
            if (this.logs[logType].length > this.config.maxLogs) {
                this.logs[logType] = this.logs[logType].slice(-this.config.maxLogs);
            }
            
            // 控制台输出
            if (this.config.consoleOutput) {
                console.log(`[EnvMonitor][${category}][${action}]`, details);
            }
            
            return entry;
        },
        
        /**
         * 记录undefined访问
         */
        logUndefined: function(path, context = '', parentPath = '') {
            const existing = this.logs.undefined.find(l => l.path === path && !l.fixed);
            if (existing) {
                existing.count = (existing.count || 1) + 1;
                existing.lastAccess = Date.now();
                return existing;
            }
            
            const entry = {
                id: this._generateId(),
                path: path,
                parentPath: parentPath,
                context: context,
                timestamp: Date.now(),
                lastAccess: Date.now(),
                count: 1,
                fixed: false,
                fixedBy: null,
                fixedAt: null,
                stack: this.config.stackTrace ? this._getStack() : null
            };
            
            this.logs.undefined.push(entry);
            
            if (this.config.consoleOutput) {
                console.warn(`[EnvMonitor][UNDEFINED] ${path}`, context);
            }
            
            return entry;
        },
        
        /**
         * 记录方法调用
         */
        logCall: function(path, args, result, duration = 0) {
            const entry = {
                id: this._generateId(),
                timestamp: Date.now(),
                path: path,
                args: this.config.detailedArgs ? this._serializeArgs(args) : args.length + ' args',
                result: this._serializeValue(result),
                resultType: typeof result,
                duration: duration,
                chain: this.config.trackChain ? [...this.callChain.stack] : null,
                stack: this.config.stackTrace ? this._getStack() : null
            };
            
            this.logs.calls.push(entry);
            
            if (this.logs.calls.length > this.config.maxLogs) {
                this.logs.calls = this.logs.calls.slice(-this.config.maxLogs);
            }
            
            return entry;
        },
        
        /**
         * 记录元素创建
         */
        logCreate: function(tagName, element, options = {}) {
            const entry = {
                id: this._generateId(),
                timestamp: Date.now(),
                tagName: tagName,
                elementId: element.__id__,
                options: options,
                attributes: {},
                parent: null,
                children: [],
                stack: this.config.stackTrace ? this._getStack() : null
            };
            
            this.logs.create.push(entry);
            
            // 存储元素引用
            this.elements.created.set(element.__id__, element);
            
            // 按标签分类
            if (!this.elements.byTag.has(tagName.toUpperCase())) {
                this.elements.byTag.set(tagName.toUpperCase(), []);
            }
            this.elements.byTag.get(tagName.toUpperCase()).push(element);
            
            if (this.logs.create.length > this.config.maxLogs) {
                this.logs.create = this.logs.create.slice(-this.config.maxLogs);
            }
            
            return entry;
        },
        
        // ==================== Mock 系统 ====================
        
        /**
         * 设置 mock 配置
         * @param {string} path - 路径如 'document.getElementById'
         * @param {object} config - mock配置
         */
        setMock: function(path, config) {
            this.mocks[path] = {
                returnValue: config.returnValue,
                handler: config.handler,           // 自定义处理函数
                beforeCall: config.beforeCall,     // 调用前钩子
                afterCall: config.afterCall,       // 调用后钩子
                condition: config.condition,       // 条件判断
                enabled: config.enabled !== false,
                callCount: 0,
                lastCall: null
            };
            
            this.log('Mock', 'setMock', { path, config: Object.keys(config) });
            return this;
        },
        
        /**
         * 移除 mock
         */
        removeMock: function(path) {
            delete this.mocks[path];
            this.log('Mock', 'removeMock', { path });
            return this;
        },
        
        /**
         * 获取 mock 配置
         */
        getMock: function(path) {
            return this.mocks[path];
        },
        
        /**
         * 检查是否有 mock
         */
        hasMock: function(path) {
            return !!this.mocks[path] && this.mocks[path].enabled;
        },
        
        /**
         * 执行 mock
         */
        executeMock: function(path, args = [], context = null) {
            const mock = this.mocks[path];
            if (!mock || !mock.enabled) return { mocked: false };
            
            // 条件检查
            if (mock.condition && !mock.condition(args, context)) {
                return { mocked: false };
            }
            
            mock.callCount++;
            mock.lastCall = Date.now();
            
            // 前置钩子
            if (mock.beforeCall) {
                mock.beforeCall(args, context);
            }
            
            let result;
            
            // 自定义处理函数
            if (mock.handler) {
                result = mock.handler.apply(context, args);
            } else {
                result = mock.returnValue;
            }
            
            // 后置钩子
            if (mock.afterCall) {
                result = mock.afterCall(result, args, context) ?? result;
            }
            
            this.log('Mock', 'execute', {
                path: path,
                args: this._serializeArgs(args),
                result: this._serializeValue(result)
            });
            
            return { mocked: true, result: result };
        },
        
        // ==================== 属性监控 ====================
        
        /**
         * 监控属性
         */
        watchProperty: function(path, callbacks) {
            this.watchedProperties[path] = callbacks;
            return this;
        },
        
        /**
         * 取消监控
         */
        unwatchProperty: function(path) {
            delete this.watchedProperties[path];
            return this;
        },
        
        /**
         * 触发属性监控回调
         */
        triggerWatch: function(path, type, value, oldValue) {
            const watch = this.watchedProperties[path];
            if (!watch) return;
            
            if (type === 'get' && watch.onAccess) {
                watch.onAccess(value, path);
            }
            if (type === 'set' && watch.onChange) {
                watch.onChange(value, oldValue, path);
            }
        },
        
        // ==================== 调用链管理 ====================
        
        /**
         * 开始调用链
         */
        pushChain: function(name) {
            if (this.callChain.stack.length < this.callChain.maxDepth) {
                this.callChain.stack.push({
                    name: name,
                    timestamp: Date.now()
                });
            }
        },
        
        /**
         * 结束调用链
         */
        popChain: function() {
            return this.callChain.stack.pop();
        },
        
        /**
         * 获取当前调用链
         */
        getChain: function() {
            return this.callChain.stack.map(c => c.name).join(' -> ');
        },
        
        // ==================== 工具方法 ====================
        
        _generateId: function() {
            return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        },
        
        _getStack: function() {
            try {
                throw new Error();
            } catch (e) {
                return e.stack?.split('\n').slice(3, 8).join('\n') || '';
            }
        },
        
        _getLogType: function(category) {
            if (['DOM', 'Element', 'Attribute', 'Style', 'Event'].includes(category)) {
                return 'access';
            }
            if (category === 'Create') return 'create';
            if (category === 'Chain') return 'chain';
            return 'custom';
        },
        
        _serializeValue: function(value) {
            if (value === undefined) return 'undefined';
            if (value === null) return 'null';
            if (typeof value === 'function') return `[Function: ${value.name || 'anonymous'}]`;
            if (typeof value === 'symbol') return value.toString();
            if (typeof value === 'object') {
                try {
                    if (value.__id__) return `[Element: ${value.tagName}#${value.__id__}]`;
                    if (value instanceof Error) return `[Error: ${value.message}]`;
                    if (Array.isArray(value)) return `[Array(${value.length})]`;
                    if (value.nodeType) return `[Node: ${value.nodeName}]`;
                    return `[Object: ${value.constructor?.name || 'Object'}]`;
                } catch (e) {
                    return '[Object]';
                }
            }
            const str = String(value);
            return str.length > 200 ? str.substring(0, 200) + '...' : str;
        },
        
        _serializeArgs: function(args) {
            if (!args || !args.length) return [];
            return Array.from(args).map(arg => this._serializeValue(arg));
        },
        
        // ==================== 查询接口 ====================
        
        /**
         * 获取所有日志
         */
        getAllLogs: function() {
            return { ...this.logs };
        },
        
        /**
         * 获取 undefined 列表
         */
        getUndefinedList: function(unfixedOnly = true) {
            if (unfixedOnly) {
                return this.logs.undefined.filter(l => !l.fixed);
            }
            return this.logs.undefined;
        },
        
        /**
         * 标记 undefined 已修复
         */
        markFixed: function(path, fixedBy = 'manual') {
            const entry = this.logs.undefined.find(l => l.path === path);
            if (entry) {
                entry.fixed = true;
                entry.fixedBy = fixedBy;
                entry.fixedAt = Date.now();
            }
            return this;
        },
        
        /**
         * 获取方法调用日志
         */
        getCalls: function(filter = {}) {
            let calls = this.logs.calls;
            if (filter.path) {
                calls = calls.filter(c => c.path.includes(filter.path));
            }
            if (filter.since) {
                calls = calls.filter(c => c.timestamp >= filter.since);
            }
            return calls;
        },
        
        /**
         * 获取元素创建日志
         */
        getCreateLogs: function(tagName = null) {
            if (tagName) {
                return this.logs.create.filter(l => 
                    l.tagName.toUpperCase() === tagName.toUpperCase()
                );
            }
            return this.logs.create;
        },
        
        /**
         * 获取统计信息
         */
        getStats: function() {
            return {
                totalLogs: Object.values(this.logs).reduce((sum, arr) => sum + arr.length, 0),
                accessLogs: this.logs.access.length,
                callLogs: this.logs.calls.length,
                createLogs: this.logs.create.length,
                undefinedCount: this.logs.undefined.length,
                unfixedUndefined: this.logs.undefined.filter(l => !l.fixed).length,
                elementsCreated: this.elements.created.size,
                mocksActive: Object.keys(this.mocks).filter(k => this.mocks[k].enabled).length,
                watchedProperties: Object.keys(this.watchedProperties).length
            };
        },
        
        /**
         * 清空日志
         */
        clear: function(type = null) {
            if (type && this.logs[type]) {
                this.logs[type] = [];
            } else {
                Object.keys(this.logs).forEach(k => this.logs[k] = []);
            }
            return this;
        },
        
        /**
         * 导出日志
         */
        export: function() {
            return {
                version: this.version,
                timestamp: Date.now(),
                config: this.config,
                logs: this.logs,
                mocks: Object.keys(this.mocks).map(k => ({
                    path: k,
                    enabled: this.mocks[k].enabled,
                    callCount: this.mocks[k].callCount
                })),
                stats: this.getStats()
            };
        }
    };
    
    // ==================== 创建代理元素的工厂函数 ====================
    window.__createMonitoredElement__ = function(Constructor, tagName, options) {
        const element = new Constructor(tagName);
        
        // 记录创建
        __EnvMonitor__.logCreate(tagName, element, options);
        
        // 创建代理以监控后续操作
        return new Proxy(element, {
            get: function(target, prop, receiver) {
                const value = Reflect.get(target, prop, receiver);
                
                // 记录方法调用
                if (typeof value === 'function' && !prop.startsWith('_')) {
                    return function(...args) {
                        __EnvMonitor__.pushChain(`${tagName}.${prop}`);
                        
                        // 检查 mock
                        const mockPath = `element.${prop}`;
                        const mockResult = __EnvMonitor__.executeMock(mockPath, args, target);
                        
                        if (mockResult.mocked) {
                            __EnvMonitor__.popChain();
                            return mockResult.result;
                        }
                        
                        const startTime = Date.now();
                        const result = value.apply(target, args);
                        const duration = Date.now() - startTime;
                        
                        __EnvMonitor__.logCall(`${tagName}.${prop}`, args, result, duration);
                        __EnvMonitor__.popChain();
                        
                        return result;
                    };
                }
                
                // 检查 undefined
                if (value === undefined && !prop.startsWith('_') && typeof prop === 'string') {
                    __EnvMonitor__.logUndefined(`${tagName}.${prop}`, 'element property', tagName);
                }
                
                return value;
            },
            
            set: function(target, prop, value, receiver) {
                __EnvMonitor__.log('Element', 'setProperty', {
                    tagName: tagName,
                    elementId: target.__id__,
                    property: prop,
                    value: __EnvMonitor__._serializeValue(value)
                });
                
                __EnvMonitor__.triggerWatch(`${tagName}.${prop}`, 'set', value, target[prop]);
                
                return Reflect.set(target, prop, value, receiver);
            }
        });
    };
    
    // ==================== 暴露到全局 ====================
    window.__EnvMonitor__ = __EnvMonitor__;
    
    // 兼容旧版 API
    window.__envMonitor__ = __EnvMonitor__;
    
    // 便捷方法
    window.__setMock__ = function(path, config) {
        return __EnvMonitor__.setMock(path, config);
    };
    
    window.__getMock__ = function(path) {
        return __EnvMonitor__.getMock(path);
    };
    
    window.__getUndefined__ = function() {
        return __EnvMonitor__.getUndefinedList();
    };
    
    window.__getStats__ = function() {
        return __EnvMonitor__.getStats();
    };
    
})();
