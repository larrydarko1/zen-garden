<template>
  <div class="insights-overlay" @click.self="$emit('close')">
    <div class="insights-modal" @click.stop>
      <button class="insights-close" @click="$emit('close')" aria-label="Close insights">×</button>
      
      <div class="insights-header">
        <h2>{{ t('insights.title') }}</h2>
        <p class="insights-subtitle">{{ t('insights.subtitle') }}</p>
      </div>

      <div class="insights-content">
        <div v-if="loading" class="loading">{{ t('insights.loading') }}...</div>
        <div v-else-if="insights" class="insights-data">
          
          <!-- Summary Cards -->
          <div class="insights-summary">
            <div class="insight-card primary">
              <div class="card-content">
                <div class="card-label">{{ t('insights.correlationScore') }}</div>
                <div class="card-value" :class="getCorrelationClass(insights.correlationScore)">
                  {{ Math.round(insights.correlationScore * 100) }}%
                </div>
                <div class="card-description">{{ getCorrelationText(insights.correlationScore) }}</div>
              </div>
            </div>
          </div>

          <!-- Key Stats Grid -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">{{ t('insights.meditationDays') }}</div>
              <div class="stat-value">{{ insights.meditationDays }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">{{ t('insights.avgMeditationTime') }}</div>
              <div class="stat-value">{{ insights.avgMeditationMinutes }}m</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">{{ t('insights.emotionTrackedDays') }}</div>
              <div class="stat-value">{{ insights.emotionTrackedDays }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">{{ t('insights.avgPNRatio') }}</div>
              <div class="stat-value">{{ insights.avgPNRatio.toFixed(2) }}</div>
            </div>
          </div>

          <!-- Comparison Sections -->
          <div class="comparison-section">
            <h3>{{ t('insights.withVsWithout') }}</h3>
            <div class="comparison-grid">
              <div class="comparison-item meditation">
                <div class="comparison-header">
                  <span class="comparison-title">{{ t('insights.daysWithMeditation') }}</span>
                </div>
                <div class="comparison-stats">
                  <div class="comparison-stat">
                    <span class="stat-label">{{ t('insights.avgPositive') }}</span>
                    <span class="stat-value positive">{{ insights.withMeditation.avgPositive.toFixed(2) }}</span>
                  </div>
                  <div class="comparison-stat">
                    <span class="stat-label">{{ t('insights.avgNegative') }}</span>
                    <span class="stat-value negative">{{ insights.withMeditation.avgNegative.toFixed(2) }}</span>
                  </div>
                  <div class="comparison-stat">
                    <span class="stat-label">{{ t('insights.pnRatio') }}</span>
                    <span class="stat-value">{{ insights.withMeditation.pnRatio.toFixed(2) }}</span>
                  </div>
                </div>
              </div>

              <div class="comparison-item no-meditation">
                <div class="comparison-header">
                  <span class="comparison-title">{{ t('insights.daysWithoutMeditation') }}</span>
                </div>
                <div class="comparison-stats">
                  <div class="comparison-stat">
                    <span class="stat-label">{{ t('insights.avgPositive') }}</span>
                    <span class="stat-value positive">{{ insights.withoutMeditation.avgPositive.toFixed(2) }}</span>
                  </div>
                  <div class="comparison-stat">
                    <span class="stat-label">{{ t('insights.avgNegative') }}</span>
                    <span class="stat-value negative">{{ insights.withoutMeditation.avgNegative.toFixed(2) }}</span>
                  </div>
                  <div class="comparison-stat">
                    <span class="stat-label">{{ t('insights.pnRatio') }}</span>
                    <span class="stat-value">{{ insights.withoutMeditation.pnRatio.toFixed(2) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Meditation Duration Impact -->
          <div class="duration-section" v-if="insights.durationImpact && insights.durationImpact.length > 0">
            <h3>{{ t('insights.durationImpact') }}</h3>
            <div class="duration-chart">
              <div 
                v-for="range in insights.durationImpact" 
                :key="range.range"
                class="duration-bar-item"
              >
                <div class="duration-label">{{ range.range }}</div>
                <div class="duration-bar-container">
                  <div 
                    class="duration-bar"
                    :style="{ width: `${range.pnRatio * 100}%` }"
                    :class="{ high: range.pnRatio >= 0.6, medium: range.pnRatio >= 0.4 && range.pnRatio < 0.6, low: range.pnRatio < 0.4 }"
                  >
                    <span class="duration-bar-value">{{ Math.round(range.pnRatio * 100) }}%</span>
                  </div>
                </div>
                <div class="duration-count">{{ range.count }} {{ t('insights.days') }}</div>
              </div>
            </div>
          </div>

          <!-- Best Days -->
          <div class="best-days-section" v-if="insights.bestDays && insights.bestDays.length > 0">
            <h3>{{ t('insights.bestDays') }}</h3>
            <div class="best-days-list">
              <div 
                v-for="day in insights.bestDays.slice(0, 5)" 
                :key="day.date"
                class="best-day-item"
              >
                <div class="best-day-date">{{ formatDate(day.date) }}</div>
                <div class="best-day-stats">
                  <span class="best-day-badge">🧘 {{ day.meditationMinutes }}m</span>
                  <span class="best-day-badge positive">😊 {{ day.positiveCount }}</span>
                  <span class="best-day-badge">{{ Math.round(day.pnRatio * 100) }}% P/N</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Insights Message -->
          <div class="insights-message">
            <div class="message-icon">💡</div>
            <div class="message-content">
              <h4>{{ t('insights.insight') }}</h4>
              <p>{{ getInsightMessage(insights.correlationScore) }}</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiRequest } from '../api';

const { t } = useI18n();
const emit = defineEmits(['close']);

const loading = ref(false);
const insights = ref<any>(null);

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCorrelationClass(score: number) {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

function getCorrelationText(score: number) {
  if (score >= 0.7) return t('insights.strongCorrelation');
  if (score >= 0.4) return t('insights.moderateCorrelation');
  return t('insights.weakCorrelation');
}

function getInsightMessage(score: number) {
  if (score >= 0.7) return t('insights.messages.high');
  if (score >= 0.4) return t('insights.messages.medium');
  return t('insights.messages.low');
}

async function loadInsights() {
  loading.value = true;
  try {
    const response = await apiRequest('/insights/correlation?days=90', 'GET');
    insights.value = response;
  } catch (err) {
    console.error('Failed to load insights:', err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadInsights();
});
</script>

<style scoped>
.insights-overlay {
  position: fixed;
  inset: 0;
  background: var(--blur2);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.insights-modal {
  position: relative;
  background: var(--base1);
  border-radius: 12px;
  width: 90vw;
  max-width: 800px;
  max-height: 88vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  animation: slideUp 0.3s ease-out;
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

.insights-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  font-size: 1.75rem;
  color: var(--text2);
  cursor: pointer;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
  z-index: 1;
}

.insights-close:hover {
  background: var(--button-bg-hover);
  color: var(--text1);
}

.insights-header {
  padding: 1rem 1.5rem 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
}

.insights-header h2 {
  margin: 0 0 0.25rem;
  color: var(--text1);
  font-size: 1.35rem;
}

.insights-subtitle {
  margin: 0;
  color: var(--text2);
  font-size: 0.9rem;
}

.insights-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: var(--text2);
  font-size: 1.1rem;
}

.insights-data {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.insights-summary {
  display: flex;
  justify-content: center;
}

.insight-card {
  background: linear-gradient(135deg, var(--blur1), var(--input-bg));
  border: 2px solid var(--input-border);
  border-radius: 10px;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  max-width: 450px;
}

.card-icon {
  font-size: 2.5rem;
}

.card-content {
  flex: 1;
}

.card-label {
  font-size: 0.9rem;
  color: var(--text2);
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.card-value {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.card-value.high {
  color: #4CAF50;
}

.card-value.medium {
  color: #FFC107;
}

.card-value.low {
  color: #FF9800;
}

.card-description {
  font-size: 0.9rem;
  color: var(--text2);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--text2);
  margin-bottom: 0.5rem;
  display: block;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text1);
}

.comparison-section h3,
.duration-section h3,
.best-days-section h3 {
  margin: 0 0 0.75rem;
  color: var(--text1);
  font-size: 1.1rem;
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.comparison-item {
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 8px;
  padding: 1rem;
}

.comparison-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-subtle);
}

.comparison-icon {
  font-size: 1.3rem;
}

.comparison-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text1);
}

.comparison-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.comparison-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.comparison-stat .stat-label {
  font-size: 0.9rem;
  color: var(--text2);
  margin: 0;
}

.comparison-stat .stat-value {
  font-size: 1.15rem;
  font-weight: 600;
}

.comparison-stat .stat-value.positive {
  color: #4CAF50;
}

.comparison-stat .stat-value.negative {
  color: #F44336;
}

.duration-chart {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.duration-bar-item {
  display: grid;
  grid-template-columns: 120px 1fr 80px;
  gap: 1rem;
  align-items: center;
}

.duration-label {
  font-size: 0.9rem;
  color: var(--text1);
  font-weight: 500;
}

.duration-bar-container {
  background: var(--input-bg);
  height: 28px;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
}

.duration-bar {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 0.5rem;
  border-radius: 6px;
  transition: width 0.3s;
}

.duration-bar.high {
  background: linear-gradient(90deg, rgba(76, 175, 80, 0.4), rgba(76, 175, 80, 0.7));
}

.duration-bar.medium {
  background: linear-gradient(90deg, rgba(255, 193, 7, 0.4), rgba(255, 193, 7, 0.7));
}

.duration-bar.low {
  background: linear-gradient(90deg, rgba(255, 152, 0, 0.4), rgba(255, 152, 0, 0.7));
}

.duration-bar-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text1);
}

.duration-count {
  font-size: 0.85rem;
  color: var(--text2);
  text-align: right;
}

.best-days-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.best-day-item {
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.best-day-date {
  font-size: 0.95rem;
  color: var(--text1);
  font-weight: 500;
}

.best-day-stats {
  display: flex;
  gap: 0.5rem;
}

.best-day-badge {
  background: var(--blur1);
  border: 1px solid var(--border-subtle);
  padding: 0.3rem 0.6rem;
  border-radius: 5px;
  font-size: 0.8rem;
  color: var(--text1);
}

.best-day-badge.positive {
  background: rgba(76, 175, 80, 0.15);
  border-color: rgba(76, 175, 80, 0.3);
  color: #4CAF50;
}

.insights-message {
  background: linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(33, 150, 243, 0.05));
  border: 1px solid rgba(33, 150, 243, 0.3);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  gap: 0.75rem;
}

.message-icon {
  font-size: 1.75rem;
}

.message-content h4 {
  margin: 0 0 0.35rem;
  color: var(--text1);
  font-size: 1rem;
}

.message-content p {
  margin: 0;
  color: var(--text1);
  line-height: 1.5;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .insights-modal {
    width: 100vw;
    max-width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    border: none;
  }

  .insights-header {
    padding: 1rem;
  }

  .insights-header h2 {
    font-size: 1.25rem;
  }

  .insights-subtitle {
    font-size: 0.85rem;
  }

  .insights-content {
    padding: 1rem;
  }

  .insight-card {
    flex-direction: column;
    text-align: center;
    padding: 1.5rem;
  }

  .card-icon {
    font-size: 2.5rem;
  }

  .card-value {
    font-size: 2.5rem;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .stat-card {
    padding: 1rem;
  }

  .stat-value {
    font-size: 1.5rem;
  }

  .comparison-grid {
    grid-template-columns: 1fr;
  }

  .duration-bar-item {
    grid-template-columns: 100px 1fr 60px;
    gap: 0.5rem;
  }

  .duration-label {
    font-size: 0.8rem;
  }

  .best-day-item {
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .best-day-stats {
    flex-wrap: wrap;
  }

  .insights-message {
    flex-direction: column;
    padding: 1rem;
  }
}
</style>
