import {reactRouter} from "@react-router/dev/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import type {ViteDevServer} from "vite";
import {defineConfig} from 'vite';
import {exec} from 'child_process';
import {promisify} from 'util';
import {closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, writeFileSync} from 'fs';
import path from 'path';
import {createHash} from 'crypto';

const execAsync = promisify(exec);

// =================================================================
// 1. 共享配置与常量 (Shared Configuration & Constants)
// =================================================================
// 将所有路径和常量集中管理，提高可读性和可维护性
const SHARED_CONFIG = {
    protoDir: 'app/proto',
    generatedDir: 'app/generated',
    textProtoInputDir: 'app/assets/txtpb',
    binaryOutputDir: 'public/pb',
    cacheFilePath: path.join('node_modules', '.vite-plugin-cache', 'proto-build-cache.json'),
};
// 生成最终文件路径
const JS_OUTPUT_FILE = path.resolve(SHARED_CONFIG.generatedDir, 'bundle.js');
const TS_OUTPUT_FILE = path.resolve(SHARED_CONFIG.generatedDir, 'bundle.d.ts');


// =================================================================
// 2. 专业的缓存管理器 (Production-Ready Cache Manager)
// =================================================================
// 将所有缓存读写逻辑封装到一个类中，使插件代码更干净
class CacheManager {
    private cache: {
        protoSourceHash: string | null;
        txtpbSourceHashes: Record<string, string>;
    } = {protoSourceHash: null, txtpbSourceHashes: {}};
    private cachePath: string;

    constructor(cachePath: string) {
        this.cachePath = cachePath;
        this.load();
    }

    private load() {
        if (!existsSync(this.cachePath)) {
            console.log('[CacheManager] Cache file not found. Starting with a fresh cache.');
            return;
        }
        try {
            const data = readFileSync(this.cachePath, 'utf-8');
            this.cache = JSON.parse(data);
            console.log('[CacheManager] Successfully loaded build cache from disk.');
        } catch (e) {
            console.error('[CacheManager] Error reading cache file. A new one will be created.', e);
            this.cache = {protoSourceHash: null, txtpbSourceHashes: {}};
        }
    }

    save() {
        const dir = path.dirname(this.cachePath);
        if (!existsSync(dir)) {
            mkdirSync(dir, {recursive: true});
        }
        writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2));
    }

    getProtoHash() {
        return this.cache.protoSourceHash;
    }

    setProtoHash(hash: string | null) {
        this.cache.protoSourceHash = hash;
    }

    getTxtpbHash(filePath: string) {
        return this.cache.txtpbSourceHashes[filePath];
    }

    setTxtpbHash(filePath: string, hash: string) {
        this.cache.txtpbSourceHashes[filePath] = hash;
    }

    clearTxtpbHashes() {
        this.cache.txtpbSourceHashes = {};
    }
}

// 单例缓存实例 (Singleton cache instance)
const cacheManager = new CacheManager(SHARED_CONFIG.cacheFilePath);

// 辅助函数: 计算文件哈希
function getFileHash(filePath: string): string | null {
    if (!existsSync(filePath)) return null;
    return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}


// =================================================================
// 3. 插件实现 (Plugin Implementations)
// =================================================================

// --- 插件1: 编译 .proto 为 JS (已重构) ---
function protobufjsPlugin() {
    function getProtosHash(): string {
        const protoFiles = readdirSync(SHARED_CONFIG.protoDir, {withFileTypes: true})
            .filter(dirent => dirent.isFile() && dirent.name.endsWith('.proto'))
            .map(dirent => path.join(SHARED_CONFIG.protoDir, dirent.name))
            .sort();
        const hash = createHash('sha256');
        for (const file of protoFiles) {
            hash.update(readFileSync(file));
        }
        return hash.digest('hex');
    }

    async function buildProtos() {
        console.log('[protobufjsPlugin] Checking for build...');
        const currentHash = getProtosHash();
        const cachedHash = cacheManager.getProtoHash();

        // 核心逻辑: 如果哈希值相同且输出文件已存在，则跳过
        if (currentHash === cachedHash && existsSync(JS_OUTPUT_FILE)) {
            console.log('[protobufjsPlugin] Source files unchanged and output exists. Skipping build.');
            return;
        }

        if (!existsSync(SHARED_CONFIG.generatedDir)) {
            mkdirSync(SHARED_CONFIG.generatedDir, {recursive: true});
        }
        const command = `npx pbjs -t static-module -w es6 -o ${JS_OUTPUT_FILE} ${SHARED_CONFIG.protoDir}/**/*.proto && npx pbts -o ${TS_OUTPUT_FILE} ${JS_OUTPUT_FILE}`;

        try {
            console.log('Building protobuf JS/TS files...');
            const {stdout, stderr} = await execAsync(command);
            if (stdout) console.log(stdout);
            if (stderr) console.error(stderr);

            cacheManager.setProtoHash(currentHash);
            cacheManager.save();
            console.log('Protobuf JS/TS files built successfully.');
        } catch (e) {
            console.error('Error building protobuf JS/TS files:', e);
            cacheManager.setProtoHash(null); // 失败时使缓存失效
            cacheManager.save();
        }
    }

    return {
        name: 'vite-plugin-protobuf-transform',
        buildStart: buildProtos,
        configureServer(server: ViteDevServer) {
            server.watcher.add(`${SHARED_CONFIG.protoDir}/**/*.proto`);
            server.watcher.on('change', async (filePath) => {
                if (filePath.endsWith('.proto')) {
                    console.log(`File ${filePath} has changed. Rebuilding JS/TS...`);
                    await buildProtos();
                    server.ws.send({ type: 'full-reload', path: '*' });
                }
            });
        },
        transform(code, id) {
            if (id === JS_OUTPUT_FILE) {
                console.log(`Transforming ${path.basename(id)} for Vite compatibility...`);
                return {
                    code: code.replace('import * as $protobuf from "protobufjs/minimal";', 'import $protobuf from "protobufjs/minimal.js";'),
                    map: null
                };
            }
            return null;
        }
    };
}


