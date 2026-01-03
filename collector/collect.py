#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DrissionPage 浏览器环境采集器

使用 DrissionPage 自动化浏览器，采集浏览器环境信息，
输出标准化 JSON 模板供 Node.js 沙箱使用。

安装依赖:
    pip install DrissionPage

使用方法:
    python collect.py [url] [--output output.json] [--browser chrome|edge]
"""

import json
import sys
import argparse
from datetime import datetime
from pathlib import Path

try:
    from DrissionPage import ChromiumPage, ChromiumOptions
except ImportError:
    print("请先安装 DrissionPage: pip install DrissionPage")
    sys.exit(1)


class BrowserEnvCollector:
    """浏览器环境采集器"""
    
    def __init__(self, browser='chrome', headless=True):
        """
        初始化采集器
        
        Args:
            browser: 浏览器类型 ('chrome' 或 'edge')
            headless: 是否无头模式
        """
        self.browser = browser
        self.headless = headless
        self.page = None
        
    def start(self):
        """启动浏览器"""
        options = ChromiumOptions()
        
        if self.headless:
            options.headless(True)
        
        # 设置浏览器路径（根据系统调整）
        if self.browser == 'edge':
            options.set_browser_path('msedge')
        
        # 禁用一些可能影响环境采集的功能
        options.set_argument('--disable-blink-features=AutomationControlled')
        options.set_argument('--no-sandbox')
        options.set_argument('--disable-dev-shm-usage')
        
        self.page = ChromiumPage(addr_or_opts=options)
        
    def stop(self):
        """关闭浏览器"""
        if self.page:
            self.page.quit()
            
    def navigate(self, url):
        """导航到指定URL"""
        self.page.get(url)
    
    def _run_js(self, script):
        """安全执行JS并返回结果"""
        try:
            result = self.page.run_js(script)
            return result
        except Exception as e:
            print(f"JS执行错误: {e}")
            return None
        
    def collect_navigator(self):
        """采集 navigator 对象"""
        script = """
        return (function() {
            const nav = {};
            const props = [
                'userAgent', 'appCodeName', 'appName', 'appVersion',
                'platform', 'product', 'productSub', 'vendor', 'vendorSub',
                'language', 'languages', 'onLine', 'cookieEnabled',
                'doNotTrack', 'hardwareConcurrency', 'maxTouchPoints',
                'deviceMemory', 'webdriver'
            ];
            
            props.forEach(prop => {
                try {
                    const value = navigator[prop];
                    if (value !== undefined) {
                        if (Array.isArray(value)) {
                            nav[prop] = Array.from(value);
                        } else {
                            nav[prop] = value;
                        }
                    }
                } catch(e) {}
            });
            
            // 采集方法列表
            nav.__methods__ = [];
            for (let key in navigator) {
                if (typeof navigator[key] === 'function') {
                    nav.__methods__.push(key);
                }
            }
            
            // 采集 connection
            if (navigator.connection) {
                nav.connection = {
                    downlink: navigator.connection.downlink,
                    effectiveType: navigator.connection.effectiveType,
                    rtt: navigator.connection.rtt,
                    saveData: navigator.connection.saveData
                };
            }
            
            // 采集 userAgentData
            if (navigator.userAgentData) {
                nav.userAgentData = {
                    brands: navigator.userAgentData.brands,
                    mobile: navigator.userAgentData.mobile,
                    platform: navigator.userAgentData.platform
                };
            }
            
            return nav;
        })()
        """
        return self._run_js(script) or {}
        
    def collect_screen(self):
        """采集 screen 对象"""
        script = """
        return (function() {
            return {
                width: screen.width,
                height: screen.height,
                availWidth: screen.availWidth,
                availHeight: screen.availHeight,
                availLeft: screen.availLeft || 0,
                availTop: screen.availTop || 0,
                colorDepth: screen.colorDepth,
                pixelDepth: screen.pixelDepth,
                orientation: screen.orientation ? {
                    angle: screen.orientation.angle,
                    type: screen.orientation.type
                } : null
            };
        })()
        """
        return self._run_js(script) or {}
        
    def collect_window(self):
        """采集 window 对象"""
        script = """
        return (function() {
            return {
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                outerWidth: window.outerWidth,
                outerHeight: window.outerHeight,
                screenX: window.screenX,
                screenY: window.screenY,
                screenLeft: window.screenLeft,
                screenTop: window.screenTop,
                pageXOffset: window.pageXOffset,
                pageYOffset: window.pageYOffset,
                devicePixelRatio: window.devicePixelRatio,
                isSecureContext: window.isSecureContext,
                origin: window.origin
            };
        })()
        """
        return self._run_js(script) or {}
        
    def collect_document(self):
        """采集 document 对象"""
        script = """
        return (function() {
            return {
                title: document.title,
                domain: document.domain,
                URL: document.URL,
                documentURI: document.documentURI,
                baseURI: document.baseURI,
                referrer: document.referrer,
                characterSet: document.characterSet,
                charset: document.charset,
                inputEncoding: document.inputEncoding,
                contentType: document.contentType,
                readyState: document.readyState,
                hidden: document.hidden,
                visibilityState: document.visibilityState,
                __methods__: ['createElement', 'createTextNode', 'getElementById', 
                             'getElementsByClassName', 'getElementsByTagName',
                             'querySelector', 'querySelectorAll']
            };
        })()
        """
        return self._run_js(script) or {}
        
    def collect_location(self):
        """采集 location 对象"""
        script = """
        return (function() {
            return {
                href: location.href,
                protocol: location.protocol,
                host: location.host,
                hostname: location.hostname,
                port: location.port,
                pathname: location.pathname,
                search: location.search,
                hash: location.hash,
                origin: location.origin
            };
        })()
        """
        return self._run_js(script) or {}
        
    def collect_performance(self):
        """采集 performance 对象"""
        script = """
        return (function() {
            const timing = performance.timing;
            return {
                timeOrigin: performance.timeOrigin,
                timing: timing ? {
                    navigationStart: timing.navigationStart,
                    domLoading: timing.domLoading,
                    domInteractive: timing.domInteractive,
                    domComplete: timing.domComplete,
                    loadEventEnd: timing.loadEventEnd
                } : null,
                memory: performance.memory ? {
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    usedJSHeapSize: performance.memory.usedJSHeapSize
                } : null
            };
        })()
        """
        return self._run_js(script) or {}
        
    def collect_plugins(self):
        """采集 plugins 信息"""
        script = """
        return (function() {
            const plugins = [];
            for (let i = 0; i < navigator.plugins.length; i++) {
                const plugin = navigator.plugins[i];
                plugins.push({
                    name: plugin.name,
                    filename: plugin.filename,
                    description: plugin.description
                });
            }
            return plugins;
        })()
        """
        return self._run_js(script) or []
        
    def collect_webgl(self):
        """采集 WebGL 信息"""
        script = """
        return (function() {
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (!gl) return null;
                
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                return {
                    vendor: gl.getParameter(gl.VENDOR),
                    renderer: gl.getParameter(gl.RENDERER),
                    unmaskedVendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
                    unmaskedRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
                    version: gl.getParameter(gl.VERSION),
                    shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
                    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
                    maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS)
                };
            } catch(e) {
                return null;
            }
        })()
        """
        return self._run_js(script)
        
    def collect_canvas_fingerprint(self):
        """采集 Canvas 指纹"""
        script = """
        return (function() {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 200;
                canvas.height = 50;
                const ctx = canvas.getContext('2d');
                
                ctx.textBaseline = 'top';
                ctx.font = '14px Arial';
                ctx.fillStyle = '#f60';
                ctx.fillRect(0, 0, 100, 50);
                ctx.fillStyle = '#069';
                ctx.fillText('Canvas Fingerprint', 2, 15);
                ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
                ctx.fillText('Canvas Fingerprint', 4, 17);
                
                return canvas.toDataURL();
            } catch(e) {
                return null;
            }
        })()
        """
        return self._run_js(script)
        
    def collect_audio_context(self):
        """采集 AudioContext 信息"""
        script = """
        return (function() {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return null;
                
                const ctx = new AudioContext();
                return {
                    sampleRate: ctx.sampleRate,
                    state: ctx.state,
                    baseLatency: ctx.baseLatency,
                    outputLatency: ctx.outputLatency
                };
            } catch(e) {
                return null;
            }
        })()
        """
        return self._run_js(script)
        
    def collect_all(self, url=None):
        """
        采集所有环境信息
        
        Args:
            url: 要访问的URL（可选）
            
        Returns:
            dict: 采集到的环境信息
        """
        self.start()
        
        try:
            if url:
                self.navigate(url)
                # 等待页面加载完成
                self.page.wait.doc_loaded()
            else:
                # 访问空白页
                self.navigate('about:blank')
                
            # 获取浏览器信息
            browser_info = self._run_js("""
            return (function() {
                const ua = navigator.userAgent;
                let browser = 'Unknown';
                let version = '';
                
                if (ua.includes('Chrome')) {
                    browser = 'Chrome';
                    version = ua.match(/Chrome\\/(\\d+\\.\\d+\\.\\d+\\.\\d+)/)?.[1] || '';
                } else if (ua.includes('Firefox')) {
                    browser = 'Firefox';
                    version = ua.match(/Firefox\\/(\\d+\\.\\d+)/)?.[1] || '';
                } else if (ua.includes('Edge')) {
                    browser = 'Edge';
                    version = ua.match(/Edge\\/(\\d+\\.\\d+)/)?.[1] || '';
                }
                
                return { browser: browser, version: version };
            })()
            """)
            
            # 确保 browser_info 不为 None
            if browser_info is None:
                browser_info = {'browser': 'Unknown', 'version': ''}
            
            result = {
                "browser": browser_info.get('browser', 'Unknown'),
                "version": browser_info.get('version', ''),
                "collectedAt": datetime.utcnow().isoformat() + 'Z',
                "sourceUrl": url or 'about:blank',
                "objects": {
                    "navigator": self.collect_navigator(),
                    "screen": self.collect_screen(),
                    "window": self.collect_window(),
                    "document": self.collect_document(),
                    "location": self.collect_location(),
                    "performance": self.collect_performance()
                },
                "plugins": self.collect_plugins(),
                "webgl": self.collect_webgl(),
                "canvas": self.collect_canvas_fingerprint(),
                "audioContext": self.collect_audio_context()
            }
            
            return result
            
        finally:
            self.stop()
            
    def save_to_file(self, data, output_path):
        """
        保存采集结果到文件
        
        Args:
            data: 采集的数据
            output_path: 输出文件路径
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        print(f"环境信息已保存到: {output_path}")


