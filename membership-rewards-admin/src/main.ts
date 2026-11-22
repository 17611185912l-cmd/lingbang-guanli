import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import './style.css'
import './spec/guide.css'
import App from './app.vue'
createApp(App).use(ElementPlus,{locale:zhCn}).mount('#app')