// --- 插件2: 智能转换 .txtpb 为 .pb (已重构) ---
function textProtoToBinaryPlugin() {
    function parseProtoHeader(filePath: string) {
        // ... 此函数内部逻辑无需修改 ...
        const buffer = Buffer.alloc(1024);
        const fd = openSync(filePath, 'r');
        try {
            readSync(fd, buffer, 0, 1024, 0);
        } finally {
            closeSync(fd);
        }
        const content = buffer.toString('utf-8');
        let protoFile = null, messageType = null;
        const fileRegex = /#\s*proto-file:\s*(.+)/;
        const messageRegex = /#\s*proto-message:\s*(.+)/;
        for (const line of content.split('\n')) {
            const fileMatch = line.match(fileRegex);
            if (fileMatch) protoFile = fileMatch[1].trim();
            const messageMatch = line.match(messageRegex);
            if (messageMatch) messageType = messageMatch[1].trim();
            if (protoFile && messageType) break;
        }
        if (!protoFile || !messageType) return null;
        return { protoFile, messageType };
    }

    async function convertFile(filePath: string): Promise<boolean> {
        if (!filePath.endsWith('.txtpb')) return false;

        const currentHash = getFileHash(filePath);
        const cachedHash = cacheManager.getTxtpbHash(filePath);
        const baseName = path.basename(filePath, '.txtpb');
        const outputFile = path.join(SHARED_CONFIG.binaryOutputDir, `${baseName}.pb`);

        if (currentHash && currentHash === cachedHash && existsSync(outputFile)) {
            return false; // 无需转换
        }

        const header = parseProtoHeader(filePath);
        if (!header) {
            console.warn(`[SKIPPING] File ${baseName} is missing header.`);
            return false;
        }

        const command = `protoc --proto_path=${SHARED_CONFIG.protoDir} --encode=${header.messageType} ${header.protoFile} < ${filePath} > ${outputFile}`;

        try {
            console.log(`[CONVERTING] ${baseName}.txtpb (using ${header.messageType})`);
            const {stderr} = await execAsync(command);
            if (stderr) console.log(`[protoc info for ${baseName}.pb]:\n${stderr}`);
            if (currentHash) cacheManager.setTxtpbHash(filePath, currentHash);
            console.log(`[CONVERTED] ${baseName}.txtpb`);
            return true; // 已转换
        } catch (e) {
            console.error(`[ERROR] Failed to convert ${baseName}:\n`, e.stderr || e);
            return true; // 发生错误也视为“变化”，以触发重载
        }
    }

    async function convertAllFiles(force = false) {
        if (!existsSync(SHARED_CONFIG.textProtoInputDir)) return;
        if (force) cacheManager.clearTxtpbHashes();
        mkdirSync(SHARED_CONFIG.binaryOutputDir, {recursive: true});

        const files = readdirSync(SHARED_CONFIG.textProtoInputDir);
        for (const file of files) {
            await convertFile(path.join(SHARED_CONFIG.textProtoInputDir, file));
        }
        cacheManager.save();
    }

    return {
        name: 'vite-plugin-textproto-to-binary-smart',
        async buildStart() {
            console.log(`\n[textProtoPlugin] buildStart: Scanning ${SHARED_CONFIG.textProtoInputDir}...`);
            await convertAllFiles();
        },
        configureServer(server: ViteDevServer) {
            const watchPaths = [`${SHARED_CONFIG.textProtoInputDir}/**/*.txtpb`, `${SHARED_CONFIG.protoDir}/**/*.proto`];
            server.watcher.add(watchPaths);
            console.log(`Watching for changes in: ${SHARED_CONFIG.textProtoInputDir} and ${SHARED_CONFIG.protoDir}`);

            server.watcher.on('all', async (event, filePath) => {
                let needsReload = false;
                if (filePath.includes(SHARED_CONFIG.protoDir)) {
                    console.log(`Proto definition ${path.basename(filePath)} changed. Re-converting all .txtpb files.`);
                    await convertAllFiles(true);
                    needsReload = true;
                } else if (filePath.includes(SHARED_CONFIG.textProtoInputDir)) {
                    console.log(`.txtpb file ${path.basename(filePath)} ${event}.`);
                    needsReload = await convertFile(filePath);
                    cacheManager.save();
                }
                if (needsReload) server.ws.send({type: 'full-reload', path: '*'});
            });
        }
    };
}


// =================================================================
// 4. Vite 主配置 (Main Vite Config)
// =================================================================
export default defineConfig({
    base: '/card-verdict/',
    plugins: [
        reactRouter(),
        tsconfigPaths(),
        protobufjsPlugin(),
        textProtoToBinaryPlugin(),
    ],
    resolve: {
        alias: {
            'msw/node': path.resolve(__dirname, './node_modules/msw/lib/node/index.mjs')
        }
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './app/test/setup.ts',
    },
});