def generate_env_code(template_data):
    """
    根据采集模板生成环境代码
    
    Args:
        template_data: 采集的环境数据
        
    Returns:
        str: 生成的JavaScript环境代码
    """
    code_lines = [
        "/**",
        f" * 自动生成的浏览器环境代码",
        f" * 浏览器: {template_data.get('browser', 'Unknown')} {template_data.get('version', '')}",
        f" * 采集时间: {template_data.get('collectedAt', '')}",
        f" * 来源URL: {template_data.get('sourceUrl', '')}",
        " */",
        "",
        "(function() {",
    ]
    
    # 生成 navigator
    nav_data = template_data.get('objects', {}).get('navigator', {})
    if nav_data:
        code_lines.append("    // Navigator")
        code_lines.append("    const navigatorProps = " + json.dumps(nav_data, indent=8) + ";")
        code_lines.append("    Object.keys(navigatorProps).forEach(key => {")
        code_lines.append("        if (key !== '__methods__' && key !== 'connection' && key !== 'userAgentData') {")
        code_lines.append("            Object.defineProperty(window.navigator, key, {")
        code_lines.append("                get: function() { return navigatorProps[key]; },")
        code_lines.append("                configurable: true")
        code_lines.append("            });")
        code_lines.append("        }")
        code_lines.append("    });")
        code_lines.append("")
    
    # 生成 screen
    screen_data = template_data.get('objects', {}).get('screen', {})
    if screen_data:
        code_lines.append("    // Screen")
        code_lines.append("    const screenProps = " + json.dumps(screen_data, indent=8) + ";")
        code_lines.append("    Object.assign(window.screen, screenProps);")
        code_lines.append("")
    
    # 生成 window 属性
    window_data = template_data.get('objects', {}).get('window', {})
    if window_data:
        code_lines.append("    // Window")
        code_lines.append("    const windowProps = " + json.dumps(window_data, indent=8) + ";")
        code_lines.append("    Object.assign(window, windowProps);")
        code_lines.append("")
    
    code_lines.append("})();")
    
    return "\n".join(code_lines)


