import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({plugins:[react(),tailwindcss()],resolve:{alias:[{find:'@lumi/tailwind',replacement:fileURLToPath(new URL('../../tailwind.css',import.meta.url))},{find:'@',replacement:fileURLToPath(new URL('../../',import.meta.url))}],dedupe:['react','react-dom']},
 server:{port:5173,strictPort:true,host:'127.0.0.1',proxy:{'/api':{target:'http://127.0.0.1:8787',changeOrigin:false}}},
 build:{target:'es2022',sourcemap:false,chunkSizeWarningLimit:600,outDir:'dist'}});
