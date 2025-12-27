<template>
	<div class="settings-overlay" @click.self="$emit('close')">
		<div class="settings-popup">
			<h2 class="settings-title">{{ t('settings.title') }}</h2>
			
			<div class="settings-section">
				<h3 class="section-label">{{ t('settings.theme') }}</h3>
				<div class="theme-options">
					<button
						v-for="theme in themes"
						:key="theme"
						:class="['theme-option', theme, { active: currentTheme === theme }]"
						@click="selectTheme(theme)"
					>
						<div class="theme-preview" :class="theme"></div>
						<span class="theme-name">{{ t(`settings.themes.${theme}`) }}</span>
					</button>
				</div>
			</div>

			<div class="settings-section">
				<h3 class="section-label">{{ t('settings.language') }}</h3>
				<div class="language-options">
					<button
						v-for="(langName, langCode) in languages"
						:key="langCode"
						:class="['language-option', { active: currentLanguage === langCode }]"
						@click="selectLanguage(langCode)"
					>
						{{ langName }}
					</button>
				</div>
			</div>

			<button class="close-btn" @click="$emit('close')" aria-label="Close settings">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12"/>
				</svg>
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();

const emit = defineEmits<{
	(e: 'close'): void;
	(e: 'theme-change', theme: string): void;
	(e: 'language-change', language: string): void;
}>();

const themes = ['blue', 'white', 'dark'];
const languages = {
	en: 'English',
	es: 'Español',
	it: 'Italiano',
	fr: 'Français',
	de: 'Deutsch',
	pt: 'Português',
	zh: '中文',
	ja: '日本語'
};

const currentTheme = ref(localStorage.getItem('zen_theme') || 'blue');
const currentLanguage = ref(locale.value);

function selectTheme(theme: string) {
	currentTheme.value = theme;
	emit('theme-change', theme);
}

function selectLanguage(lang: string) {
	currentLanguage.value = lang;
	emit('language-change', lang);
}
</script>

<style scoped>
.settings-overlay {
	position: fixed;
	inset: 0;
	background: var(--blur2);
	backdrop-filter: blur(8px);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 2000;
	animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
	from { opacity: 0; }
	to { opacity: 1; }
}

.settings-popup {
	background: var(--input-bg);
	border: 1px solid var(--input-border);
	border-radius: 6px;
	padding: 0.75rem;
	width: 90%;
	max-width: 420px;
	max-height: 80vh;
	overflow-y: auto;
	position: relative;
	animation: slideUp 0.3s ease-out;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

@keyframes slideUp {
	from {
		transform: translateY(20px);
		opacity: 0;
	}
	to {
		transform: translateY(0);
		opacity: 1;
	}
}

.settings-title {
	color: var(--text1);
	font-size: 0.875rem;
	font-weight: 400;
	margin: 0 0 1rem 0;
	text-align: center;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	padding-right: 2rem;
}

.settings-section {
	margin-bottom: 1rem;
}

.settings-section:last-of-type {
	margin-bottom: 0;
}

.section-label {
	color: var(--text2);
	font-size: 0.7rem;
	font-weight: 400;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	margin: 0 0 0.5rem 0;
}

.theme-options {
	display: flex;
	gap: 0.5rem;
	justify-content: space-between;
}

.theme-option {
	background: var(--input-bg);
	border: 1px solid var(--input-border);
	border-radius: 4px;
	padding: 0.5rem;
	cursor: pointer;
	transition: all 0.15s;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.5rem;
	flex: 1;
}

.theme-option:hover {
	background: var(--input-bg-focus);
	border-color: var(--border-subtle);
}

.theme-option.active {
	background: var(--border-subtle);
	border-color: var(--border-subtle);
}

.theme-preview {
	width: 40px;
	height: 40px;
	border-radius: 4px;
	border: 1px solid var(--input-border);
	transition: transform 0.15s;
}

.theme-option:hover .theme-preview {
	transform: scale(1.05);
}

.theme-preview.blue {
	background: linear-gradient(135deg, #1F305E 0%, #35456e 100%);
}

.theme-preview.white {
	background: linear-gradient(135deg, #F2F3F4 0%, #e3e6ed 100%);
}

.theme-preview.dark {
	background: linear-gradient(135deg, #181a20 0%, #23262f 100%);
}

.theme-name {
	color: var(--text1);
	font-size: 0.7rem;
	font-weight: 400;
}

.language-options {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 0.5rem;
}

.language-option {
	background: var(--input-bg);
	border: 1px solid var(--input-border);
	border-radius: 4px;
	padding: 0.5rem 0.35rem;
	color: var(--text2);
	font-size: 0.75rem;
	cursor: pointer;
	transition: all 0.15s;
	text-align: center;
	font-weight: 400;
}

.language-option:hover {
	background: var(--input-bg-focus);
	border-color: var(--border-subtle);
	color: var(--text1);
}

.language-option.active {
	background: var(--border-subtle);
	border-color: var(--border-subtle);
	color: var(--text1);
	font-weight: 400;
}

.close-btn {
	position: absolute;
	top: 0.5rem;
	right: 0.5rem;
	background: transparent;
	border: none;
	color: var(--text2);
	cursor: pointer;
	padding: 0.25rem;
	border-radius: 3px;
	transition: all 0.15s;
	display: flex;
	align-items: center;
	justify-content: center;
}

.close-btn:hover {
	background: var(--input-bg-focus);
	color: var(--text1);
}

.close-btn svg {
	width: 16px;
	height: 16px;
}

@media (max-width: 600px) {
	.settings-popup {
		width: 90vw;
		max-width: unset;
	}

	.language-options {
		grid-template-columns: repeat(2, 1fr);
	}

	.theme-options {
		gap: 0.35rem;
	}
}
</style>