def main():
    parser = argparse.ArgumentParser(description='DrissionPage 浏览器环境采集器')
    parser.add_argument('url', nargs='?', default=None, help='要访问的URL')
    parser.add_argument('--output', '-o', default='templates/env_template.json', help='输出文件路径')
    parser.add_argument('--browser', '-b', choices=['chrome', 'edge'], default='chrome', help='浏览器类型')
    parser.add_argument('--headless', action='store_true', default=True, help='无头模式')
    parser.add_argument('--no-headless', dest='headless', action='store_false', help='有头模式')
    parser.add_argument('--gen-code', action='store_true', help='同时生成环境代码')
    
    args = parser.parse_args()
    
    print(f"开始采集浏览器环境...")
    print(f"浏览器: {args.browser}")
    print(f"目标URL: {args.url or 'about:blank'}")
    print(f"无头模式: {args.headless}")
    
    collector = BrowserEnvCollector(browser=args.browser, headless=args.headless)
    
    try:
        data = collector.collect_all(args.url)
        collector.save_to_file(data, args.output)
        
        # 打印摘要
        print("\n=== 采集摘要 ===")
        print(f"浏览器: {data['browser']} {data['version']}")
        nav = data.get('objects', {}).get('navigator', {})
        screen = data.get('objects', {}).get('screen', {})
        print(f"UserAgent: {nav.get('userAgent', 'N/A')[:80]}...")
        print(f"平台: {nav.get('platform', 'N/A')}")
        print(f"屏幕: {screen.get('width', 'N/A')}x{screen.get('height', 'N/A')}")
        print(f"Plugins: {len(data.get('plugins', []))} 个")
        print(f"WebGL: {'支持' if data.get('webgl') else '不支持'}")
        
        # 生成环境代码
        if args.gen_code:
            code = generate_env_code(data)
            code_path = Path(args.output).with_suffix('.js')
            with open(code_path, 'w', encoding='utf-8') as f:
                f.write(code)
            print(f"\n环境代码已生成: {code_path}")
            
    except Exception as e:
        print(f"采集失败: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
