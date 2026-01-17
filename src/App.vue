<template>
	<div id="app" :class="currentTheme">
		<NetworkStatus />
		<Home @meditation-active="onMeditationActive" @theme-changed="setThemeFromLogin" @language-changed="setLanguageFromLogin" @user-changed="onUserChanged" />
		<button
			v-if="!meditationActive && isAuthenticated"
			class="settings-btn"
			@click="showSettings = true"
			aria-label="Open settings"
		>
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path fill-rule="evenodd" clip-rule="evenodd" d="M12.4277 2C11.3139 2 10.2995 2.6007 8.27081 3.80211L7.58466 4.20846C5.55594 5.40987 4.54158 6.01057 3.98466 7C3.42773 7.98943 3.42773 9.19084 3.42773 11.5937V12.4063C3.42773 14.8092 3.42773 16.0106 3.98466 17C4.54158 17.9894 5.55594 18.5901 7.58466 19.7915L8.27081 20.1979C10.2995 21.3993 11.3139 22 12.4277 22C13.5416 22 14.5559 21.3993 16.5847 20.1979L17.2708 19.7915C19.2995 18.5901 20.3139 17.9894 20.8708 17C21.4277 16.0106 21.4277 14.8092 21.4277 12.4063V11.5937C21.4277 9.19084 21.4277 7.98943 20.8708 7C20.3139 6.01057 19.2995 5.40987 17.2708 4.20846L16.5847 3.80211C14.5559 2.6007 13.5416 2 12.4277 2ZM8.67773 12C8.67773 9.92893 10.3567 8.25 12.4277 8.25C14.4988 8.25 16.1777 9.92893 16.1777 12C16.1777 14.0711 14.4988 15.75 12.4277 15.75C10.3567 15.75 8.67773 14.0711 8.67773 12Z" fill="currentColor"/>
			</svg>
		</button>
		<SettingsPopup v-if="showSettings" @close="showSettings = false" @theme-change="setTheme" @language-change="setLanguage" />
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import Home from './components/Home.vue';
import SettingsPopup from './components/SettingsPopup.vue';
import NetworkStatus from './components/NetworkStatus.vue';
import { apiRequest } from './api';

const { locale } = useI18n();

// initialize theme from localStorage if present, otherwise default to 'blue'
const currentTheme = ref(localStorage.getItem('zen_theme') || 'blue');
const meditationActive = ref(false); // controlled by Home.vue
const showSettings = ref(false);
const isAuthenticated = ref(false);

function onMeditationActive(val: boolean) {
	meditationActive.value = val;
}

function onUserChanged(user: any) {
	isAuthenticated.value = !!user;
}

function setThemeFromLogin(theme: string) {
	const themes = ['blue', 'white', 'dark'];
	if (themes.includes(theme)) {
		currentTheme.value = theme;
		// persist the user's theme locally so it survives refresh
		localStorage.setItem('zen_theme', theme);
	}
}

function setLanguageFromLogin(language: string) {
	const languages = ['en', 'es', 'it', 'fr', 'de', 'pt', 'zh', 'ja'];
	if (languages.includes(language)) {
		locale.value = language;
		localStorage.setItem('zen_language', language);
	}
}

async function setTheme(theme: string) {
	currentTheme.value = theme;
	// persist locally right away so refresh keeps it even if server call fails
	localStorage.setItem('zen_theme', theme);
	try {
		await apiRequest('/theme', 'PATCH', { theme });
	} catch (err) {
		// Theme saved locally, server sync can fail silently
	}
}

async function setLanguage(language: string) {
	locale.value = language;
	localStorage.setItem('zen_language', language);
	try {
		await apiRequest('/language', 'PATCH', { language });
	} catch (err) {
		// Language saved locally, server sync can fail silently
	}
}
</script>

<style>
.settings-btn {
	position: fixed;
	bottom: 2rem;
	right: 2rem;
	width: 56px;
	height: 56px;
	border-radius: 50%;
	background: rgba(240, 248, 255, 0.08);
	border: 1px solid rgba(240, 248, 255, 0.12);
	color: var(--text2);
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1000;
	transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	backdrop-filter: blur(8px);
}

.settings-btn:hover {
	background: rgba(240, 248, 255, 0.12);
	border-color: rgba(240, 248, 255, 0.2);
	color: var(--text1);
	transform: rotate(90deg) scale(1.05);
}

.settings-btn:active {
	transform: rotate(90deg) scale(0.95);
}

.settings-btn svg {
	transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

@media (max-width: 420px) {
	.settings-btn {
		width: 52px;
		height: 52px;
		bottom: 1.25rem;
		right: 1.25rem;
		/* Improved mobile interaction */
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
	}
	
	.settings-btn svg {
		width: 22px;
		height: 22px;
	}
}

/* Tablet and medium screens */
@media (min-width: 421px) and (max-width: 768px) {
	.settings-btn {
		width: 54px;
		height: 54px;
		bottom: 1.5rem;
		right: 1.5rem;
	}
}
</style>
