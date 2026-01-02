/**
 * 沙箱管理器
 * 基于isolated-vm实现安全的JS执行环境
 * 支持环境注入、快照保存/加载
 */

import ivm from 'isolated-vm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProxyLogger } from './ProxyLogger.js';
import { DeepProxy } from './DeepProxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_DIR = path.join(__dirname, '../../env');
const SNAPSHOTS_DIR = path.join(__dirname, '../../snapshots');

export class SandboxManager {
    constructor() {
        this.isolate = null;
        this.context = null;
        this.logger = new ProxyLogger();
        this.deepProxy = new DeepProxy(this.logger);
        this.loadedEnvFiles = [];
    }

    /**
     * 初始化沙箱
     */
    async init(options = {}) {
        const { memoryLimit = 128 } = options;

        // 创建隔离环境
        this.isolate = new ivm.Isolate({ memoryLimit });
        this.context = await this.isolate.createContext();

        // 获取全局对象
        const jail = this.context.global;
        
        // 设置全局引用
        await jail.set('global', jail.derefInto());
        
        // 注入基础环境
        await this._injectBaseEnvironment(jail);
        
        // 注入日志回调
        await this._injectLogCallback(jail);

        return this;
    }

    /**
     * 注入基础环境
     */
    async _injectBaseEnvironment(jail) {
        // 注入console
        const consoleObj = {
            log: new ivm.Callback((...args) => {
                console.log('[Sandbox]', ...args);
            }),
            error: new ivm.Callback((...args) => {
                console.error('[Sandbox Error]', ...args);
            }),
            warn: new ivm.Callback((...args) => {
                console.warn('[Sandbox Warn]', ...args);
            }),
            info: new ivm.Callback((...args) => {
                console.info('[Sandbox Info]', ...args);
            })
        };

        await jail.set('console', consoleObj, { copy: true });

        // 注入基础函数
        await jail.set('setTimeout', new ivm.Callback((fn, delay) => {
            // 简化实现，实际需要更复杂的处理
            return 0;
        }));

        await jail.set('setInterval', new ivm.Callback((fn, delay) => {
            return 0;
        }));

        await jail.set('clearTimeout', new ivm.Callback((id) => {}));
        await jail.set('clearInterval', new ivm.Callback((id) => {}));

        // 注入环境初始化代码
        const initCode = `
            // 创建window对象
            const window = global;
            global.window = window;
            global.self = window;
            global.globalThis = window;

            // 基础undefined记录
            const __undefinedPaths__ = [];
            global.__recordUndefined__ = function(path) {
                if (!__undefinedPaths__.includes(path)) {
                    __undefinedPaths__.push(path);
                }
            };
            global.__getUndefinedPaths__ = function() {
                return __undefinedPaths__;
            };

            // Proxy工厂函数
            global.__createProxy__ = function(obj, path) {
                const seen = new WeakSet();
                
                function createProxy(target, currentPath) {
                    if (target === null || target === undefined) return target;
                    if (typeof target !== 'object' && typeof target !== 'function') return target;
                    if (seen.has(target)) return target;
                    seen.add(target);

                    return new Proxy(target, {
                        get(t, prop) {
                            if (typeof prop === 'symbol') return t[prop];
                            const fullPath = currentPath ? currentPath + '.' + String(prop) : String(prop);
                            const value = t[prop];
                            
                            if (value === undefined && !(prop in t)) {
                                __recordUndefined__(fullPath);
                            }
                            
                            if (value !== null && typeof value === 'object') {
                                return createProxy(value, fullPath);
                            }
                            return value;
                        },
                        set(t, prop, value) {
                            t[prop] = value;
                            return true;
                        }
                    });
                }
                
                return createProxy(obj, path);
            };
        `;

        await this.context.eval(initCode);
    }

    /**
     * 注入日志回调
     */
    async _injectLogCallback(jail) {
        const logger = this.logger;
        
        await jail.set('__logUndefined__', new ivm.Callback((path, context) => {
            logger.logUndefined(path, context);
        }));

        await jail.set('__logAccess__', new ivm.Callback((type, path, value) => {
            logger.logAccess(type, path, value);
        }));
    }

    /**
     * 加载环境文件
     */
    async loadEnvFile(filePath) {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(ENV_DIR, filePath);
        
        if (!fs.existsSync(fullPath)) {
            throw new Error(`Environment file not found: ${fullPath}`);
        }

        const code = fs.readFileSync(fullPath, 'utf-8');
        
        try {
            await this.context.eval(code);
            this.loadedEnvFiles.push(filePath);
            return { success: true, file: filePath };
        } catch (e) {
            return { success: false, file: filePath, error: e.message };
        }
    }

