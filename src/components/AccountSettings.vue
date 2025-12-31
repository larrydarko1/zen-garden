<template>
  <div class="account-settings">
    <!-- Change Username Section -->
    <div class="settings-section">
      <h3 class="section-title">{{ t('account.changeUsername') }}</h3>
      <form @submit.prevent="changeUsername" class="settings-form">
        <input
          v-model="newUsername"
          :placeholder="t('account.newUsernamePlaceholder')"
          :disabled="isChangingUsername"
          required
          autocomplete="username"
        />
        <button type="submit" :disabled="isChangingUsername || !newUsername" class="zen-btn">
          <span v-if="!isChangingUsername">{{ t('account.updateUsername') }}</span>
          <span v-else class="zen-loader">
            <svg width="20" height="20" viewBox="0 0 32 32">
              <rect x="10" y="15" width="12" height="2" rx="1">
                <animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="2.5s" repeatCount="indefinite"/>
              </rect>
            </svg>
          </span>
        </button>
        <div v-if="usernameSuccess" class="success-message">{{ usernameSuccess }}</div>
        <div v-if="usernameError" class="error-message">{{ usernameError }}</div>
      </form>
    </div>

    <!-- Change Password Section -->
    <div class="settings-section">
      <h3 class="section-title">{{ t('account.changePassword') }}</h3>
      <form @submit.prevent="changePassword" class="settings-form">
        <input
          v-model="currentPassword"
          type="password"
          :placeholder="t('account.currentPasswordPlaceholder')"
          :disabled="isChangingPassword"
          required
          autocomplete="current-password"
        />
        <input
          v-model="newPassword"
          type="password"
          :placeholder="t('account.newPasswordPlaceholder')"
          :disabled="isChangingPassword"
          required
          autocomplete="new-password"
        />
        <input
          v-model="confirmNewPassword"
          type="password"
          :placeholder="t('account.confirmPasswordPlaceholder')"
          :disabled="isChangingPassword"
          required
          autocomplete="new-password"
        />
        <button type="submit" :disabled="isChangingPassword || !currentPassword || !newPassword || !confirmNewPassword" class="zen-btn">
          <span v-if="!isChangingPassword">{{ t('account.updatePassword') }}</span>
          <span v-else class="zen-loader">
            <svg width="20" height="20" viewBox="0 0 32 32">
              <rect x="10" y="15" width="12" height="2" rx="1">
                <animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="2.5s" repeatCount="indefinite"/>
              </rect>
            </svg>
          </span>
        </button>
        <div v-if="passwordSuccess" class="success-message">{{ passwordSuccess }}</div>
        <div v-if="passwordError" class="error-message">{{ passwordError }}</div>
      </form>
    </div>

    <!-- Delete Account Section -->
    <div class="settings-section danger-section">
      <h3 class="section-title danger-title">{{ t('account.deleteAccount') }}</h3>
      <p class="warning-text">{{ t('account.deleteWarning') }}</p>
      
      <button v-if="!showDeleteConfirm" @click="showDeleteConfirm = true" class="zen-btn danger-btn">
        {{ t('account.deleteAccountButton') }}
      </button>

      <form v-else @submit.prevent="deleteAccount" class="settings-form delete-form">
        <input
          v-model="deletePassword"
          type="password"
          :placeholder="t('account.confirmPasswordToDelete')"
          :disabled="isDeletingAccount"
          required
          autocomplete="current-password"
        />
        <div class="button-row">
          <button type="button" @click="cancelDelete" :disabled="isDeletingAccount" class="zen-btn cancel-btn">
            {{ t('account.cancel') }}
          </button>
          <button type="submit" :disabled="isDeletingAccount || !deletePassword" class="zen-btn danger-btn">
            <span v-if="!isDeletingAccount">{{ t('account.confirmDelete') }}</span>
            <span v-else class="zen-loader">
              <svg width="20" height="20" viewBox="0 0 32 32">
                <rect x="10" y="15" width="12" height="2" rx="1">
                  <animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="2.5s" repeatCount="indefinite"/>
                </rect>
              </svg>
            </span>
          </button>
        </div>
        <div v-if="deleteError" class="error-message">{{ deleteError }}</div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiRequest } from '../api'

const { t } = useI18n()

const emit = defineEmits(['usernameChanged', 'accountDeleted'])

// Change Username
const newUsername = ref('')
const isChangingUsername = ref(false)
const usernameSuccess = ref('')
const usernameError = ref('')

// Change Password
const currentPassword = ref('')
const newPassword = ref('')
const confirmNewPassword = ref('')
const isChangingPassword = ref(false)
const passwordSuccess = ref('')
const passwordError = ref('')

