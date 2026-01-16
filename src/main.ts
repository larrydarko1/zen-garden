import { createApp } from 'vue'
import './style.scss'
import App from './App.vue'
import { i18n } from './i18n'
import { registerSW } from 'virtual:pwa-register'

// Register service worker for offline support
const updateSW = registerSW({
    onNeedRefresh() {
        if (confirm('New content available. Reload to update?')) {
            updateSW(true)
        }
    },
    onOfflineReady() {
        console.log('App ready to work offline')
    },
    onRegistered(registration) {
        console.log('Service Worker registered:', registration)
    },
    onRegisterError(error) {
        console.error('Service Worker registration failed:', error)
    },
    immediate: true
})

createApp(App).use(i18n).mount('#app')
