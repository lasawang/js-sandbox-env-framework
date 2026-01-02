/**
 * @env-module core/_index
 * @description 核心模块索引 - 必须首先加载
 * @priority 0 (最高优先级)
 */

// 核心模块加载顺序：
// 1. MonitorSystem - 监控系统基础设施
// 2. 其他核心模块

// 该文件用于标记 core 目录需要首先加载
// SandboxManager 会自动处理加载顺序