// Delete Account
const showDeleteConfirm = ref(false)
const deletePassword = ref('')
const isDeletingAccount = ref(false)
const deleteError = ref('')

async function changeUsername() {
  usernameError.value = ''
  usernameSuccess.value = ''
  isChangingUsername.value = true

  try {
    const result = await apiRequest('/user/username', 'PATCH', { newUsername: newUsername.value })
    usernameSuccess.value = t('account.usernameUpdated')
    newUsername.value = ''
    
    // Update token and notify parent
    if (result.token) {
      localStorage.setItem('zen_token', result.token)
      emit('usernameChanged', result.username)
    }
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      usernameSuccess.value = ''
    }, 3000)
  } catch (error: any) {
    usernameError.value = error.message || t('account.usernameUpdateFailed')
  } finally {
    isChangingUsername.value = false
  }
}

async function changePassword() {
  passwordError.value = ''
  passwordSuccess.value = ''

  // Validate passwords match
  if (newPassword.value !== confirmNewPassword.value) {
    passwordError.value = t('account.passwordsDoNotMatch')
    return
  }

  // Validate password length
  if (newPassword.value.length < 6) {
    passwordError.value = t('account.passwordTooShort')
    return
  }

  isChangingPassword.value = true

  try {
    await apiRequest('/user/password', 'PATCH', { 
      currentPassword: currentPassword.value, 
      newPassword: newPassword.value 
    })
    passwordSuccess.value = t('account.passwordUpdated')
    
    // Clear form
    currentPassword.value = ''
    newPassword.value = ''
    confirmNewPassword.value = ''
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      passwordSuccess.value = ''
    }, 3000)
  } catch (error: any) {
    passwordError.value = error.message || t('account.passwordUpdateFailed')
  } finally {
    isChangingPassword.value = false
  }
}

async function deleteAccount() {
  deleteError.value = ''
  isDeletingAccount.value = true

  try {
    await apiRequest('/user/account', 'DELETE', { password: deletePassword.value })
    
    // Clear local storage and notify parent
    localStorage.removeItem('zen_token')
    emit('accountDeleted')
  } catch (error: any) {
    deleteError.value = error.message || t('account.deleteFailed')
    isDeletingAccount.value = false
  }
}

function cancelDelete() {
  showDeleteConfirm.value = false
  deletePassword.value = ''
  deleteError.value = ''
}
</script>

<style scoped>
.account-settings {
  padding: 0;
  max-width: 100%;
}

.settings-title {
  font-size: 1.25rem;
  color: var(--text1);
  margin-bottom: 1.5rem;
  font-weight: 500;
  text-align: center;
}

.settings-section {
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 6px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1rem;
  color: var(--text1);
  margin-bottom: 1rem;
  font-weight: 500;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

input {
  padding: 0.625rem 0.75rem;
  border-radius: 4px;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--text1);
  font-size: 0.875rem;
  outline: none;
  transition: border 0.15s, background 0.15s;
}

input:focus {
  border: 1px solid var(--input-border-focus);
  background: var(--input-bg-focus);
}

input::placeholder {
  color: var(--text2);
  opacity: 0.6;
}

.zen-btn {
  background: var(--button-bg);
  color: var(--text1);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  padding: 0.625rem 1rem;
  cursor: pointer;
  font-weight: 400;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.15s;
  outline: none;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.zen-btn:hover:not(:disabled) {
  background: var(--button-bg-hover);
  border-color: var(--button-border-hover);
}

.zen-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.zen-loader {
  display: flex;
  align-items: center;
  justify-content: center;
}

.zen-loader svg rect {
  fill: var(--text1);
}

.success-message {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 0.625rem;
  border-radius: 4px;
  font-size: 0.875rem;
  text-align: center;
}

.error-message {
  color: var(--error-text);
  background: var(--error-bg);
  border: 1px solid var(--error-border);
  padding: 0.625rem;
  border-radius: 4px;
  font-size: 0.875rem;
  text-align: center;
}

/* Danger Section Styles */
.danger-section {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.05);
}

.danger-title {
  color: #ef4444;
}

.warning-text {
  color: var(--text2);
  font-size: 0.875rem;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.danger-btn {
  background: #ef4444;
  border-color: #dc2626;
  color: white;
}

.danger-btn:hover:not(:disabled) {
  background: #dc2626;
  border-color: #b91c1c;
}

.delete-form {
  margin-top: 1rem;
}

.button-row {
  display: flex;
  gap: 0.75rem;
}

.cancel-btn {
  flex: 1;
}

.danger-btn {
  flex: 1;
}

@media (max-width: 640px) {
  .account-settings {
    padding: 1rem;
  }

  .settings-section {
    padding: 1rem;
  }

  .button-row {
    flex-direction: column;
  }
}
</style>
