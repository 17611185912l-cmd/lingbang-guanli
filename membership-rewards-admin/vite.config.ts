import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({ plugins:[vue()], base:'./', build:{assetsInlineLimit:100000,cssCodeSplit:false,rollupOptions:{output:{inlineDynamicImports:true}}}, server:{fs:{allow:['..']}} })
