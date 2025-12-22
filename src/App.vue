<template>
	<div id="app" :class="currentTheme">
		<Home @meditation-active="onMeditationActive" @theme-changed="setThemeFromLogin" />
		<div v-if="!meditationActive" class="theme-switcher">
			<button
				v-for="theme in themes"
				:key="theme"
				:class="['theme-btn', theme, { active: currentTheme === theme }]"
				:aria-label="`Switch to ${theme} theme`"
				@click="setTheme(theme)"
			>
				<span class="theme-label">{{ theme }}</span>
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Home from './components/Home.vue';
import { apiRequest } from './api';

const themes = ['blue', 'white', 'dark'];
// initialize theme from localStorage if present, otherwise default to 'blue'
const currentTheme = ref(localStorage.getItem('zen_theme') || 'blue');
const meditationActive = ref(false); // controlled by Home.vue

function onMeditationActive(val: boolean) {
	meditationActive.value = val;
}

function setThemeFromLogin(theme: string) {
	if (themes.includes(theme)) {
		currentTheme.value = theme;
		// persist the user's theme locally so it survives refresh
		localStorage.setItem('zen_theme', theme);
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
</script>

<style>
.theme-switcher {
	position: fixed;
	bottom: 2rem;
	right: 2rem;
	display: flex;
	flex-direction: row;
	gap: 0.25rem;
	padding: 0.25rem;
	background: rgba(240, 248, 255, 0.02);
	border: 1px solid rgba(240, 248, 255, 0.08);
	border-radius: 6px;
	z-index: 1000;
}

.theme-btn {
	padding: 0.4rem 0.75rem;
	border-radius: 4px;
	outline: none;
	border: none;
	cursor: pointer;
	background: transparent;
	color: var(--text2);
	font-size: 0.75rem;
	font-weight: 400;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	transition: all 0.15s;
	position: relative;
}

.theme-label {
	position: relative;
	z-index: 1;
}

.theme-btn:hover {
	background: rgba(240, 248, 255, 0.05);
	color: var(--text1);
}

.theme-btn.active {
	background: rgba(240, 248, 255, 0.1);
	color: var(--text1);
}

.theme-btn:active {
	transform: scale(0.98);
}

 @media (max-width: 420px) {
	.theme-switcher {
		visibility: hidden;
	}
}
</style>