    /**
     * 加载所有环境文件
     */
    async loadAllEnvFiles() {
        const results = [];
        
        // 加载顺序：core (监控系统) -> bom -> dom -> webapi -> encoding -> timer -> ai-generated
        // core 必须首先加载，因为其他模块依赖监控系统
        const order = ['core', 'bom', 'dom', 'webapi', 'encoding', 'timer', 'ai-generated'];
        
        for (const category of order) {
            const categoryPath = path.join(ENV_DIR, category);
            if (fs.existsSync(categoryPath)) {
                let files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
                
                // core 目录：确保 MonitorSystem.js 首先加载
                if (category === 'core') {
                    // MonitorSystem 必须第一个加载
                    const monitorFile = files.find(f => f === 'MonitorSystem.js');
                    if (monitorFile) {
                        const result = await this.loadEnvFile(path.join(category, monitorFile));
                        results.push(result);
                    }
                    // 加载其他 core 文件（排除 _index.js 和已加载的 MonitorSystem.js）
                    files = files.filter(f => f !== 'MonitorSystem.js' && f !== '_index.js');
                }
                
                // ai-generated目录先加载_index.js
                if (category === 'ai-generated') {
                    const indexFile = files.find(f => f === '_index.js');
                    if (indexFile) {
                        const result = await this.loadEnvFile(path.join(category, indexFile));
                        results.push(result);
                    }
                    continue;
                }
                
                // 其他目录正常加载（排除 _index.js）
                files = files.filter(f => f !== '_index.js');
                
                for (const file of files) {
                    const result = await this.loadEnvFile(path.join(category, file));
                    results.push(result);
                }
            }
        }

        return results;
    }

    /**
     * 注入代码
     */
    async inject(code) {
        try {
            await this.context.eval(code);
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * 执行代码
     */
    async execute(code, options = {}) {
        const { timeout = 5000 } = options;
        
        const startTime = Date.now();
        
        try {
            const script = await this.isolate.compileScript(code);
            const result = await script.run(this.context, { timeout });
            
            return {
                success: true,
                result: this._serializeResult(result),
                duration: Date.now() - startTime,
                undefinedPaths: await this._getUndefinedPaths(),
                logs: this.logger.getAllLogs()
            };
        } catch (e) {
            return {
                success: false,
                error: e.message,
                stack: e.stack,
                duration: Date.now() - startTime,
                undefinedPaths: await this._getUndefinedPaths(),
                logs: this.logger.getAllLogs()
            };
        }
    }

    /**
     * 获取undefined路径列表
     */
    async _getUndefinedPaths() {
        try {
            const result = await this.context.eval('__getUndefinedPaths__()');
            return result;
        } catch (e) {
            return [];
        }
    }

    /**
     * 序列化执行结果
     */
    _serializeResult(result) {
        if (result === undefined) return 'undefined';
        if (result === null) return 'null';
        if (typeof result === 'function') return `[Function: ${result.name || 'anonymous'}]`;
        if (typeof result === 'symbol') return result.toString();
        if (typeof result === 'object') {
            try {
                return JSON.stringify(result, null, 2);
            } catch (e) {
                return `[Object: ${result.constructor?.name || 'Object'}]`;
            }
        }
        return String(result);
    }

    /**
     * 保存快照
     */
    async saveSnapshot(name) {
        if (!fs.existsSync(SNAPSHOTS_DIR)) {
            fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
        }

        const snapshot = {
            name,
            createdAt: new Date().toISOString(),
            loadedEnvFiles: this.loadedEnvFiles,
            undefinedLogs: this.logger.undefinedLogs,
            // 注意：isolated-vm不支持完整状态序列化，这里只保存配置信息
        };

        const snapshotPath = path.join(SNAPSHOTS_DIR, `${name}.json`);
        fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

        return { success: true, path: snapshotPath };
    }

    /**
     * 加载快照
     */
    async loadSnapshot(name) {
        const snapshotPath = path.join(SNAPSHOTS_DIR, `${name}.json`);
        
        if (!fs.existsSync(snapshotPath)) {
            throw new Error(`Snapshot not found: ${name}`);
        }

        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));

        // 重新初始化沙箱
        await this.dispose();
        await this.init();

        // 加载快照中记录的环境文件
        for (const file of snapshot.loadedEnvFiles) {
            await this.loadEnvFile(file);
        }

        return { success: true, snapshot };
    }

    /**
     * 列出所有快照
     */
    listSnapshots() {
        if (!fs.existsSync(SNAPSHOTS_DIR)) {
            return [];
        }

        return fs.readdirSync(SNAPSHOTS_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const content = JSON.parse(fs.readFileSync(path.join(SNAPSHOTS_DIR, f), 'utf-8'));
                return {
                    name: content.name,
                    createdAt: content.createdAt,
                    envFilesCount: content.loadedEnvFiles?.length || 0
                };
            });
    }

    /**
     * 删除快照
     */
    deleteSnapshot(name) {
        const snapshotPath = path.join(SNAPSHOTS_DIR, `${name}.json`);
        
        if (fs.existsSync(snapshotPath)) {
            fs.unlinkSync(snapshotPath);
            return { success: true };
        }
        
        return { success: false, error: 'Snapshot not found' };
    }

    /**
     * 获取日志记录器
     */
    getLogger() {
        return this.logger;
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            loadedEnvFiles: this.loadedEnvFiles,
            loggerStats: this.logger.getStats(),
            memoryUsage: this.isolate?.getHeapStatisticsSync()
        };
    }

    /**
     * 重置沙箱
     */
    async reset() {
        await this.dispose();
        this.logger.clear();
        this.loadedEnvFiles = [];
        await this.init();
    }

    /**
     * 销毁沙箱
     */
    async dispose() {
        if (this.context) {
            this.context.release();
            this.context = null;
        }
        if (this.isolate) {
            this.isolate.dispose();
            this.isolate = null;
        }
    }
}

export default SandboxManager;
