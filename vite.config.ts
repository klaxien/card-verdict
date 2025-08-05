import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from 'vite';
import type { ViteDevServer } from "vite";
import { exec } from 'child_process';
import { promisify } from 'util';
import {
    mkdirSync,
    existsSync,
    readdirSync,
    statSync,
    openSync,
    readSync,
    closeSync
} from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// --- 插件1: 编译 .proto 为 JS (已优化) ---
function protobufjsPlugin() {
    const protoDir = 'app/proto';
    const generatedDir = 'app/generated';
    const jsOutputFile = `${generatedDir}/bundle.js`;
    const tsOutputFile = `${generatedDir}/bundle.d.ts`;
    // Create an absolute path for comparison in the transform hook
    const absoluteJsOutputPath = path.resolve(jsOutputFile);

    // This command remains the same
    const buildProtosCommand = `npx pbjs -t static-module -w es6 -o ${jsOutputFile} ${protoDir}/**/*.proto && npx pbts -o ${tsOutputFile} ${jsOutputFile}`;

    async function buildProtos() {
        try {
            if (!existsSync(generatedDir)) {
                mkdirSync(generatedDir, { recursive: true });
            }
            console.log('Building protobuf JS/TS files...');
            const { stdout, stderr } = await execAsync(buildProtosCommand);
            if (stdout) console.log(stdout);
            if (stderr) console.error(stderr);
            console.log('Protobuf JS/TS files built successfully.');
            // NO MORE file system modification here. The transform hook will handle it.
        } catch (e) {
            console.error('Error building protobuf JS/TS files:', e);
        }
    }

    return {
        name: 'vite-plugin-protobuf-transform',
        // buildStart still generates the files initially
        buildStart: buildProtos,

        // configureServer still watches for changes to .proto files
        configureServer(server: ViteDevServer) {
            server.watcher.add(`${protoDir}/**/*.proto`);
            server.watcher.on('change', async (filePath) => {
                if (filePath.endsWith('.proto')) {
                    console.log(`File ${filePath} has changed. Rebuilding JS/TS...`);
                    await buildProtos();
                    server.ws.send({ type: 'full-reload', path: '*' });
                }
            });
        },

        // --- NEW: The Transform Hook ---
        // This hook intercepts the generated file when requested by the browser
        // and applies the fix in memory before serving.
        transform(code, id) {
            // Check if the requested file is our generated bundle
            if (id === absoluteJsOutputPath) {
                console.log(`Transforming ${path.basename(id)} for Vite compatibility...`);
                const modifiedCode = code.replace(
                    'import * as $protobuf from "protobufjs/minimal";',
                    'import $protobuf from "protobufjs/minimal.js";'
                );
                // Return the modified code to Vite
                return {
                    code: modifiedCode,
                    map: null // No source map changes needed
                };
            }
            // For all other files, do nothing
            return null;
        }
    };
}


// --- 插件2: 智能转换 .txtpb 为 .pb (无需修改) ---
function textProtoToBinaryPlugin() {
    const protoSourceDir = 'app/proto';
    const textProtoInputDir = 'app/assets/txtpb';
    const binaryOutputDir = 'public/pb';

    function parseProtoHeader(filePath: string) {
        const buffer = Buffer.alloc(1024);
        const fd = openSync(filePath, 'r');
        try {
            readSync(fd, buffer, 0, 1024, 0);
        } finally {
            closeSync(fd);
        }
        const content = buffer.toString('utf-8');
        let protoFile = null;
        let messageType = null;
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

    async function convertFile(textProtoFilePath: string) {
        if (!textProtoFilePath.endsWith('.txtpb')) return;

        const headerInfo = parseProtoHeader(textProtoFilePath);

        if (!headerInfo) {
            console.warn(`[SKIPPING] File ${path.basename(textProtoFilePath)} is missing or has an incomplete header.`);
            return;
        }

        const { protoFile, messageType } = headerInfo;
        const baseName = path.basename(textProtoFilePath, '.txtpb');
        const binaryOutputFile = path.join(binaryOutputDir, `${baseName}.pb`);

        const buildBinaryCommand = `protoc --proto_path=${protoSourceDir} --encode=${messageType} ${protoFile} < ${textProtoFilePath} > ${binaryOutputFile}`;

        try {
            const conversionMessage = `${path.basename(textProtoFilePath)} (using ${messageType} from ${protoFile})`;
            console.log(`[CONVERTING] ${conversionMessage}`);
            const { stderr } = await execAsync(buildBinaryCommand);
            if (stderr) {
                console.log(`[protoc info for ${baseName}.pb]:\n${stderr}`);
            }
            console.log(`[CONVERTED] ${conversionMessage}`);

        } catch (e) {
            console.error(`[ERROR] Failed to convert ${path.basename(textProtoFilePath)}:\n`, e.stderr || e);
        }
    }

    async function convertAllFiles() {
        console.log(`\nScanning ${textProtoInputDir} for .txtpb files...`);
        if (!existsSync(textProtoInputDir)) {
            console.log(`Input directory ${textProtoInputDir} does not exist. Skipping conversion.`);
            return;
        }
        mkdirSync(binaryOutputDir, { recursive: true });

        const files = readdirSync(textProtoInputDir);
        for (const file of files) {
            const fullPath = path.join(textProtoInputDir, file);
            if (statSync(fullPath).isFile()) {
                await convertFile(fullPath);
            }
        }
    }

    return {
        name: 'vite-plugin-textproto-to-binary-smart',
        async buildStart() {
            await convertAllFiles();
        },
        configureServer(server: ViteDevServer) {
            const watchPathTxtpb = path.join(textProtoInputDir, '**', '*.txtpb');
            const watchPathProto = path.join(protoSourceDir, '**', '*.proto');
            server.watcher.add([watchPathTxtpb, watchPathProto]);
            console.log(`Watching for .txtpb file changes in: ${textProtoInputDir}`);

            const handleFileChange = async (filePath: string) => {
                await convertFile(filePath);
                server.ws.send({ type: 'full-reload', path: '*' });
            };

            server.watcher.on('change', handleFileChange);
            server.watcher.on('add', handleFileChange);
        }
    };
}


// https://vite.dev/config/
export default defineConfig({
    plugins: [
        reactRouter(),
        tsconfigPaths(),
        protobufjsPlugin(),
        textProtoToBinaryPlugin(),
    ],
});